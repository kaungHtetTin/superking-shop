<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockAdjustment extends Model
{
    use HasFactory;

    public const STATUSES = ['draft', 'submitted', 'approved', 'posted', 'rejected', 'reversed'];

    public const REASONS = [
        'physical_count' => 'Physical count',
        'damage' => 'Damage',
        'write_off' => 'Write-off',
        'data_correction' => 'Data correction',
        'other' => 'Other',
    ];

    protected $fillable = [
        'adjustment_number', 'location_id', 'inventory_import_id', 'reversal_of_id', 'reason_code', 'status', 'notes',
        'requires_approval', 'created_by', 'approved_by', 'posted_by', 'approved_at', 'posted_at',
    ];

    protected $casts = [
        'requires_approval' => 'boolean',
        'approved_at' => 'datetime',
        'posted_at' => 'datetime',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(StockAdjustmentItem::class);
    }

    public function inventoryImport(): BelongsTo
    {
        return $this->belongsTo(InventoryImport::class);
    }

    public function reversalOf(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reversal_of_id');
    }

    public function reversal()
    {
        return $this->hasOne(self::class, 'reversal_of_id');
    }
}
