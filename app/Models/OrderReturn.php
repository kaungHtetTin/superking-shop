<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderReturn extends Model
{
    use HasFactory;

    public const TYPES = ['return', 'refund', 'exchange'];

    public const STATUSES = ['requested', 'approved', 'rejected', 'received', 'refunded', 'completed'];

    protected $fillable = [
        'order_id',
        'order_item_id',
        'user_id',
        'type',
        'status',
        'quantity',
        'amount',
        'reason',
        'admin_notes',
        'processed_by',
        'processed_at',
        'inventory_movement_id',
        'restocked_by',
        'restocked_at',
    ];

    protected $casts = [
        'quantity' => 'decimal:4',
        'amount' => 'decimal:2',
        'processed_at' => 'datetime',
        'restocked_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class, 'order_item_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }

    public function restocker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'restocked_by');
    }

    public function inventoryMovement(): BelongsTo
    {
        return $this->belongsTo(InventoryMovement::class);
    }

    public function isProcessedStatus(): bool
    {
        return in_array($this->status, ['approved', 'rejected', 'received', 'refunded', 'completed'], true);
    }
}
