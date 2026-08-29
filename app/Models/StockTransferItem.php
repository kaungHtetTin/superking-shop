<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockTransferItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'stock_transfer_id',
        'product_id',
        'product_unit_id',
        'conversion_factor',
        'requested_quantity',
        'requested_base_quantity',
        'shipped_quantity',
        'received_quantity',
        'discrepancy_reason',
        'notes',
        'transfer_out_movement_id',
        'transfer_in_movement_id',
    ];

    protected $casts = [
        'conversion_factor' => 'decimal:6',
        'requested_quantity' => 'decimal:4',
        'requested_base_quantity' => 'decimal:4',
        'shipped_quantity' => 'decimal:4',
        'received_quantity' => 'decimal:4',
    ];

    public function transfer(): BelongsTo
    {
        return $this->belongsTo(StockTransfer::class, 'stock_transfer_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(ProductUnit::class, 'product_unit_id');
    }

    public function transferOutMovement(): BelongsTo
    {
        return $this->belongsTo(InventoryMovement::class, 'transfer_out_movement_id');
    }

    public function transferInMovement(): BelongsTo
    {
        return $this->belongsTo(InventoryMovement::class, 'transfer_in_movement_id');
    }

    public function inTransitQuantity(): float
    {
        if ($this->shipped_quantity === null) {
            return 0;
        }

        return max(0, (float) $this->shipped_quantity - (float) ($this->received_quantity ?? 0));
    }
}
