<?php

namespace Tests\Feature;

use App\Models\FinancialCategory;
use App\Models\FinancialEntry;
use App\Models\PosRegister;
use App\Models\Product;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DatabaseSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_seeder_keeps_demo_catalog_data_disabled(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertDatabaseHas('users', [
            'email' => env('INITIAL_ADMIN_EMAIL', 'admin@onlineshop.com'),
            'role' => 'super_admin',
            'status' => 'active',
        ]);
        $this->assertDatabaseHas('financial_categories', [
            'value' => FinancialEntry::CATEGORY_STOCK_RECEIPT,
            'type' => FinancialEntry::TYPE_ASSET,
            'is_system' => true,
        ]);
        $this->assertDatabaseHas('financial_categories', [
            'value' => FinancialEntry::CATEGORY_POS_SALE,
            'is_system' => true,
        ]);

        $this->assertSame(1, User::query()->count());
        $this->assertSame(2, FinancialCategory::query()->count());
        $this->assertSame(0, Product::query()->count());
        $this->assertSame(1, PosRegister::query()->count());
        $this->assertDatabaseHas('pos_registers', ['code' => 'MAIN-REG-1']);
        $this->assertDatabaseMissing('products', ['metadata->demo_pos_product' => true]);
        $this->assertDatabaseMissing('pos_registers', ['code' => 'POS-01']);
        $this->assertDatabaseMissing('pos_registers', ['code' => 'WH-POS-01']);
    }
}
