<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Internal stock transfers move inventory value between company locations.
        // Preserve legacy rows for audit, but keep them out of active income,
        // expense, cash-flow and profit reporting.
        DB::table('financial_entries')
            ->where(function ($entries) {
                $entries->whereNotNull('stock_transfer_id')
                    ->orWhere('category', 'internal_transfer')
                    ->orWhereExists(function ($transfers) {
                        $transfers->selectRaw('1')
                            ->from('stock_transfers')
                            ->whereColumn('stock_transfers.transfer_number', 'financial_entries.reference');
                    });
            })
            ->update([
                'status' => 'void',
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        // Historical financial rows are not automatically re-approved.
    }
};
