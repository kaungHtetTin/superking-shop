<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * @return void
     */
    public function run()
    {
        $this->call([
            AdminUserSeeder::class,
            FinancialCategorySeeder::class,

            // Demo/sample catalog, POS registers, and inventory balances are intentionally disabled.
            // PosDemoProductSeeder::class,
        ]);
    }
}
