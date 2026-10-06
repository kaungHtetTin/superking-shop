<?php

namespace App\Services\Inventory;

use App\Events\InventoryBalanceChanged;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    public function ensureBalance(Location $location, Product $product): InventoryBalance
    {
        $now = now();
        DB::table('inventory_balances')->insertOrIgnore([
            'location_id' => $location->id,
            'product_id' => $product->id,
            'on_hand_qty' => 0,
            'reserved_qty' => 0,
            'version' => 0,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return InventoryBalance::query()->where('location_id', $location->id)->where('product_id', $product->id)->firstOrFail();
    }

    public function openingBalance(Location $location, Product $product, float $quantity, ?User $actor = null, ?string $idempotencyKey = null, ?string $notes = null, ?ProductUnit $unit = null, ?float $unitQuantity = null): InventoryMovement
    {
        if ($quantity < 0) {
            throw ValidationException::withMessages(['quantity' => 'Opening quantity cannot be negative.']);
        }

        return $this->mutate($location, $product, 'opening_balance', $quantity, 0, $actor, $idempotencyKey, null, 'opening_balance', $notes, $unit, $unitQuantity);
    }

    public function receive(Location $location, Product $product, float $quantity, ?User $actor = null, ?string $idempotencyKey = null, ?Model $reference = null, ?string $notes = null, ?ProductUnit $unit = null, ?float $unitQuantity = null): InventoryMovement
    {
        $this->requirePositive($quantity, 'Received quantity');

        return $this->mutate($location, $product, 'receipt', $quantity, 0, $actor, $idempotencyKey, $reference, 'receipt', $notes, $unit, $unitQuantity);
    }

    public function adjust(Location $location, Product $product, float $quantityDelta, string $reasonCode, ?User $actor = null, ?string $idempotencyKey = null, ?Model $reference = null, ?string $notes = null, ?ProductUnit $unit = null, ?float $unitQuantity = null): InventoryMovement
    {
        if (abs($quantityDelta) < 0.00005) {
            throw ValidationException::withMessages(['quantity' => 'Adjustment quantity cannot be zero.']);
        }

        return $this->mutate($location, $product, $quantityDelta > 0 ? 'adjustment_gain' : 'adjustment_loss', $quantityDelta, 0, $actor, $idempotencyKey, $reference, $reasonCode, $notes, $unit, $unitQuantity);
    }

    public function reserve(Location $location, Product $product, float $quantity, ?User $actor = null, ?string $idempotencyKey = null, ?Model $reference = null): InventoryMovement
    {
        $this->requirePositive($quantity, 'Reservation quantity');

        return $this->mutate($location, $product, 'reservation', 0, $quantity, $actor, $idempotencyKey, $reference, 'reservation');
    }

    public function releaseReservation(Location $location, Product $product, float $quantity, ?User $actor = null, ?string $idempotencyKey = null, ?Model $reference = null): InventoryMovement
    {
        $this->requirePositive($quantity, 'Released quantity');

        return $this->mutate($location, $product, 'reservation_release', 0, -$quantity, $actor, $idempotencyKey, $reference, 'reservation_release');
    }

    public function completeSale(Location $location, Product $product, float $quantity, float $reservedQuantity = 0, ?User $actor = null, ?string $idempotencyKey = null, ?Model $reference = null, ?ProductUnit $unit = null, ?float $unitQuantity = null): InventoryMovement
    {
        if ($quantity <= 0 || $reservedQuantity < 0 || $reservedQuantity > $quantity) {
            throw ValidationException::withMessages(['quantity' => 'Sale and reservation quantities are invalid.']);
        }

        return $this->mutate($location, $product, 'sale', -$quantity, -$reservedQuantity, $actor, $idempotencyKey, $reference, 'sale', null, $unit, $unitQuantity);
    }

    public function returnSale(Location $location, Product $product, float $quantity, ?User $actor = null, ?string $idempotencyKey = null, ?Model $reference = null, ?ProductUnit $unit = null, ?float $unitQuantity = null, ?float $baseCost = null): InventoryMovement
    {
        $this->requirePositive($quantity, 'Returned quantity');

        return DB::transaction(function () use ($location, $product, $quantity, $actor, $idempotencyKey, $reference, $unit, $unitQuantity, $baseCost) {
            $lockedProduct = Product::query()->whereKey($product->id)->lockForUpdate()->firstOrFail();
            $existing = $idempotencyKey && InventoryMovement::query()->where('idempotency_key', $idempotencyKey)->exists();
            $quantityBefore = (float) InventoryBalance::query()->where('product_id', $product->id)->sum('on_hand_qty');
            $movement = $this->mutate($location, $product, 'sale_return', $quantity, 0, $actor, $idempotencyKey, $reference, 'sale_return', null, $unit, $unitQuantity);
            if (! $existing && $baseCost !== null) {
                $lockedProduct->update(['original_price' => round(($quantityBefore * (float) $lockedProduct->original_price + $quantity * $baseCost)
                    / max($quantityBefore + $quantity, 0.000001), 6)]);
            }
            return $movement;
        }, 3);
    }

    public function shipTransfer(Location $source, Product $product, float $quantity, ?User $actor = null, ?string $idempotencyKey = null, ?Model $reference = null, ?string $notes = null, ?ProductUnit $unit = null, ?float $unitQuantity = null): InventoryMovement
    {
        $this->requirePositive($quantity, 'Shipped quantity');

        return $this->mutate($source, $product, 'transfer_out', -$quantity, 0, $actor, $idempotencyKey, $reference, 'transfer_out', $notes, $unit, $unitQuantity);
    }

    public function receiveTransfer(Location $destination, Product $product, float $quantity, ?User $actor = null, ?string $idempotencyKey = null, ?Model $reference = null, ?string $notes = null, ?ProductUnit $unit = null, ?float $unitQuantity = null): InventoryMovement
    {
        $this->requirePositive($quantity, 'Received quantity');

        return $this->mutate($destination, $product, 'transfer_in', $quantity, 0, $actor, $idempotencyKey, $reference, 'transfer_in', $notes, $unit, $unitQuantity);
    }

    private function mutate(Location $location, Product $product, string $type, float $quantityDelta, float $reservedDelta, ?User $actor, ?string $idempotencyKey, ?Model $reference, ?string $reasonCode, ?string $notes = null, ?ProductUnit $unit = null, ?float $unitQuantity = null): InventoryMovement
    {
        $quantityDelta = round($quantityDelta, 4);
        $reservedDelta = round($reservedDelta, 4);

        $result = DB::transaction(function () use ($location, $product, $type, $quantityDelta, $reservedDelta, $actor, $idempotencyKey, $reference, $reasonCode, $notes, $unit, $unitQuantity) {
            // Serialize quantity changes with product-wide receipt valuation.
            Product::query()->whereKey($product->id)->lockForUpdate()->firstOrFail();
            $this->ensureBalance($location, $product);
            $balance = InventoryBalance::query()->where('location_id', $location->id)->where('product_id', $product->id)->lockForUpdate()->firstOrFail();

            if ($idempotencyKey) {
                $existing = InventoryMovement::query()->where('idempotency_key', $idempotencyKey)->first();
                if ($existing) {
                    if ($existing->location_id !== $location->id || $existing->product_id !== $product->id || $existing->type !== $type || abs((float) $existing->quantity_delta - $quantityDelta) > 0.00005 || abs((float) $existing->reserved_delta - $reservedDelta) > 0.00005) {
                        throw ValidationException::withMessages(['idempotency_key' => 'This idempotency key was already used for a different inventory operation.']);
                    }

                    return ['movement' => $existing, 'created' => false];
                }
            }

            $onHandAfter = round((float) $balance->on_hand_qty + $quantityDelta, 4);
            $reservedAfter = round((float) $balance->reserved_qty + $reservedDelta, 4);
            if ($reservedAfter < -0.00005) {
                throw ValidationException::withMessages(['quantity' => 'Cannot release more stock than is reserved.']);
            }
            if (! config('inventory.allow_negative_stock', false) && $onHandAfter < -0.00005) {
                throw ValidationException::withMessages(['quantity' => 'Insufficient on-hand stock for this operation.']);
            }
            if (! config('inventory.allow_negative_stock', false) && $reservedAfter - $onHandAfter > 0.00005) {
                throw ValidationException::withMessages(['quantity' => 'Insufficient available stock for this operation.']);
            }

            $onHandBefore = (float) $balance->on_hand_qty;
            $reservedBefore = (float) $balance->reserved_qty;
            $balance->update(['on_hand_qty' => max(0, $onHandAfter), 'reserved_qty' => max(0, $reservedAfter), 'version' => $balance->version + 1]);

            $movement = InventoryMovement::create([
                'location_id' => $location->id,
                'product_id' => $product->id,
                'product_unit_id' => $unit?->id,
                'unit_quantity' => $unitQuantity,
                'conversion_factor' => $unit?->conversion_factor,
                'type' => $type,
                'quantity_delta' => $quantityDelta,
                'reserved_delta' => $reservedDelta,
                'on_hand_before' => $onHandBefore,
                'on_hand_after' => $onHandAfter,
                'reserved_before' => $reservedBefore,
                'reserved_after' => $reservedAfter,
                'reference_type' => $reference?->getMorphClass(),
                'reference_id' => $reference?->getKey(),
                'reason_code' => $reasonCode,
                'notes' => $notes,
                'created_by' => $actor?->id,
                'occurred_at' => now(),
                'idempotency_key' => $idempotencyKey,
            ]);

            return ['movement' => $movement, 'created' => true];
        }, 3);

        if ($result['created']) {
            InventoryBalanceChanged::dispatch($result['movement']);
        }

        return $result['movement'];
    }

    private function requirePositive(float $quantity, string $label): void
    {
        if ($quantity <= 0) {
            throw ValidationException::withMessages(['quantity' => "$label must be greater than zero."]);
        }
    }
}
