<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryBalance extends Model
{
    use HasFactory;

    protected $fillable = [
        'location_id',
        'product_id',
        'on_hand_qty',
        'reserved_qty',
        'version',
    ];

    protected $casts = [
        'on_hand_qty' => 'decimal:4',
        'reserved_qty' => 'decimal:4',
        'version' => 'integer',
    ];

    protected $appends = ['available_qty'];

    public function getAvailableQtyAttribute(): float
    {
        return round((float) $this->on_hand_qty - (float) $this->reserved_qty, 4);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
