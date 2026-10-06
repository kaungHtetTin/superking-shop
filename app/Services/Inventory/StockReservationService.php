<?php

namespace App\Services\Inventory;

use App\Models\InventoryReservation;
use App\Models\Location;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockReservationService
{
    public function __construct(private InventoryService $inventoryService)
    {
    }

    public function reserveOrderItem(OrderItem $item, Location $location, ?User $actor = null): InventoryReservation
    {
        return DB::transaction(function () use ($item, $location, $actor) {
            $existing = InventoryReservation::query()->where('order_item_id', $item->id)->lockForUpdate()->first();
            if ($existing) {
                if ($existing->status === InventoryReservation::STATUS_ACTIVE) {
                    return $existing;
                }
                throw ValidationException::withMessages(['order' => 'This order item reservation is no longer active.']);
            }

            $item->loadMissing(['product', 'order']);
            if (! $item->product) {
                throw ValidationException::withMessages(['order' => 'An order item has no product.']);
            }

            $this->inventoryService->reserve($location, $item->product, (float) $item->base_quantity, $actor, "online:reserve:item:{$item->id}", $item->order);

            return InventoryReservation::create([
                'order_id' => $item->order_id,
                'order_item_id' => $item->id,
                'location_id' => $location->id,
                'product_id' => $item->product_id,
                'quantity' => $item->base_quantity,
                'status' => InventoryReservation::STATUS_ACTIVE,
                'expires_at' => now()->addMinutes((int) config('inventory.online_reservation_timeout_minutes', 120)),
            ]);
        }, 3);
    }

    public function ensureForOrder(Order $order, ?User $actor = null): void
    {
        $order->loadMissing(['location', 'items.product', 'reservations']);
        if (! $order->location) {
            throw ValidationException::withMessages(['order' => 'This order has no fulfillment location.']);
        }

        $reservations = $order->reservations->keyBy('order_item_id');
        foreach ($order->items->sortBy('product_id') as $item) {
            $reservation = $reservations->get($item->id);
            if ($reservation?->status === InventoryReservation::STATUS_ACTIVE) {
                continue;
            }
            if ($reservation) {
                throw ValidationException::withMessages(['order' => 'This order reservation has already been released.']);
            }
            $this->reserveOrderItem($item, $order->location, $actor);
        }
    }

    public function convertOrder(Order $order, ?User $actor = null): void
    {
        DB::transaction(function () use ($order, $actor) {
            $order->loadMissing(['location', 'items.product', 'items.unit']);
            $reservations = InventoryReservation::query()
                ->where('order_id', $order->id)
                ->where('status', InventoryReservation::STATUS_ACTIVE)
                ->orderBy('product_id')
                ->lockForUpdate()
                ->get();
            $reservableItems = $order->items->where('is_preorder', false);
            if ($reservations->count() !== $reservableItems->count()) {
                throw ValidationException::withMessages(['order' => 'The order does not have a complete active stock reservation.']);
            }

            foreach ($reservations as $reservation) {
                $item = $order->items->firstWhere('id', $reservation->order_item_id);
                $product = \App\Models\Product::query()->whereKey($item->product_id)->lockForUpdate()->firstOrFail();
                // Snapshot cost when stock leaves, not when a pending cart reserved it.
                $item->update(['cost_price' => round((float) $product->original_price * (float) $item->conversion_factor, 6)]);
                $this->inventoryService->completeSale(
                    $order->location,
                    $item->product,
                    (float) $reservation->quantity,
                    (float) $reservation->quantity,
                    $actor,
                    "online:sale:item:{$item->id}",
                    $order,
                    $item->unit,
                    (float) $item->quantity
                );
                $reservation->update(['status' => InventoryReservation::STATUS_CONVERTED, 'converted_at' => now(), 'expires_at' => null]);
            }
        }, 3);
    }

    public function releaseOrder(Order $order, ?User $actor = null, string $reason = 'Order cancelled', string $status = InventoryReservation::STATUS_RELEASED): void
    {
        if (! in_array($status, [InventoryReservation::STATUS_RELEASED, InventoryReservation::STATUS_EXPIRED], true)) {
            throw new \InvalidArgumentException('Invalid reservation release status.');
        }

        DB::transaction(function () use ($order, $actor, $reason, $status) {
            $reservations = InventoryReservation::query()
                ->with(['location', 'product'])
                ->where('order_id', $order->id)
                ->where('status', InventoryReservation::STATUS_ACTIVE)
                ->orderBy('product_id')
                ->lockForUpdate()
                ->get();
            foreach ($reservations as $reservation) {
                $this->inventoryService->releaseReservation($reservation->location, $reservation->product, (float) $reservation->quantity, $actor, "online:release:item:{$reservation->order_item_id}", $order);
                $reservation->update(['status' => $status, 'released_at' => now(), 'expires_at' => null, 'release_reason' => $reason]);
            }
        }, 3);
    }
}
