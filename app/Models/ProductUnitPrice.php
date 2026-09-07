<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductUnitPrice extends Model
{
    use HasFactory;

    protected $fillable = ['product_unit_id', 'product_price_type_id', 'price', 'is_manual', 'calculation_status', 'applied_rule_version'];

    protected $appends = ['price_type'];

    protected $casts = ['price' => 'decimal:2', 'is_manual' => 'boolean'];

    public function unit(): BelongsTo
    {
        return $this->belongsTo(ProductUnit::class, 'product_unit_id');
    }

    public function typeDefinition(): BelongsTo
    {
        return $this->belongsTo(ProductPriceType::class, 'product_price_type_id');
    }

    public function getPriceTypeAttribute(): ?string
    {
        return $this->typeDefinition?->name;
    }
}
