<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Validation\ValidationException;

class ProductUnit extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id', 'name', 'code', 'conversion_factor', 'is_base',
        'is_default_selling', 'is_active', 'sort_order',
    ];

    protected $casts = [
        'conversion_factor' => 'decimal:6',
        'is_base' => 'boolean',
        'is_default_selling' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function prices(): HasMany
    {
        return $this->hasMany(ProductUnitPrice::class)->with('typeDefinition')->orderBy('product_price_type_id');
    }

    public function retailPrice(): HasOne
    {
        return $this->hasOne(ProductUnitPrice::class)->whereHas('typeDefinition', fn ($query) => $query->where('name', 'retail'));
    }

    public function flashSaleItems(): HasMany
    {
        return $this->hasMany(FlashSaleItem::class);
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function inventoryMovements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function toBaseQuantity(float $quantity): float
    {
        if ($quantity < 0) {
            throw ValidationException::withMessages(['quantity' => 'Quantity cannot be negative.']);
        }

        return round($quantity * (float) $this->conversion_factor, 4);
    }

    public function fromBaseQuantity(float $quantity): float
    {
        return round($quantity / max((float) $this->conversion_factor, 0.000001), 4);
    }

    public function priceFor(string $priceType = 'retail'): ?ProductUnitPrice
    {
        return $this->prices->firstWhere('price_type', strtolower($priceType));
    }
}
