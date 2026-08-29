<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryStockAlert extends Model
{
    use HasFactory;

    protected $fillable = [
        'inventory_balance_id', 'location_id', 'product_id', 'type', 'status',
        'available_qty', 'min_quantity', 'detected_at', 'last_notified_at', 'resolved_at',
    ];

    protected $casts = [
        'available_qty' => 'decimal:4',
        'min_quantity' => 'decimal:4',
        'detected_at' => 'datetime',
        'last_notified_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function balance(): BelongsTo
    {
        return $this->belongsTo(InventoryBalance::class, 'inventory_balance_id');
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
