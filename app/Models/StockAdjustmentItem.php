<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockAdjustmentItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'stock_adjustment_id', 'product_id', 'product_unit_id', 'conversion_factor', 'system_quantity',
        'counted_quantity', 'base_counted_quantity', 'quantity_delta', 'notes', 'movement_id',
    ];

    protected $casts = [
        'conversion_factor' => 'decimal:6',
        'system_quantity' => 'decimal:4',
        'counted_quantity' => 'decimal:4',
        'base_counted_quantity' => 'decimal:4',
        'quantity_delta' => 'decimal:4',
    ];

    public function adjustment(): BelongsTo
    {
        return $this->belongsTo(StockAdjustment::class, 'stock_adjustment_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(ProductUnit::class, 'product_unit_id');
    }
}
