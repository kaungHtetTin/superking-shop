<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductCrudTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_index_can_search_and_filter_by_category_and_stock_level(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $battery = Category::create(['name' => 'Battery', 'slug' => 'battery', 'is_active' => true]);
        $other = Category::create(['name' => 'Other', 'slug' => 'other', 'is_active' => true]);
        $matching = Product::create(['category_id' => $battery->id, 'name' => 'Quantum Battery', 'slug' => 'quantum-battery', 'sku' => 'QB-01', 'original_price' => 10, 'min_quantity' => 2, 'status' => 'active', 'is_active' => true]);
        Product::create(['category_id' => $other->id, 'name' => 'Unrelated Item', 'slug' => 'unrelated-item', 'original_price' => 10, 'min_quantity' => 2, 'status' => 'active', 'is_active' => true]);
        $this->actingAs($admin)
            ->get("/admin/products?q=QB-01&category_id={$battery->id}&stock=out_of_stock")
            ->assertOk()
            ->assertSee('Quantum Battery')
            ->assertDontSee('Unrelated Item');
    }

    public function test_product_index_includes_current_cost_and_all_unit_prices(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $category = Category::create(['name' => 'Prices', 'slug' => 'prices', 'is_active' => true]);
        $product = Product::create(['category_id' => $category->id, 'name' => 'Multi unit product',
            'slug' => 'multi-unit-product', 'original_price' => 12.5, 'status' => 'active', 'is_active' => true]);
        $piece = $product->units()->create(['name' => 'Piece', 'code' => 'PC', 'conversion_factor' => 1,
            'is_base' => true, 'is_default_selling' => true, 'is_active' => true]);
        $box = $product->units()->create(['name' => 'Box', 'code' => 'BOX', 'conversion_factor' => 12, 'is_active' => true]);
        $retail = $product->priceTypes()->create(['name' => 'retail', 'is_default' => true]);
        $wholesale = $product->priceTypes()->create(['name' => 'wholesale']);
        $piece->prices()->create(['product_price_type_id' => $retail->id, 'price' => 20, 'is_manual' => true]);
        $piece->prices()->create(['product_price_type_id' => $wholesale->id, 'price' => 18, 'is_manual' => true]);
        $box->prices()->create(['product_price_type_id' => $retail->id, 'price' => 240, 'is_manual' => true]);

        $response = $this->actingAs($admin)->getJson('/admin/products?q=Multi')->assertOk();
        $row = $response->json('props.products.data.0');
        $this->assertEquals(12.5, $row['original_price']);
        $this->assertSame('Piece', $row['base_unit']['name']);
        $units = collect($row['units'])->keyBy('id');
        $this->assertCount(2, $units[$piece->id]['prices']);
        $this->assertSame('retail', $units[$piece->id]['prices'][0]['price_type']);
        $this->assertEquals(20, $units[$piece->id]['prices'][0]['price']);
        $this->assertSame('wholesale', $units[$piece->id]['prices'][1]['price_type']);
        $this->assertEquals(240, $units[$box->id]['prices'][0]['price']);
    }

    public function test_optional_sku_can_be_saved_and_must_be_unique(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $category = Category::create(['name' => 'Test', 'slug' => 'test', 'is_active' => true]);
        $payload = [
            'category_id' => $category->id,
            'sku' => 'SKU-001',
            'name' => 'SKU Product',
            'min_quantity' => 0,
            'original_price' => 10,
            'status' => 'active',
            'units' => [
                ['name' => 'Piece', 'code' => 'pc', 'conversion_factor' => 1, 'is_base' => true, 'is_default_selling' => true],
            ],
            'price_types' => [
                ['name' => 'retail', 'prices' => [20]],
            ],
        ];

        $this->actingAs($admin)->post('/admin/products', $payload)->assertRedirect('/admin/products');
        $this->assertDatabaseHas('products', ['name' => 'SKU Product', 'sku' => 'SKU-001']);

        $payload['name'] = 'Duplicate SKU Product';
        $this->actingAs($admin)->from('/admin/products/create')->post('/admin/products', $payload)
            ->assertRedirect('/admin/products/create')
            ->assertSessionHasErrors('sku');
    }

    public function test_product_creation_requires_exactly_one_base_and_default_unit(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $category = Category::create(['name' => 'Test', 'slug' => 'test', 'is_active' => true]);

        $this->actingAs($admin)->from('/admin/products/create')->post('/admin/products', [
            'category_id' => $category->id,
            'name' => 'Invalid Units',
            'min_quantity' => 0,
            'original_price' => 10,
            'status' => 'active',
            'units' => [
                ['name' => 'Piece', 'code' => 'pc', 'conversion_factor' => 1, 'is_base' => false, 'is_default_selling' => true],
            ],
            'price_types' => [
                ['name' => 'retail', 'prices' => [20]],
            ],
        ])->assertRedirect('/admin/products/create')->assertSessionHasErrors('units');

        $this->assertDatabaseMissing('products', ['name' => 'Invalid Units']);
    }

    public function test_history_free_product_can_be_deleted_through_spa_without_stale_flash(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $category = Category::create(['name' => 'Test', 'slug' => 'test', 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Disposable Product',
            'slug' => 'disposable-product',
            'barcode' => '99887766',
            'original_price' => 0,
            'min_quantity' => 0,
            'status' => 'active',
            'is_active' => true,
        ]);

        $this->actingAs($admin)
            ->withHeader('X-SPA', 'true')
            ->delete("/admin/products/{$product->id}")
            ->assertOk()
            ->assertJson(['deleted' => true])
            ->assertSessionMissing('success');

        $this->assertDatabaseMissing('products', ['id' => $product->id]);
    }

    public function test_product_status_can_be_deactivated_and_activated_without_deletion(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $category = Category::create(['name' => 'Test', 'slug' => 'test', 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Retained Product',
            'slug' => 'retained-product',
            'barcode' => '11223344',
            'original_price' => 0,
            'min_quantity' => 0,
            'status' => 'active',
            'is_active' => true,
        ]);

        $this->actingAs($admin)->patch("/admin/products/{$product->id}/toggle-status")->assertRedirect();
        $this->assertDatabaseHas('products', ['id' => $product->id, 'status' => 'inactive', 'is_active' => false]);

        $this->actingAs($admin)->patch("/admin/products/{$product->id}/toggle-status")->assertRedirect();
        $this->assertDatabaseHas('products', ['id' => $product->id, 'status' => 'active', 'is_active' => true]);
    }
}
