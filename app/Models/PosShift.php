<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PosShift extends Model
{
    use HasFactory;

    protected $fillable = [
        'pos_register_id',
        'location_id',
        'cashier_id',
        'closed_by_user_id',
        'status',
        'open_slot',
        'opening_cash',
        'cash_sales',
        'cash_received_total',
        'change_given_total',
        'net_cash_sales',
        'card_sales_total',
        'mobile_sales_total',
        'mmqr_sales_total',
        'sale_count',
        'cash_refunds',
        'expected_cash',
        'counted_cash',
        'variance',
        'opened_at',
        'opening_notes',
        'closed_at',
        'closing_notes',
    ];

    protected $casts = [
        'opening_cash' => 'decimal:2',
        'cash_sales' => 'decimal:2',
        'cash_received_total' => 'decimal:2',
        'change_given_total' => 'decimal:2',
        'net_cash_sales' => 'decimal:2',
        'card_sales_total' => 'decimal:2',
        'mobile_sales_total' => 'decimal:2',
        'mmqr_sales_total' => 'decimal:2',
        'cash_refunds' => 'decimal:2',
        'expected_cash' => 'decimal:2',
        'counted_cash' => 'decimal:2',
        'variance' => 'decimal:2',
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
        'open_slot' => 'integer',
        'sale_count' => 'integer',
    ];

    public function register(): BelongsTo
    {
        return $this->belongsTo(PosRegister::class, 'pos_register_id');
    }

    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by_user_id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'shift_id');
    }
}
