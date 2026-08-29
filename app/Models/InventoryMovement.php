<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class InventoryMovement extends Model
{
    use HasFactory;

    protected $fillable = [
        'location_id',
        'product_id',
        'product_unit_id',
        'type',
        'unit_quantity',
        'conversion_factor',
        'quantity_delta',
        'reserved_delta',
        'on_hand_before',
        'on_hand_after',
        'reserved_before',
        'reserved_after',
        'reference_type',
        'reference_id',
        'reason_code',
        'notes',
        'created_by',
        'occurred_at',
        'idempotency_key',
    ];

    protected $casts = [
        'unit_quantity' => 'decimal:4',
        'conversion_factor' => 'decimal:6',
        'quantity_delta' => 'decimal:4',
        'reserved_delta' => 'decimal:4',
        'on_hand_before' => 'decimal:4',
        'on_hand_after' => 'decimal:4',
        'reserved_before' => 'decimal:4',
        'reserved_after' => 'decimal:4',
        'occurred_at' => 'datetime',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(ProductUnit::class, 'product_unit_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reference(): MorphTo
    {
        return $this->morphTo();
    }
}
