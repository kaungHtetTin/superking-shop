<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CycleCountItem extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['system_quantity' => 'decimal:4', 'counted_quantity' => 'decimal:4', 'base_cost' => 'decimal:6', 'balance_version' => 'integer'];

    public function count(): BelongsTo { return $this->belongsTo(CycleCount::class, 'cycle_count_id'); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function unit(): BelongsTo { return $this->belongsTo(ProductUnit::class, 'product_unit_id'); }
}
