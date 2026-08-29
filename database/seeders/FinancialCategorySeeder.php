<?php

namespace Database\Seeders;

use App\Models\FinancialCategory;
use App\Models\FinancialEntry;
use Illuminate\Database\Seeder;

class FinancialCategorySeeder extends Seeder
{
    public function run(): void
    {
        FinancialCategory::updateOrCreate(
            ['value' => FinancialEntry::CATEGORY_STOCK_RECEIPT],
            [
                'type' => 'expense',
                'label' => 'Stock receipts',
                'is_system' => true,
                'is_active' => true,
                'sort_order' => 10,
            ]
        );

        FinancialCategory::updateOrCreate(
            ['value' => FinancialEntry::CATEGORY_POS_SALE],
            [
                'type' => 'income',
                'label' => 'POS sales',
                'is_system' => true,
                'is_active' => true,
                'sort_order' => 10,
            ]
        );
    }
}
