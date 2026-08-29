<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FlashSaleItem extends Model
{
    use HasFactory;

    public const TYPE_PERCENTAGE = 'percentage';

    public const TYPE_FIXED_PRICE = 'fixed_price';

    protected $fillable = [
        'flash_sale_id',
        'product_unit_id',
        'discount_type',
        'discount_value',
        'quantity_limit',
        'sold_count',
    ];

    protected $casts = [
        'discount_value' => 'decimal:2',
        'quantity_limit' => 'decimal:4',
        'sold_count' => 'decimal:4',
    ];

    public function flashSale(): BelongsTo
    {
        return $this->belongsTo(FlashSale::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(ProductUnit::class, 'product_unit_id');
    }

    public function salePrice(float $originalPrice): float
    {
        if ($this->discount_type === self::TYPE_PERCENTAGE) {
            $price = $originalPrice * (1 - ((float) $this->discount_value / 100));
        } else {
            $price = (float) $this->discount_value;
        }

        return round(max(0.01, min($originalPrice, $price)), 2);
    }

    public function remainingQuantity(): ?float
    {
        if ($this->quantity_limit === null) {
            return null;
        }

        return round(max(0, (float) $this->quantity_limit - (float) $this->sold_count), 4);
    }
}
