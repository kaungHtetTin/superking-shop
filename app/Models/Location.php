<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Location extends Model
{
    use HasFactory;

    public const TYPES = ['warehouse'];

    protected $fillable = [
        'code',
        'name',
        'type',
        'address',
        'phone',
        'timezone',
        'is_active',
        'is_default_fulfillment',
        'is_system',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_default_fulfillment' => 'boolean',
        'is_system' => 'boolean',
    ];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'location_user')
            ->withPivot('is_default')
            ->withTimestamps();
    }

    public function balances(): HasMany
    {
        return $this->hasMany(InventoryBalance::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function imports(): HasMany
    {
        return $this->hasMany(InventoryImport::class);
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(StockReceipt::class);
    }

    public function adjustments(): HasMany
    {
        return $this->hasMany(StockAdjustment::class);
    }

    public function registers(): HasMany
    {
        return $this->hasMany(PosRegister::class);
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(InventoryReservation::class);
    }
}
