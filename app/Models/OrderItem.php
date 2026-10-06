<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class OrderItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'product_id',
        'product_unit_id',
        'foc_product_unit_id',
        'quantity',
        'foc_quantity',
        'base_quantity',
        'foc_base_quantity',
        'conversion_factor',
        'unit_name',
        'price_type',
        'unit_price',
        'cost_price',
        'foc_cost_price',
        'total_price',
        'is_preorder',
        'promotion_snapshot',
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
        'cost_price' => 'decimal:6',
        'foc_cost_price' => 'decimal:6',
        'total_price' => 'decimal:2',
        'quantity' => 'decimal:4',
        'foc_quantity' => 'decimal:4',
        'base_quantity' => 'decimal:4',
        'foc_base_quantity' => 'decimal:4',
        'conversion_factor' => 'decimal:6',
        'is_preorder' => 'boolean',
        'promotion_snapshot' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(ProductUnit::class, 'product_unit_id');
    }

    public function focUnit(): BelongsTo
    {
        return $this->belongsTo(ProductUnit::class, 'foc_product_unit_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function reservation(): HasOne
    {
        return $this->hasOne(InventoryReservation::class);
    }
}
