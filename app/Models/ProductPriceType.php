<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductPriceType extends Model
{
    use HasFactory;

    protected $fillable = ['product_id', 'name', 'is_default', 'sort_order', 'pricing_rule_id'];

    protected $with = ['pricingRule'];

    public function pricingRule(): BelongsTo { return $this->belongsTo(PricingRule::class); }

    protected $casts = ['is_default' => 'boolean', 'sort_order' => 'integer'];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function unitPrices(): HasMany
    {
        return $this->hasMany(ProductUnitPrice::class);
    }
}
