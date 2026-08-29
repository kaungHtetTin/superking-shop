<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryImport extends Model
{
    use HasFactory;

    protected $fillable = [
        'batch_number', 'location_id', 'mode', 'status', 'original_filename', 'stored_file_path',
        'total_rows', 'valid_rows', 'error_rows', 'posted_rows', 'created_by', 'posted_by', 'posted_at',
    ];

    protected $casts = ['posted_at' => 'datetime'];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function rows(): HasMany
    {
        return $this->hasMany(InventoryImportRow::class);
    }

    public function receipt()
    {
        return $this->hasOne(StockReceipt::class);
    }

    public function adjustment()
    {
        return $this->hasOne(StockAdjustment::class);
    }
}
