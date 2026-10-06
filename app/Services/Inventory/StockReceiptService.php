<?php

namespace App\Services\Inventory;

use App\Models\FinancialEntry;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\Location;
use App\Models\ProductUnit;
use App\Models\StockReceipt;
use App\Models\StockReceiptCorrection;
use App\Models\StockReceiptItem;
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
            app(\App\Services\AutomaticPricingService::class)->lock();
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
            app(\App\Services\AutomaticPricingService::class)->lock();
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

    public function post(StockReceipt $receipt, User $actor, bool $acknowledgeBelowCost = false): StockReceipt
    {
        return DB::transaction(function () use ($receipt, $actor, $acknowledgeBelowCost) {
            $pricing = app(\App\Services\AutomaticPricingService::class);
            $pricing->lock();
            $locked = StockReceipt::query()->lockForUpdate()->findOrFail($receipt->id);
            if ($locked->status === 'posted') {
                return $locked->load(['items.product', 'items.unit']);
            }
            if ($locked->status !== 'draft') {
                throw ValidationException::withMessages(['receipt' => 'Only a draft receipt can be posted.']);
            }
            $locked->load(['items.product', 'items.unit', 'location']);
            foreach ($locked->items->sortBy('product_id') as $item) {
                $product = Product::query()->lockForUpdate()->findOrFail($item->product_id);
                if ($item->unit_cost === null) {
                    throw ValidationException::withMessages(['items' => 'Enter a cost for every receipt line (use zero for free stock).']);
                }
                $previousCost = (float) $product->original_price;
                if ($product->pricing_base_cost === null) $product->update(['pricing_base_cost' => $product->original_price]);
                $quantityBefore = (float) InventoryBalance::query()->where('product_id', $product->id)->sum('on_hand_qty');
                // The application carries one cost per product across warehouses.
                // Weight the incoming cost so a purchase does not reprice old stock.
                $appliedCost = round(($quantityBefore * $previousCost + (float) $item->unit_cost * (float) $item->received_quantity)
                    / max($quantityBefore + (float) $item->base_quantity, 0.000001), 6);
                $movement = $this->inventoryService->receive($locked->location, $item->product, (float) $item->base_quantity, $actor, "receipt:{$locked->id}:item:{$item->id}", $locked, $item->notes, $item->unit, ((float) $item->received_quantity + (float) $item->free_quantity));
                $item->update(['movement_id' => $movement->id, 'previous_base_cost' => $previousCost, 'applied_base_cost' => $appliedCost]);
                $product->update(['original_price' => $appliedCost]);
            }
            $locked->update(['status' => 'posted', 'received_by' => $actor->id, 'received_at' => now()]);
            $this->recordInventoryAsset($locked, $actor);

            $summary = ['changed_row_count' => 0, 'skipped_cost_count' => 0, 'price_changes' => []];
            $warnings = [];
            foreach ($locked->items as $item) {
                $result = $pricing->refreshProduct($item->product, 'purchase_post', $actor->id, 'receipt:'.$locked->id);
                $summary['changed_row_count'] += $result['changed_row_count'];
                $summary['skipped_cost_count'] += $result['skipped_cost_count'];
                $summary['price_changes'] = array_merge($summary['price_changes'], $result['price_changes']);
                $warnings = array_merge($warnings, $pricing->belowCostWarnings($item->product->fresh()));
            }
            if ($warnings && ! $acknowledgeBelowCost) {
                throw ValidationException::withMessages(['acknowledge_below_cost' => implode(' ', $warnings).' Review items or choose Save anyway.']);
            }
            return $locked->fresh(['items.product', 'items.unit', 'location'])->setAttribute('pricing_summary', $summary);
        }, 3);
    }

    public function delete(StockReceipt $receipt, User $actor): array
    {
        return DB::transaction(function () use ($receipt, $actor) {
            $pricing = app(\App\Services\AutomaticPricingService::class);
            $pricing->lock();
            $locked = StockReceipt::query()->lockForUpdate()->with(['items.product', 'items.unit', 'location'])->findOrFail($receipt->id);
            if (! in_array($locked->status, ['draft', 'posted'], true)) {
                throw ValidationException::withMessages(['receipt' => 'Only draft or posted receipts can be deleted.']);
            }
            if ($locked->status === 'posted') {
                if ($locked->corrections()->exists()) {
                    throw ValidationException::withMessages(['receipt' => 'This receipt has correction history and cannot be deleted.']);
                }
                foreach ($locked->items->sortBy('product_id') as $item) {
                    $product = Product::query()->lockForUpdate()->findOrFail($item->product_id);
                    if ($item->previous_base_cost === null || $item->applied_base_cost === null || ! $item->movement_id) {
                        throw ValidationException::withMessages(['receipt' => 'This legacy receipt has no cost snapshot. Reconcile its cost before reversing it.']);
                    }
                    $laterActivity = InventoryMovement::query()->where('product_id', $item->product_id)
                        ->where('id', '>', $item->movement_id)->where('quantity_delta', '!=', 0)->exists();
                    if ($laterActivity || abs((float) $product->original_price - (float) $item->applied_base_cost) > 0.009) {
                        throw ValidationException::withMessages(['receipt' => 'Later stock or cost changes depend on this receipt. Use a documented stock/cost correction instead.']);
                    }
                    $this->inventoryService->adjust($locked->location, $item->product, -1 * (float) $item->base_quantity, 'receipt_delete', $actor, "receipt-delete:{$locked->id}:item:{$item->id}", $locked, "Deleted receipt {$locked->receipt_number}.", $item->unit, -1 * ((float) $item->received_quantity + (float) $item->free_quantity));
                    $product->update(['original_price' => $item->previous_base_cost]);
                }
            }
            FinancialEntry::query()->where('category', FinancialEntry::CATEGORY_STOCK_RECEIPT)->where('reference', $locked->receipt_number)->delete();
            $locked->delete();
            $summary = ['changed_row_count' => 0, 'skipped_cost_count' => 0, 'price_changes' => []];
            foreach ($locked->items as $item) {
                $result = $pricing->refreshProduct($item->product, 'purchase_delete', $actor->id, 'receipt-delete:'.$locked->id);
                $summary['changed_row_count'] += $result['changed_row_count'];
                $summary['skipped_cost_count'] += $result['skipped_cost_count'];
                $summary['price_changes'] = array_merge($summary['price_changes'], $result['price_changes']);
            }
            return $summary;
        }, 3);
    }

    /** Correct a posted receipt only while its stock and cost have no dependent activity. */
    public function correctPostedItem(StockReceipt $receipt, StockReceiptItem $item, array $values, User $actor): StockReceiptCorrection
    {
        return DB::transaction(function () use ($receipt, $item, $values, $actor) {
            $pricing = app(\App\Services\AutomaticPricingService::class);
            $pricing->lock();
            $locked = StockReceipt::query()->lockForUpdate()->with('location')->findOrFail($receipt->id);
            if ($locked->status !== 'posted') {
                throw ValidationException::withMessages(['receipt' => 'Only posted receipts can be corrected.']);
            }
            $line = StockReceiptItem::query()->where('stock_receipt_id', $locked->id)->lockForUpdate()->findOrFail($item->id);
            $product = Product::query()->lockForUpdate()->findOrFail($line->product_id);
            $unit = ProductUnit::query()->findOrFail($line->product_unit_id);
            if (! $line->movement_id || $line->previous_base_cost === null || $line->applied_base_cost === null || $line->unit_cost === null) {
                throw ValidationException::withMessages(['receipt' => 'This legacy receipt has no complete cost snapshot and needs manual reconciliation.']);
            }
            $ownCorrectionMovements = $locked->corrections()->where('stock_receipt_item_id', $line->id)->whereNotNull('movement_id')->pluck('movement_id');
            if (InventoryMovement::query()->where('product_id', $product->id)->where('id', '>', $line->movement_id)
                ->when($ownCorrectionMovements->isNotEmpty(), fn ($query) => $query->whereNotIn('id', $ownCorrectionMovements))
                ->where('quantity_delta', '!=', 0)->exists()
                || abs((float) $product->original_price - (float) $line->applied_base_cost) > 0.009) {
                throw ValidationException::withMessages(['receipt' => 'Later stock or cost changes depend on this receipt. Reconcile those records before correcting it.']);
            }

            $paid = round((float) $values['received_quantity'], 4);
            $free = round((float) $values['free_quantity'], 4);
            $cost = round((float) $values['unit_cost'], 2);
            if ($paid < 0 || $free < 0 || $paid + $free <= 0 || $cost < 0) {
                throw ValidationException::withMessages(['items' => 'Enter a positive total quantity and a non-negative unit cost.']);
            }
            $oldPaid = (float) $line->received_quantity;
            $oldFree = (float) $line->free_quantity;
            $oldCost = (float) $line->unit_cost;
            $oldBase = (float) $line->base_quantity;
            $newBase = $unit->toBaseQuantity($paid + $free);
            $delta = round($newBase - $oldBase, 4);
            $amountDelta = round($paid * $cost - $oldPaid * $oldCost, 2);
            if (abs($delta) < 0.00005 && abs($amountDelta) < 0.005 && abs($paid - $oldPaid) < 0.00005 && abs($free - $oldFree) < 0.00005) {
                throw ValidationException::withMessages(['items' => 'Change quantity or cost before saving a correction.']);
            }

            $reason = $values['reason'];
            if ($reason === 'supplier_bonus' && (abs($paid - $oldPaid) >= 0.00005 || abs($amountDelta) >= 0.005 || $free <= $oldFree)) {
                throw ValidationException::withMessages(['reason' => 'Supplier bonus must add free quantity without changing paid quantity or purchase amount.']);
            }
            if ($reason === 'purchase_error' && abs($amountDelta) < 0.005) {
                throw ValidationException::withMessages(['reason' => 'A purchase-cost correction must change the paid purchase amount. Use supplier bonus for free items.']);
            }
            $quantityBeforeReceipt = (float) InventoryBalance::query()->where('product_id', $product->id)->sum('on_hand_qty') - $oldBase;
            if ($quantityBeforeReceipt < -0.00005) {
                throw ValidationException::withMessages(['receipt' => 'Current stock cannot be reconciled with this receipt.']);
            }
            $appliedCost = round(($quantityBeforeReceipt * (float) $line->previous_base_cost + $paid * $cost)
                / max($quantityBeforeReceipt + $newBase, 0.000001), 6);

            $correction = StockReceiptCorrection::create([
                'stock_receipt_id' => $locked->id,
                'stock_receipt_item_id' => $line->id,
                'created_by' => $actor->id,
                'reason' => $reason,
                'notes' => trim($values['notes']),
                'old_received_quantity' => $oldPaid,
                'new_received_quantity' => $paid,
                'old_free_quantity' => $oldFree,
                'new_free_quantity' => $free,
                'old_unit_cost' => $oldCost,
                'new_unit_cost' => $cost,
                'old_applied_base_cost' => $line->applied_base_cost,
                'new_applied_base_cost' => $appliedCost,
                'purchase_amount_delta' => $amountDelta,
            ]);
            if (abs($delta) >= 0.00005) {
                $movement = $this->inventoryService->adjust($locked->location, $product, $delta, 'receipt_correction', $actor,
                    "receipt-correction:{$correction->id}", $correction, $correction->notes, $unit, round($delta / max((float) $unit->conversion_factor, 0.000001), 4));
                $correction->update(['movement_id' => $movement->id]);
            }
            $line->update([
                'received_quantity' => $paid,
                'free_quantity' => $free,
                'base_quantity' => $newBase,
                'unit_cost' => $cost,
                'applied_base_cost' => $appliedCost,
            ]);
            $product->update(['original_price' => $appliedCost]);
            $locked->load('items');
            $this->recordInventoryAsset($locked, $actor);
            $pricing->refreshProduct($product->fresh(), 'purchase_correction', $actor->id, 'receipt-correction:'.$correction->id);

            return $correction->fresh();
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
            $free = (string) ($line['free_quantity'] ?? '0');
            if (! is_numeric($free) || (float) $free < 0) throw ValidationException::withMessages(['items' => 'Free quantity cannot be negative.']);
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
                'free_quantity' => $free,
                'base_quantity' => $unit->toBaseQuantity($quantity + (float) $free),
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

    private function recordInventoryAsset(StockReceipt $receipt, User $actor): void
    {
        $amount = $receipt->items->sum(fn ($item) => $item->unit_cost === null ? 0 : (float) $item->unit_cost * (float) $item->received_quantity);
        if ($amount <= 0) {
            FinancialEntry::query()->where('category', FinancialEntry::CATEGORY_STOCK_RECEIPT)->where('reference', $receipt->receipt_number)->delete();
            return;
        }
        $entry = FinancialEntry::firstOrNew(['category' => FinancialEntry::CATEGORY_STOCK_RECEIPT, 'reference' => $receipt->receipt_number]);
        if (! $entry->exists) {
            $entry->recorded_by = $actor->id;
        }
        $entry->fill(['type' => FinancialEntry::TYPE_ASSET, 'location_id' => $receipt->location_id, 'title' => "Inventory purchase {$receipt->receipt_number}", 'amount' => round($amount, 2), 'entry_date' => $receipt->received_at?->toDateString() ?? now()->toDateString(), 'payment_method' => null, 'status' => 'approved', 'notes' => trim(implode("\n", array_filter([$receipt->supplier_reference ? "Supplier/reference: {$receipt->supplier_reference}" : null, $receipt->notes]))) ?: null]);
        $entry->save();
    }

    private function number(): string
    {
        do {
            $number = 'REC-'.now()->format('Ymd').'-'.strtoupper(Str::random(6));
        } while (StockReceipt::query()->where('receipt_number', $number)->exists());

        return $number;
    }
}
