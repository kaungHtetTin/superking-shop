<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Coupon extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'type',
        'value',
        'min_order_amount',
        'starts_at',
        'expires_at',
        'usage_limit',
        'used_count',
        'is_active',
    ];

    protected $casts = [
        'value' => 'decimal:2',
        'min_order_amount' => 'decimal:2',
        'starts_at' => 'datetime',
        'expires_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    protected $appends = [
        'status',
    ];

    public function getStatusAttribute(): string
    {
        if (! $this->is_active) {
            return 'inactive';
        }

        if ($this->expires_at && now()->gt($this->expires_at)) {
            return 'expired';
        }

        if ($this->usage_limit !== null && $this->used_count >= $this->usage_limit) {
            return 'exhausted';
        }

        if ($this->starts_at && now()->lt($this->starts_at)) {
            return 'scheduled';
        }

        return 'active';
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
