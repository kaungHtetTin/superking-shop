<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('financial_entries')
            ->where('category', 'stock_receipt')
            ->update([
                'type' => 'asset',
                'title' => DB::raw("CASE WHEN title LIKE 'Stock receipt %' THEN REPLACE(title, 'Stock receipt ', 'Inventory purchase ') ELSE title END"),
                'updated_at' => now(),
            ]);

        DB::table('financial_categories')
            ->where('value', 'stock_receipt')
            ->update([
                'type' => 'asset',
                'label' => 'Inventory purchases',
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('financial_entries')
            ->where('category', 'stock_receipt')
            ->update([
                'type' => 'expense',
                'title' => DB::raw("CASE WHEN title LIKE 'Inventory purchase %' THEN REPLACE(title, 'Inventory purchase ', 'Stock receipt ') ELSE title END"),
                'updated_at' => now(),
            ]);

        DB::table('financial_categories')
            ->where('value', 'stock_receipt')
            ->update([
                'type' => 'expense',
                'label' => 'Stock receipts',
                'updated_at' => now(),
            ]);
    }
};
