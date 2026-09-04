<?php

namespace App\Services\Inventory;

use App\Events\StockTransferStatusChanged;
use App\Models\InventoryBalance;
use App\Models\FinancialEntry;
use App\Models\Location;
use App\Models\ProductUnit;
use App\Models\StockTransfer;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StockTransferService
{
    public function __construct(private InventoryService $inventoryService)
    {
    }

    public function createDraft(Location $source, Location $destination, array $lines, User $actor): StockTransfer
    {
        return $this->transferNow($source, $destination, $lines, $actor);
    }

    public function transferNow(Location $source, Location $destination, array $lines, User $actor, array $details = []): StockTransfer
    {
        if ($source->id === $destination->id) {
            throw ValidationException::withMessages(['destination_location_id' => 'Source and destination must be different.']);
        }
        $transfer = DB::transaction(function () use ($source, $destination, $lines, $actor, $details) {
            $now = now();
            $normalizedLines = $this->normalizeLines($source, $lines);
            $totalAmount = round(collect($normalizedLines)->sum('line_total'), 2);
            $transfer = StockTransfer::create(['transfer_number' => $this->number(), 'source_location_id' => $source->id, 'destination_location_id' => $destination->id, 'status' => 'received', 'total_amount' => $totalAmount, 'notes' => $details['notes'] ?? null, 'created_by' => $actor->id, 'shipped_by' => $actor->id, 'received_by' => $actor->id, 'shipped_at' => $now, 'received_at' => $now]);
            foreach ($normalizedLines as $line) {
                $item = $transfer->items()->create(array_merge($line, ['shipped_quantity' => $line['requested_quantity'], 'received_quantity' => $line['requested_quantity']]));
                $unit = ProductUnit::query()->with('product')->findOrFail($line['product_unit_id']);
                $out = $this->inventoryService->shipTransfer($source, $unit->product, (float) $line['requested_base_quantity'], $actor, "transfer:{$transfer->id}:out:item:{$item->id}", $transfer, null, $unit, (float) $line['requested_quantity']);
                $in = $this->inventoryService->receiveTransfer($destination, $unit->product, (float) $line['requested_base_quantity'], $actor, "transfer:{$transfer->id}:in:item:{$item->id}", $transfer, null, $unit, (float) $line['requested_quantity']);
                $item->update(['transfer_out_movement_id' => $out->id, 'transfer_in_movement_id' => $in->id]);
            }

            $financeBase = [
                'stock_transfer_id' => $transfer->id,
                'recorded_by' => $actor->id,
                'category' => FinancialEntry::CATEGORY_INTERNAL_TRANSFER,
                'amount' => $totalAmount,
                'entry_date' => $now->toDateString(),
                'reference' => $transfer->transfer_number,
                'status' => 'approved',
                'notes' => $details['notes'] ?? null,
            ];

            FinancialEntry::create(array_merge($financeBase, [
                'location_id' => $source->id,
                'type' => 'income',
                'title' => "Transfer income {$transfer->transfer_number}",
            ]));
            FinancialEntry::create(array_merge($financeBase, [
                'location_id' => $destination->id,
                'type' => 'expense',
                'category' => FinancialEntry::CATEGORY_STOCK_RECEIPT,
                'title' => "Stock expense {$transfer->transfer_number}",
            ]));

            return $transfer->load(['items.product', 'items.unit']);
        }, 3);
        StockTransferStatusChanged::dispatch($transfer);

        return $transfer;
    }

    private function normalizeLines(Location $source, array $lines): array
    {
        $seen = [];
        $normalized = [];
        foreach ($lines as $line) {
            $unit = ProductUnit::query()->with('product')->find((int) ($line['product_unit_id'] ?? 0));
            if (! $unit || isset($seen[$unit->product_id])) {
                throw ValidationException::withMessages(['items' => 'Transfer products must be valid and unique.']);
            }
            $seen[$unit->product_id] = true;
            $quantity = round((float) $line['requested_quantity'], 4);
            if ($quantity <= 0) {
                throw ValidationException::withMessages(['items' => 'Every transfer line needs a positive quantity.']);
            }
            $baseQuantity = $unit->toBaseQuantity($quantity);
            $available = (float) (InventoryBalance::query()->where('location_id', $source->id)->where('product_id', $unit->product_id)->first()?->available_qty ?? 0);
            if ($baseQuantity > $available + 0.00005) {
                throw ValidationException::withMessages(['items' => "Requested quantity for {$unit->product->product_code} exceeds available base stock ({$available})."]);
            }
            $normalized[] = ['product_id' => $unit->product_id, 'product_unit_id' => $unit->id, 'conversion_factor' => $unit->conversion_factor, 'requested_quantity' => $quantity, 'requested_base_quantity' => $baseQuantity];
            $normalized[array_key_last($normalized)]['unit_cost'] = round((float) $unit->product->original_price * (float) $unit->conversion_factor, 2);
            $normalized[array_key_last($normalized)]['line_total'] = round((float) $unit->product->original_price * $baseQuantity, 2);
        }
        if (! $normalized) {
            throw ValidationException::withMessages(['items' => 'Add at least one transfer item.']);
        }

        return $normalized;
    }

    private function number(): string
    {
        do {
            $number = 'TRF-'.now()->format('Ymd').'-'.strtoupper(Str::random(6));
        } while (StockTransfer::query()->where('transfer_number', $number)->exists());

        return $number;
    }
}
