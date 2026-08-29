<?php

namespace App\Services\Inventory;

use App\Models\InventoryBalance;
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
            $normalized = $this->normalizeLines($location, $lines);
            $adjustment = StockAdjustment::create(['adjustment_number' => $this->number(), 'location_id' => $location->id, 'reason_code' => $reasonCode, 'status' => 'posted', 'notes' => $notes, 'requires_approval' => false, 'created_by' => $actor->id, 'posted_by' => $actor->id, 'posted_at' => now()]);
            foreach ($normalized as $line) {
                $item = $adjustment->items()->create($line);
                if (abs((float) $line['quantity_delta']) > 0.00005) {
                    $unit = ProductUnit::query()->with('product')->findOrFail($line['product_unit_id']);
                    $unitDelta = round((float) $line['quantity_delta'] / max((float) $unit->conversion_factor, 0.000001), 4);
                    $movement = $this->inventoryService->adjust($location, $unit->product, (float) $line['quantity_delta'], $reasonCode, $actor, "adjustment:{$adjustment->id}:item:{$item->id}", $adjustment, $line['notes'] ?? null, $unit, $unitDelta);
                    $item->update(['movement_id' => $movement->id]);
                }
            }

            return $adjustment->fresh(['items.product', 'items.unit', 'location']);
        }, 3);
    }

    private function normalizeLines(Location $location, array $lines): array
    {
        $seen = [];
        $normalized = [];
        foreach ($lines as $line) {
            $unit = ProductUnit::query()->with('product')->find((int) ($line['product_unit_id'] ?? 0));
            if (! $unit || isset($seen[$unit->product_id])) {
                throw ValidationException::withMessages(['items' => 'Adjustment products must be valid and unique.']);
            }
            $seen[$unit->product_id] = true;
            $counted = round((float) $line['counted_quantity'], 4);
            if ($counted < 0) {
                throw ValidationException::withMessages(['items' => 'Counted quantity cannot be negative.']);
            }
            $this->inventoryService->ensureBalance($location, $unit->product);
            $balance = InventoryBalance::query()->where('location_id', $location->id)->where('product_id', $unit->product_id)->lockForUpdate()->firstOrFail();
            $system = (float) $balance->on_hand_qty;
            $baseCounted = $unit->toBaseQuantity($counted);
            $delta = round($baseCounted - $system, 4);
            if ($delta < 0 && blank($line['notes'] ?? null)) {
                throw ValidationException::withMessages(['items' => 'A note is required for stock losses.']);
            }
            $normalized[] = ['product_id' => $unit->product_id, 'product_unit_id' => $unit->id, 'conversion_factor' => $unit->conversion_factor, 'system_quantity' => $system, 'counted_quantity' => $counted, 'base_counted_quantity' => $baseCounted, 'quantity_delta' => $delta, 'notes' => $line['notes'] ?? null];
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
