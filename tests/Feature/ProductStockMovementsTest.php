<?php

namespace Tests\Feature;

use App\Models\{Category, Location, Permission, Product, Role, User};
use App\Services\Inventory\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductStockMovementsTest extends TestCase
{
    use RefreshDatabase;

    private function viewer(array $permissions): User
    {
        $role = Role::create(['name' => 'stock-viewer', 'display_name' => 'Stock viewer', 'is_admin' => true]);
        $role->permissions()->sync(Permission::whereIn('name', $permissions)->pluck('id'));
        $viewer = User::factory()->create(['role' => 'staff', 'status' => 'active']);
        $viewer->roles()->sync([$role->id]);

        return $viewer->fresh();
    }

    private function product(): Product
    {
        $category = Category::create(['name' => 'Stock', 'slug' => 'stock', 'is_active' => true]);
        $product = Product::create(['category_id' => $category->id, 'name' => 'Movement product', 'slug' => 'movement-product', 'original_price' => 10, 'min_quantity' => 0, 'status' => 'active', 'is_active' => true]);
        $product->units()->create(['name' => 'Piece', 'code' => 'PCS', 'conversion_factor' => 1, 'is_base' => true, 'is_default_selling' => true, 'is_active' => true]);

        return $product;
    }

    public function test_product_list_exposes_the_movement_action_only_with_history_permission(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $this->actingAs($admin)->getJson('/admin/products')->assertOk()->assertJsonPath('props.canViewStockMovements', true);

        $viewer = $this->viewer(['catalog.view']);
        $this->actingAs($viewer)->getJson('/admin/products')->assertOk()->assertJsonPath('props.canViewStockMovements', false);
        $product = $this->product();
        $this->actingAs($viewer)->getJson('/admin/inventory/products/'.$product->id)->assertForbidden();
    }

    public function test_movement_detail_preserves_product_list_filters_and_page_in_pagination(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $product = $this->product();
        $returnTo = '/admin/products?q=battery&status=active&stock=low_stock&page=3';
        $url = '/admin/inventory/products/'.$product->id.'?'.http_build_query(['return_to' => $returnTo, 'type' => 'receipt']);
        $response = $this->actingAs($admin)->getJson($url)->assertOk()
            ->assertJsonPath('component', 'Admin/Inventory/ProductShow')
            ->assertJsonPath('props.product.id', $product->id)
            ->assertJsonPath('props.returnToProducts', $returnTo)
            ->assertJsonPath('props.filters.return_to', $returnTo)
            ->assertJsonPath('props.filters.type', 'receipt');
        $this->assertStringContainsString('return_to=', $response->json('props.movements.first_page_url'));
    }

    public function test_movement_detail_ignores_external_or_unrelated_return_links(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $product = $this->product();
        foreach (['https://example.com/admin/products', '//example.com/admin/products', '/admin/finance', 'javascript:alert(1)'] as $returnTo) {
            $this->actingAs($admin)->getJson('/admin/inventory/products/'.$product->id.'?'.http_build_query(['return_to' => $returnTo]))
                ->assertOk()->assertJsonPath('props.returnToProducts', null)->assertJsonMissingPath('props.filters.return_to');
        }
        $this->actingAs($admin)->getJson('/admin/inventory/products/'.$product->id)->assertOk()->assertJsonPath('props.returnToProducts', null);
    }

    public function test_movement_detail_only_shows_assigned_locations_and_requested_product(): void
    {
        $product = $this->product();
        $allowed = Location::create(['code' => 'ALLOWED', 'name' => 'Allowed', 'type' => 'warehouse', 'is_active' => true]);
        $denied = Location::create(['code' => 'DENIED', 'name' => 'Denied', 'type' => 'warehouse', 'is_active' => true]);
        $viewer = $this->viewer(['catalog.view', 'inventory.history']);
        $viewer->locations()->sync([$allowed->id]);
        $inventory = app(InventoryService::class);
        $inventory->receive($allowed, $product, 5);
        $inventory->receive($denied, $product, 9);
        $response = $this->actingAs($viewer)->getJson('/admin/inventory/products/'.$product->id)->assertOk()
            ->assertJsonCount(1, 'props.balances')->assertJsonCount(1, 'props.movements.data')
            ->assertJsonPath('props.movements.data.0.location_id', $allowed->id)
            ->assertJsonPath('props.movements.data.0.product_id', $product->id);
        $this->actingAs($viewer)->getJson('/admin/inventory/products/'.$product->id.'?location='.$denied->id)
            ->assertOk()->assertJsonCount(0, 'props.movements.data');
    }
}
