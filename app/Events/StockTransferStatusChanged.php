<?php

namespace App\Events;

use App\Models\StockTransfer;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class StockTransferStatusChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public bool $afterCommit = true;

    public StockTransfer $transfer;

    public function __construct(StockTransfer $transfer)
    {
        $this->transfer = clone $transfer;
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("inventory.location.{$this->transfer->source_location_id}"),
            new PrivateChannel("inventory.location.{$this->transfer->destination_location_id}"),
            new PrivateChannel('inventory.all'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'inventory.transfer.status.changed';
    }

    public function broadcastWith(): array
    {
        return [
            'transfer_id' => $this->transfer->id,
            'transfer_number' => $this->transfer->transfer_number,
            'status' => $this->transfer->status,
            'source_location_id' => $this->transfer->source_location_id,
            'destination_location_id' => $this->transfer->destination_location_id,
            'event_time' => now()->toIso8601String(),
        ];
    }
}
