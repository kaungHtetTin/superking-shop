<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;
use App\Support\UploadedFileUrl;

class PaymentMethod extends Model
{
    use HasFactory;

    protected $fillable = [
        'banking_service',
        'account_name',
        'account_no',
        'icon_path',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    protected $appends = [
        'icon_url',
    ];

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('sort_order')->orderBy('banking_service')->orderBy('id');
    }

    public function getIconUrlAttribute(): ?string
    {
        if (! $this->icon_path) {
            return null;
        }

        return UploadedFileUrl::make($this->icon_path);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function snapshot(): array
    {
        return [
            'id' => $this->id,
            'banking_service' => $this->banking_service,
            'account_name' => $this->account_name,
            'account_no' => $this->account_no,
            'icon_url' => $this->icon_url,
        ];
    }
}
