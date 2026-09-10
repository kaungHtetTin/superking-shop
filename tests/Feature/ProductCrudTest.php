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
