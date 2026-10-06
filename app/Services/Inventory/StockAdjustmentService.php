<?php

namespace App\Services\Inventory;

use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\FinancialEntry;
use App\Models\Product;
use App\Models\Location;
use App\Models\ProductUnit;
use App\Models\StockAdjustment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StockAdjustmentService
{
    public function __construct(private InventoryService $inventoryService)
    {
    }

    public function createPosted(Location $location, array $lines, string $reasonCode, User $actor, ?string $notes = null): StockAdjustment
    {
        return DB::transaction(function () use ($location, $lines, $reasonCode, $actor, $notes) {
            $normalized = $this->normalizeLines($location, $lines, $reasonCode, $notes);
            $adjustment = StockAdjustment::create(['adjustment_number' => $this->number(), 'location_id' => $location->id, 'reason_code' => $reasonCode, 'status' => 'posted', 'notes' => $notes, 'requires_approval' => false, 'created_by' => $actor->id, 'posted_by' => $actor->id, 'posted_at' => now()]);
            foreach ($normalized as $line) {
                $item = $adjustment->items()->create($line);
                if (abs((float) $line['quantity_delta']) > 0.00005) {
                    $unit = ProductUnit::query()->with('product')->findOrFail($line['product_unit_id']);
                    $unitDelta = round((float) $line['quantity_delta'] / max((float) $unit->conversion_factor, 0.000001), 4);
                    $movement = $this->inventoryService->adjust($location, $unit->product, (float) $line['quantity_delta'], $reasonCode, $actor, "adjustment:{$adjustment->id}:item:{$item->id}", $adjustment, $line['notes'] ?? null, $unit, $unitDelta);
                    $item->update(['movement_id' => $movement->id]);
                    if ($reasonCode !== 'data_correction' && abs((float) $line['value_delta']) >= 0.01) {
                        FinancialEntry::create([
                            'recorded_by' => $actor->id,
                            'location_id' => $location->id,
                            'type' => $line['value_delta'] < 0 ? 'expense' : FinancialEntry::TYPE_ASSET,
                            'category' => FinancialEntry::CATEGORY_STOCK_ADJUSTMENT,
                            'title' => "Inventory adjustment {$adjustment->adjustment_number}",
                            'amount' => abs($line['value_delta']),
                            'entry_date' => $adjustment->posted_at->toDateString(),
                            'reference' => $adjustment->adjustment_number.':'.$item->id,
                            'status' => 'approved',
                            'notes' => $line['notes'] ?? $notes,
                        ]);
                    }
                }
            }

            return $adjustment->fresh(['items.product', 'items.unit', 'location']);
        }, 3);
    }

    /** Reverse an erroneous, unconsumed same-day count without changing its history. */
    public function undoPosted(StockAdjustment $adjustment, int $itemId, string $explanation, User $actor): void
    {
        DB::transaction(function () use ($adjustment, $itemId, $explanation, $actor) {
            $adjustment = StockAdjustment::query()->whereKey($adjustment->id)->lockForUpdate()->firstOrFail();
            $localTimeZone = $adjustment->location?->timezone ?: config('app.timezone', 'UTC');
            $postedToday = $adjustment->posted_at?->copy()->setTimezone($localTimeZone)->toDateString() === now($localTimeZone)->toDateString();
            if ($adjustment->status !== 'posted' || $adjustment->reversal_of_id || $adjustment->items()->count() !== 1 || ! $postedToday) {
                throw ValidationException::withMessages(['correction' => 'Only a single-item adjustment posted today (warehouse local time) can be undone here. Older or multi-item records need accountant review.']);
            }
            $item = $adjustment->items()->whereKey($itemId)->firstOrFail();
            $unit = $item->unit()->with('product')->firstOrFail();
            $movement = InventoryMovement::query()->whereKey($item->movement_id)->lockForUpdate()->firstOrFail();
            $currentCost = (float) Product::query()->whereKey($item->product_id)->lockForUpdate()->value('original_price');
            if (abs(round($currentCost, 2) - (float) $item->base_cost) > 0.00001) {
                throw ValidationException::withMessages(['correction' => 'Accounting cost changed since this adjustment. Review valuation before correcting it.']);
            }
            if (InventoryMovement::query()->where('product_id', $item->product_id)->where('id', '>', $movement->id)->exists()) {
                throw ValidationException::withMessages(['correction' => 'Later inventory activity exists for this product. Review sales, costs and the reporting period before correcting this record.']);
            }
            $entries = FinancialEntry::query()->where('category', FinancialEntry::CATEGORY_STOCK_ADJUSTMENT)
                ->where('reference', $adjustment->adjustment_number.':'.$item->id)->lockForUpdate()->get();
            $expectsEntry = $adjustment->reason_code !== 'data_correction' && abs((float) $item->value_delta) >= 0.01;
            if ($expectsEntry) {
                if ($entries->count() !== 1) {
                    throw ValidationException::withMessages(['correction' => 'The original finance entry is missing or duplicated. Reconcile it before undoing stock.']);
                }
                $entry = $entries->first();
                if ($entry->status !== 'approved'
                    || $entry->type !== ((float) $item->value_delta < 0 ? 'expense' : FinancialEntry::TYPE_ASSET)
                    || abs((float) $entry->amount - abs((float) $item->value_delta)) > 0.009) {
                    throw ValidationException::withMessages(['correction' => 'The original finance entry does not match this adjustment. Reconcile it before undoing stock.']);
                }
            } elseif ($entries->isNotEmpty()) {
                throw ValidationException::withMessages(['correction' => 'Unexpected finance entry found. Reconcile it before undoing stock.']);
            }
            $reversal = StockAdjustment::create([
                'adjustment_number' => $this->number(), 'location_id' => $adjustment->location_id,
                'reversal_of_id' => $adjustment->id, 'reason_code' => 'data_correction', 'status' => 'posted',
                'notes' => "Reversal of {$adjustment->adjustment_number}: {$explanation}",
                'requires_approval' => false, 'created_by' => $actor->id, 'posted_by' => $actor->id, 'posted_at' => now(),
            ]);
            $reverseDelta = - (float) $item->quantity_delta;
            $reverseMovement = $this->inventoryService->adjust($adjustment->location, $unit->product, $reverseDelta, 'data_correction', $actor,
                "adjustment:{$reversal->id}:reversal:{$item->id}", $reversal, $reversal->notes, $unit,
                round($reverseDelta / max((float) $unit->conversion_factor, 0.000001), 4));
            $reversal->items()->create([
                'product_id' => $item->product_id, 'product_unit_id' => $item->product_unit_id,
                'conversion_factor' => $item->conversion_factor, 'system_quantity' => $reverseMovement->on_hand_before,
                'counted_quantity' => round((float) $reverseMovement->on_hand_after / (float) $unit->conversion_factor, 4),
                'base_counted_quantity' => $reverseMovement->on_hand_after, 'quantity_delta' => $reverseDelta,
                'notes' => $reversal->notes, 'movement_id' => $reverseMovement->id,
                'base_cost' => $item->base_cost, 'value_delta' => round(- (float) $item->value_delta, 2),
            ]);
            if ($expectsEntry) {
                $entry->update(['status' => 'void', 'notes' => trim(($entry->notes ? $entry->notes."\n" : '')."Voided by {$reversal->adjustment_number}: {$explanation}")]);
            }
            $adjustment->update(['status' => 'reversed']);

        }, 3);
    }

    private function normalizeLines(Location $location, array $lines, string $reasonCode, ?string $notes): array
    {
        if (! array_key_exists($reasonCode, StockAdjustment::REASONS)) {
            throw ValidationException::withMessages(['reason_code' => 'Select a valid adjustment reason.']);
        }
        $seen = [];
        $normalized = [];
        foreach ($lines as $line) {
            $unit = ProductUnit::query()->with('product')->find((int) ($line['product_unit_id'] ?? 0));
            if (! $unit || isset($seen[$unit->product_id])) {
                throw ValidationException::withMessages(['items' => 'Adjustment products must be valid and unique.']);
            }
            $seen[$unit->product_id] = true;
            $product = Product::query()->whereKey($unit->product_id)->lockForUpdate()->firstOrFail();
            $this->inventoryService->ensureBalance($location, $unit->product);
            $balance = InventoryBalance::query()->where('location_id', $location->id)->where('product_id', $unit->product_id)->lockForUpdate()->firstOrFail();
            $system = (float) $balance->on_hand_qty;
            $counted = round((float) $line['counted_quantity'], 4);
            $baseCounted = $unit->toBaseQuantity($counted);
            if ($counted < 0 || $baseCounted < 0) {
                throw ValidationException::withMessages(['items' => 'Counted quantity cannot be negative.']);
            }
            $delta = round($baseCounted - $system, 4);
            if (abs($delta) < 0.00005) {
                throw ValidationException::withMessages(['items' => 'Counted quantity must differ from current stock.']);
            }
            if (in_array($reasonCode, ['damage', 'write_off'], true) && $delta > 0) {
                throw ValidationException::withMessages(['reason_code' => 'Damage and write-off can only reduce stock. Use Physical count for a surplus.']);
            }
            if (($delta < 0 || in_array($reasonCode, ['data_correction', 'other'], true)) && blank($line['notes'] ?? $notes)) {
                throw ValidationException::withMessages(['notes' => 'Please fill in the note above. It is required for this adjustment.']);
            }
            $normalized[] = ['product_id' => $unit->product_id, 'product_unit_id' => $unit->id, 'conversion_factor' => $unit->conversion_factor, 'system_quantity' => $system, 'counted_quantity' => $counted, 'base_counted_quantity' => $baseCounted, 'quantity_delta' => $delta, 'notes' => $line['notes'] ?? null];
            $normalized[array_key_last($normalized)]['base_cost'] = (float) $product->original_price;
            $normalized[array_key_last($normalized)]['value_delta'] = round($delta * (float) $product->original_price, 2);
        }
        if (! $normalized) {
            throw ValidationException::withMessages(['items' => 'Add at least one adjustment item.']);
        }

        return $normalized;
    }

    private function number(): string
    {
        do {
            $number = 'ADJ-'.now()->format('Ymd').'-'.strtoupper(Str::random(6));
        } while (StockAdjustment::query()->where('adjustment_number', $number)->exists());

        return $number;
    }
}
