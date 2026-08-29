<?php

namespace App\Console\Commands;

use App\Models\InventoryReservation;
use App\Models\Order;
use App\Services\OrderManagementService;
use Illuminate\Console\Command;

class ExpireInventoryReservations extends Command
{
    protected $signature = 'inventory:expire-reservations {--limit=100 : Maximum orders to expire per run}';

    protected $description = 'Release expired online-order stock reservations';

    public function handle(OrderManagementService $orders): int
    {
        $orderIds = InventoryReservation::query()
            ->where('status', InventoryReservation::STATUS_ACTIVE)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->orderBy('expires_at')
            ->limit(max(1, (int) $this->option('limit')))
            ->pluck('order_id')
            ->unique();

        $expired = 0;
        foreach ($orderIds as $orderId) {
            $order = Order::query()->find($orderId);
            if (! $order || $order->status === 'cancelled' || $order->payment_status !== 'pending_review') {
                continue;
            }

            $orders->expireReservation($order);
            $expired++;
        }

        $this->info("Expired {$expired} online order reservation(s).");

        return self::SUCCESS;
    }
}
