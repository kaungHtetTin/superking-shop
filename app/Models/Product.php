<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'category_id',
        'product_code',
        'barcode',
        'name',
        'slug',
        'description',
        'min_quantity',
        'original_price',
        'pricing_base_cost',
        'pricing_buying_cost',
        'pricing_source_receipt_id',
        'pricing_version',
        'status',
        'metadata',
        'is_featured',
        'is_active',
        'rating',
        'review_count',
    ];

    protected $casts = [
        'pricing_base_cost' => 'decimal:6',
        'pricing_buying_cost' => 'decimal:6',
        'pricing_version' => 'integer',
        'is_featured' => 'boolean',
        'is_active' => 'boolean',
        'metadata' => 'json',
        'rating' => 'decimal:2',
        'min_quantity' => 'decimal:4',
        'original_price' => 'decimal:2',
    ];

    protected static function booted(): void
    {
        static::creating(function (Product $product) {
            if (blank($product->product_code)) {
                do {
                    $code = 'PRD-'.now()->format('ymd').'-'.Str::upper(Str::random(5));
                } while (static::query()->where('product_code', $code)->exists());

                $product->product_code = $code;
            }
        });
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function units()
    {
        return $this->hasMany(ProductUnit::class)->orderBy('sort_order')->orderBy('id');
    }

    public function priceTypes()
    {
        return $this->hasMany(ProductPriceType::class)->orderByDesc('is_default')->orderBy('sort_order')->orderBy('id');
    }

    public function baseUnit()
    {
        return $this->hasOne(ProductUnit::class)->where('is_base', true);
    }

    public function defaultSellingUnit()
    {
        return $this->hasOne(ProductUnit::class)->where('is_default_selling', true);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }

    public function scopeInActiveCategory(Builder $query): Builder
    {
        return $query->whereHas('category', fn (Builder $category) => $category->where('is_active', true));
    }

    public function scopeAvailableAt(Builder $query, Location|int $location): Builder
    {
        $locationId = $location instanceof Location ? $location->id : $location;

        return $query->whereHas('inventoryBalances', fn (Builder $balance) => $balance
            ->where('location_id', $locationId)
            ->whereColumn('inventory_balances.on_hand_qty', '>', 'inventory_balances.reserved_qty'));
    }

    public function scopeAvailableAnywhere(Builder $query): Builder
    {
        return $query->whereHas('inventoryBalances', fn (Builder $balance) => $balance
            ->whereColumn('inventory_balances.on_hand_qty', '>', 'inventory_balances.reserved_qty')
            ->whereHas('location', fn (Builder $location) => $location->where('is_active', true)));
    }

    public function images()
    {
        return $this->hasMany(ProductImage::class);
    }

    public function primaryImage()
    {
        return $this->hasOne(ProductImage::class)->where('is_primary', true);
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function flashSaleItems()
    {
        return $this->hasManyThrough(FlashSaleItem::class, ProductUnit::class);
    }

    public function inventoryBalances()
    {
        return $this->hasMany(InventoryBalance::class);
    }

    public function inventoryMovements()
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function inventoryReservations()
    {
        return $this->hasMany(InventoryReservation::class);
    }

    public function displayQuantity(float $baseQuantity): array
    {
        $base = $this->relationLoaded('baseUnit') ? $this->baseUnit : $this->baseUnit()->first();
        $selling = $this->relationLoaded('defaultSellingUnit') ? $this->defaultSellingUnit : $this->defaultSellingUnit()->first();

        if (! $selling || ! $base || (float) $selling->conversion_factor <= 1 || $baseQuantity < (float) $selling->conversion_factor) {
            return ['quantity' => $baseQuantity, 'unit' => $base?->code ?? 'unit', 'remainder' => 0.0];
        }

        $factor = (float) $selling->conversion_factor;
        $whole = floor(($baseQuantity + 0.000001) / $factor);

        return [
            'quantity' => $whole,
            'unit' => $selling->code,
            'remainder' => round($baseQuantity - ($whole * $factor), 4),
            'remainder_unit' => $base->code,
        ];
    }
}
