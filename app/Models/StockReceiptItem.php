<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockReceiptItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'stock_receipt_id', 'product_id', 'product_unit_id', 'expected_quantity', 'received_quantity',
        'base_quantity', 'conversion_factor', 'unit_cost', 'notes', 'movement_id', 'previous_base_cost', 'applied_base_cost', 'free_quantity',
    ];

    protected $casts = [
        'expected_quantity' => 'decimal:4',
        'received_quantity' => 'decimal:4',
        'base_quantity' => 'decimal:4',
        'conversion_factor' => 'decimal:6',
        'unit_cost' => 'decimal:2',
        'free_quantity' => 'decimal:4',
        'previous_base_cost' => 'decimal:2',
        'applied_base_cost' => 'decimal:2',
    ];

    public function receipt(): BelongsTo
    {
        return $this->belongsTo(StockReceipt::class, 'stock_receipt_id');
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
