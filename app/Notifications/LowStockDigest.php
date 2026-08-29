<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection;

class LowStockDigest extends Notification
{
    use Queueable;

    public function __construct(private Collection $alerts)
    {
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $outOfStock = $this->alerts->where('type', 'out_of_stock')->count();

        return [
            'type' => 'inventory_low_stock_digest',
            'total' => $this->alerts->count(),
            'out_of_stock' => $outOfStock,
            'low_stock' => $this->alerts->count() - $outOfStock,
            'message' => $this->alerts->count().' inventory item(s) are at or below their minimum quantity.',
            'alerts' => $this->alerts->take(25)->map(fn ($alert) => [
                'alert_id' => $alert->id,
                'location' => $alert->location?->name,
                'product_code' => $alert->product?->product_code,
                'product' => $alert->product?->name,
                'available_qty' => $alert->available_qty,
                'min_quantity' => $alert->min_quantity,
                'severity' => $alert->type,
            ])->values()->all(),
        ];
    }
}
