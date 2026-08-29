<?php

namespace App\Services\Inventory;

use App\Models\InventoryBalance;
use App\Models\InventoryStockAlert;
use App\Models\User;
use App\Notifications\LowStockDigest;
use Illuminate\Support\Facades\Notification;

class LowStockAlertService
{
    /** @return array{open:int,resolved:int,notified:int} */
    public function scanAndNotify(): array
    {
        $balances = InventoryBalance::query()
            ->with(['location', 'product'])
            ->whereHas('product', fn ($query) => $query->where('min_quantity', '>', 0))
            ->get();
        $activeAlertIds = [];

        foreach ($balances as $balance) {
            $available = $balance->available_qty;
            $type = $available <= 0 ? 'out_of_stock' : ($available <= (float) $balance->product->min_quantity ? 'low_stock' : null);
            if (! $type) {
                continue;
            }

            $alert = InventoryStockAlert::firstOrNew([
                'inventory_balance_id' => $balance->id,
                'type' => $type,
            ]);
            $wasOpen = $alert->exists && $alert->status === 'open';
            $alert->fill([
                'location_id' => $balance->location_id,
                'product_id' => $balance->product_id,
                'status' => 'open',
                'available_qty' => $available,
                'min_quantity' => $balance->product->min_quantity,
                'detected_at' => $wasOpen ? $alert->detected_at : now(),
                'resolved_at' => null,
                'last_notified_at' => $wasOpen ? $alert->last_notified_at : null,
            ])->save();
            $activeAlertIds[] = $alert->id;
        }

        $resolved = InventoryStockAlert::query()
            ->where('status', 'open')
            ->when($activeAlertIds, fn ($query) => $query->whereNotIn('id', $activeAlertIds))
            ->update(['status' => 'resolved', 'resolved_at' => now()]);

        $due = InventoryStockAlert::query()
            ->with(['location', 'product'])
            ->where('status', 'open')
            ->where(fn ($query) => $query->whereNull('last_notified_at')->orWhere('last_notified_at', '<=', now()->subDay()))
            ->get();
        $notifiedAlertIds = [];

        if ($due->isNotEmpty()) {
            $recipients = User::query()
                ->adminStaff()
                ->where('status', 'active')
                ->with(['roles.permissions', 'locations'])
                ->get()
                ->filter(fn (User $user) => $user->hasAdminPermission('reports.inventory'));

            foreach ($recipients as $recipient) {
                $locationIds = $recipient->accessibleLocationIds();
                $recipientAlerts = $due->whereIn('location_id', $locationIds)->values();
                if ($recipientAlerts->isEmpty()) {
                    continue;
                }

                Notification::send($recipient, new LowStockDigest($recipientAlerts));
                $notifiedAlertIds = array_merge($notifiedAlertIds, $recipientAlerts->pluck('id')->all());
            }
        }

        $notifiedAlertIds = array_values(array_unique($notifiedAlertIds));
        if ($notifiedAlertIds) {
            InventoryStockAlert::query()->whereIn('id', $notifiedAlertIds)->update(['last_notified_at' => now()]);
        }

        return [
            'open' => InventoryStockAlert::query()->where('status', 'open')->count(),
            'resolved' => $resolved,
            'notified' => count($notifiedAlertIds),
        ];
    }
}
