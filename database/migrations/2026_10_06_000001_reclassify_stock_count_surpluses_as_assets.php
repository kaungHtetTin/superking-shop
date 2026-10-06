<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('financial_entries')
            ->where('category', 'stock_adjustment')
            ->where('type', 'income')
            ->where('reference', 'like', 'ADJ-%:%')
            ->update(['type' => 'asset', 'updated_at' => now()]);

        DB::table('financial_categories')
            ->where('value', 'stock_adjustment')
            ->where('type', 'income')
            ->update(['type' => 'asset', 'label' => 'Inventory count surplus', 'updated_at' => now()]);
    }

    public function down(): void
    {
        DB::table('financial_entries')
            ->where('category', 'stock_adjustment')
            ->where('type', 'asset')
            ->where('reference', 'like', 'ADJ-%:%')
            ->update(['type' => 'income', 'updated_at' => now()]);

        DB::table('financial_categories')
            ->where('value', 'stock_adjustment')
            ->where('type', 'asset')
            ->update(['type' => 'income', 'label' => 'Inventory gains', 'updated_at' => now()]);
    }
};
