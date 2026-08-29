<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryImportRow extends Model
{
    use HasFactory;

    protected $fillable = [
        'inventory_import_id', 'row_number', 'product_id', 'product_unit_id', 'raw_data', 'quantity', 'base_quantity',
        'original_price', 'selling_prices', 'min_quantity', 'validation_errors', 'validation_warnings',
        'status', 'movement_id', 'reference_type', 'reference_id', 'idempotency_key',
    ];

    protected $casts = [
        'raw_data' => 'array',
        'quantity' => 'decimal:4',
        'base_quantity' => 'decimal:4',
        'original_price' => 'decimal:2',
        'selling_prices' => 'array',
        'min_quantity' => 'decimal:4',
        'validation_errors' => 'array',
        'validation_warnings' => 'array',
    ];

    public function inventoryImport(): BelongsTo
    {
        return $this->belongsTo(InventoryImport::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(ProductUnit::class, 'product_unit_id');
    }

    public function movement(): BelongsTo
    {
        return $this->belongsTo(InventoryMovement::class, 'movement_id');
    }
}
