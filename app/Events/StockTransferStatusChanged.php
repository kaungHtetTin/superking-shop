<?php

namespace App\Events;

use App\Models\StockTransfer;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

class StockTransferStatusChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;

    public bool $afterCommit = true;

    public int $transferId;

    public string $transferNumber;

    public string $status;

    public int $sourceLocationId;

    public int $destinationLocationId;

    public function __construct(StockTransfer $transfer)
    {
        $this->transferId = (int) $transfer->id;
        $this->transferNumber = $transfer->transfer_number;
        $this->status = $transfer->status;
        $this->sourceLocationId = (int) $transfer->source_location_id;
        $this->destinationLocationId = (int) $transfer->destination_location_id;
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("inventory.location.{$this->sourceLocationId}"),
            new PrivateChannel("inventory.location.{$this->destinationLocationId}"),
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
            'transfer_id' => $this->transferId,
            'transfer_number' => $this->transferNumber,
            'status' => $this->status,
            'source_location_id' => $this->sourceLocationId,
            'destination_location_id' => $this->destinationLocationId,
            'event_time' => now()->toIso8601String(),
        ];
    }
}
