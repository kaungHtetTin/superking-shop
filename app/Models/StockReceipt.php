<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockReceipt extends Model
{
    use HasFactory;

    public const STATUSES = ['draft', 'posted', 'reversed'];

    protected $fillable = [
        'receipt_number', 'location_id', 'inventory_import_id', 'supplier_reference', 'status',
        'notes', 'created_by', 'received_by', 'received_at', 'reversal_adjustment_id',
    ];

    protected $casts = ['received_at' => 'datetime'];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(StockReceiptItem::class);
    }

    public function inventoryImport(): BelongsTo
    {
        return $this->belongsTo(InventoryImport::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function reversalAdjustment(): BelongsTo
    {
        return $this->belongsTo(StockAdjustment::class, 'reversal_adjustment_id');
    }
}
