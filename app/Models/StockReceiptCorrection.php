<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockReceiptCorrection extends Model
{
    protected $fillable = [
        'stock_receipt_id', 'stock_receipt_item_id', 'created_by', 'reason', 'notes',
        'old_received_quantity', 'new_received_quantity', 'old_free_quantity', 'new_free_quantity',
        'old_unit_cost', 'new_unit_cost', 'old_applied_base_cost', 'new_applied_base_cost',
        'purchase_amount_delta', 'movement_id',
    ];

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(StockReceiptItem::class, 'stock_receipt_item_id');
    }
}
