<?php

namespace App\Notifications;

use App\Models\StockAdjustment;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class LargeStockAdjustmentSubmitted extends Notification
{
    use Queueable;

    public function __construct(private StockAdjustment $adjustment)
    {
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $this->adjustment->loadMissing(['location:id,name', 'items']);

        return [
            'adjustment_id' => $this->adjustment->id,
            'adjustment_number' => $this->adjustment->adjustment_number,
            'location_name' => $this->adjustment->location->name,
            'quantity_delta' => $this->adjustment->items->sum('quantity_delta'),
            'absolute_quantity' => $this->adjustment->items->sum(fn ($item) => abs($item->quantity_delta)),
            'message' => 'A stock adjustment exceeded the configured approval threshold.',
        ];
    }
}
