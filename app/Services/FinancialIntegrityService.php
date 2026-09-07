<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class FinancialIntegrityService
{
    public static function unvaluedAdjustmentLines(array $locationIds, $from = null, $to = null): int
    {
        return DB::table('stock_adjustment_items as items')
            ->join('stock_adjustments as adjustments', 'adjustments.id', '=', 'items.stock_adjustment_id')
            ->whereIn('adjustments.location_id', $locationIds)
            ->whereIn('adjustments.status', ['posted', 'reversed'])
            ->whereNull('items.value_delta')->where('items.quantity_delta', '!=', 0)
            ->when($from, fn ($query) => $query->where('adjustments.posted_at', '>=', $from))
            ->when($to, fn ($query) => $query->where('adjustments.posted_at', '<=', $to))
            ->count();
    }
}
