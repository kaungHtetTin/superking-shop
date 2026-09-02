<?php

namespace App\Services\Inventory;

use App\Models\FinancialEntry;
use App\Models\Location;
use App\Models\ProductUnit;
use App\Models\StockReceipt;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StockReceiptService
{
    public function __construct(private InventoryService $inventoryService)
    {
    }

    public function createDraft(Location $location, array $lines, User $actor, ?string $supplierReference = null, ?string $notes = null): StockReceipt
    {
        return DB::transaction(function () use ($location, $lines, $actor, $supplierReference, $notes) {
            $receipt = StockReceipt::create(['receipt_number' => $this->number(), 'location_id' => $location->id, 'supplier_reference' => $supplierReference, 'status' => 'draft', 'notes' => $notes, 'created_by' => $actor->id]);
            foreach ($this->normalizeLines($lines) as $line) {
                $receipt->items()->create($line);
            }

            return $receipt->load(['items.product', 'items.unit']);
        });
    }

    public function updateDraft(StockReceipt $receipt, Location $location, array $lines, ?string $supplierReference = null, ?string $notes = null): StockReceipt
    {
        return DB::transaction(function () use ($receipt, $location, $lines, $supplierReference, $notes) {
            $locked = StockReceipt::query()->lockForUpdate()->findOrFail($receipt->id);
            if ($locked->status !== 'draft') {
                throw ValidationException::withMessages(['receipt' => 'Only a draft receipt can be edited.']);
            }
            $locked->update(['location_id' => $location->id, 'supplier_reference' => $supplierReference, 'notes' => $notes]);
            $locked->items()->delete();
            foreach ($this->normalizeLines($lines) as $line) {
                $locked->items()->create($line);
            }

            return $locked->fresh(['items.product', 'items.unit']);
        });
    }

    public function post(StockReceipt $receipt, User $actor): StockReceipt
    {
        return DB::transaction(function () use ($receipt, $actor) {
            $locked = StockReceipt::query()->lockForUpdate()->findOrFail($receipt->id);
            if ($locked->status === 'posted') {
                return $locked->load(['items.product', 'items.unit']);
            }
            if ($locked->status !== 'draft') {
                throw ValidationException::withMessages(['receipt' => 'Only a draft receipt can be posted.']);
            }
            $locked->load(['items.product', 'items.unit', 'location']);
            foreach ($locked->items as $item) {
                $movement = $this->inventoryService->receive($locked->location, $item->product, (float) $item->base_quantity, $actor, "receipt:{$locked->id}:item:{$item->id}", $locked, $item->notes, $item->unit, (float) $item->received_quantity);
                $item->update(['movement_id' => $movement->id]);
                if ($item->unit_cost !== null) {
                    $item->product->update(['original_price' => round((float) $item->unit_cost / max((float) $item->conversion_factor, 0.000001), 2)]);
                }
            }
            $locked->update(['status' => 'posted', 'received_by' => $actor->id, 'received_at' => now()]);
            $this->recordFinanceExpense($locked, $actor);

            return $locked->fresh(['items.product', 'items.unit', 'location']);
        }, 3);
    }

    public function delete(StockReceipt $receipt, User $actor): void
    {
        DB::transaction(function () use ($receipt, $actor) {
            $locked = StockReceipt::query()->lockForUpdate()->with(['items.product', 'items.unit', 'location'])->findOrFail($receipt->id);
            if (! in_array($locked->status, ['draft', 'posted'], true)) {
                throw ValidationException::withMessages(['receipt' => 'Only draft or posted receipts can be deleted.']);
            }
            if ($locked->status === 'posted') {
                foreach ($locked->items as $item) {
                    $this->inventoryService->adjust($locked->location, $item->product, -1 * (float) $item->base_quantity, 'receipt_delete', $actor, "receipt-delete:{$locked->id}:item:{$item->id}", $locked, "Deleted receipt {$locked->receipt_number}.", $item->unit, -1 * (float) $item->received_quantity);
                }
            }
            FinancialEntry::query()->where('type', 'expense')->where('category', FinancialEntry::CATEGORY_STOCK_RECEIPT)->where('reference', $locked->receipt_number)->delete();
            $locked->delete();
        }, 3);
    }

    private function normalizeLines(array $lines): array
    {
        $seen = [];
        $normalized = [];
        foreach ($lines as $line) {
            $unit = ProductUnit::query()->with('product')->find((int) ($line['product_unit_id'] ?? 0));
            if (! $unit || (isset($line['product_id']) && (int) $line['product_id'] !== $unit->product_id)) {
                throw ValidationException::withMessages(['items' => 'Every receipt line needs a valid product unit.']);
            }
            $key = $unit->product_id;
            if (isset($seen[$key])) {
                throw ValidationException::withMessages(['items' => 'A product can appear only once per receipt.']);
            }
            $seen[$key] = true;
            $quantity = round((float) $line['received_quantity'], 4);
            if ($quantity <= 0) {
                throw ValidationException::withMessages(['items' => 'Every receipt line needs a positive quantity.']);
            }
            if (($line['unit_cost'] ?? '') !== '' && (float) $line['unit_cost'] < 0) {
                throw ValidationException::withMessages(['items' => 'Original price cannot be negative.']);
            }
            $normalized[] = [
                'product_id' => $unit->product_id,
                'product_unit_id' => $unit->id,
                'expected_quantity' => ($line['expected_quantity'] ?? '') === '' ? null : round((float) $line['expected_quantity'], 4),
                'received_quantity' => $quantity,
                'base_quantity' => $unit->toBaseQuantity($quantity),
                'conversion_factor' => $unit->conversion_factor,
                'unit_cost' => ($line['unit_cost'] ?? '') === '' ? null : $line['unit_cost'],
                'notes' => $line['notes'] ?? null,
            ];
        }
        if (! $normalized) {
            throw ValidationException::withMessages(['items' => 'Add at least one receipt item.']);
        }

        return $normalized;
    }

    private function recordFinanceExpense(StockReceipt $receipt, User $actor): void
    {
        $amount = $receipt->items->sum(fn ($item) => $item->unit_cost === null ? 0 : (float) $item->unit_cost * (float) $item->received_quantity);
        if ($amount <= 0) {
            return;
        }
        FinancialEntry::updateOrCreate(
            ['type' => 'expense', 'category' => FinancialEntry::CATEGORY_STOCK_RECEIPT, 'reference' => $receipt->receipt_number],
            ['recorded_by' => $actor->id, 'location_id' => $receipt->location_id, 'title' => "Stock receipt {$receipt->receipt_number}", 'amount' => round($amount, 2), 'entry_date' => $receipt->received_at?->toDateString() ?? now()->toDateString(), 'payment_method' => null, 'status' => 'approved', 'notes' => trim(implode("\n", array_filter([$receipt->supplier_reference ? "Supplier/reference: {$receipt->supplier_reference}" : null, $receipt->notes]))) ?: null]
        );
    }

    private function number(): string
    {
        do {
            $number = 'REC-'.now()->format('Ymd').'-'.strtoupper(Str::random(6));
        } while (StockReceipt::query()->where('receipt_number', $number)->exists());

        return $number;
    }
}
