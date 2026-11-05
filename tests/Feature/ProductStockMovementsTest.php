<?php

namespace Tests\Feature;

use App\Models\{Category, Location, Order, Permission, Product, Role, StockReceipt, User};
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

    public function test_movement_detail_includes_unit_conversion_factors_for_entered_quantities(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $product = $this->product();
        $piece = $product->units()->firstOrFail();
        $box = $product->units()->create(['name' => 'Box', 'code' => 'BOX', 'conversion_factor' => 12, 'is_active' => true]);
        $location = Location::create(['code' => 'UNIT-HISTORY', 'name' => 'Unit history', 'type' => 'warehouse', 'is_active' => true]);
        $inventory = app(InventoryService::class);
        $pieceMovement = $inventory->receive($location, $product, 1, unit: $piece, unitQuantity: 1);
        $boxMovement = $inventory->receive($location, $product, 24, unit: $box, unitQuantity: 2);

        $response = $this->actingAs($admin)->getJson('/admin/inventory/products/'.$product->id)->assertOk();
        $movements = collect($response->json('props.movements.data'))->keyBy('id');

        foreach ([[$pieceMovement, 1.0, 1.0], [$boxMovement, 2.0, 12.0]] as [$movement, $quantity, $factor]) {
            $row = $movements->get($movement->id);
            $this->assertSame($quantity, (float) $row['unit_quantity']);
            $this->assertArrayHasKey('conversion_factor', $row['unit']);
            $this->assertSame($factor, (float) $row['unit']['conversion_factor']);
            $this->assertSame((float) $row['quantity_delta'], (float) $row['unit_quantity'] * (float) $row['unit']['conversion_factor']);
        }
    }

    public function test_movement_receipt_link_opens_the_matching_receipt_detail(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $product = $this->product();
        $location = Location::create(['code' => 'RECEIPT-HISTORY', 'name' => 'Receipt history', 'type' => 'warehouse', 'is_active' => true]);
        $receipt = StockReceipt::create(['receipt_number' => 'REC-HISTORY-DETAIL', 'location_id' => $location->id, 'status' => 'posted', 'created_by' => $admin->id]);
        app(InventoryService::class)->receive($location, $product, 1, reference: $receipt);

        $response = $this->actingAs($admin)->getJson('/admin/inventory/products/'.$product->id.'?'.http_build_query(['location' => $location->id, 'type' => 'receipt']))
            ->assertOk()
            ->assertJsonPath('props.movements.data.0.document.label', $receipt->receipt_number)
            ->assertJsonPath('props.movements.data.0.document.href', route('admin.inventory.receipts.show', $receipt));

        $this->getJson($response->json('props.movements.data.0.document.href'))
            ->assertOk()
            ->assertJsonPath('component', 'Admin/Inventory/Receipts/Show')
            ->assertJsonPath('props.receipt.id', $receipt->id)
            ->assertJsonPath('props.receipt.receipt_number', $receipt->receipt_number);
    }

    public function test_sale_movements_show_the_sale_number_and_link_to_the_matching_detail(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $product = $this->product();
        $unit = $product->units()->firstOrFail();
        $location = Location::create(['code' => 'SALE-HISTORY', 'name' => 'Sale history', 'type' => 'warehouse', 'is_active' => true]);
        $inventory = app(InventoryService::class);
        $inventory->receive($location, $product, 2);

        foreach (['pos', 'online'] as $channel) {
            $order = Order::create([
                'order_number' => strtoupper($channel).'-HISTORY-DETAIL',
                'sales_channel' => $channel,
                'location_id' => $location->id,
                'total_amount' => 10,
                'final_amount' => 10,
                'status' => 'delivered',
                'payment_status' => 'paid',
                'receiver_name' => 'History customer',
            ]);
            $movement = $inventory->completeSale($location, $product, 1, reference: $order, unit: $unit, unitQuantity: 1);
            $response = $this->actingAs($admin)->getJson('/admin/inventory/products/'.$product->id.'?'.http_build_query(['location' => $location->id, 'type' => 'sale']))->assertOk();
            $row = collect($response->json('props.movements.data'))->firstWhere('id', $movement->id);

            $this->assertSame($order->order_number, $row['document']['label']);
            $this->assertSame(route('admin.orders.show', $order), $row['document']['href']);
            $this->getJson($row['document']['href'])
                ->assertOk()
                ->assertJsonPath('component', 'Admin/Orders/Show')
                ->assertJsonPath('props.order.id', $order->id)
                ->assertJsonPath('props.order.order_number', $order->order_number);
        }
    }

    public function test_sale_movement_without_a_reference_has_no_document_link(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $product = $this->product();
        $location = Location::create(['code' => 'UNLINKED-SALE', 'name' => 'Unlinked sale', 'type' => 'warehouse', 'is_active' => true]);
        $inventory = app(InventoryService::class);
        $inventory->receive($location, $product, 1);
        $inventory->completeSale($location, $product, 1);

        $this->actingAs($admin)->getJson('/admin/inventory/products/'.$product->id.'?type=sale')
            ->assertOk()
            ->assertJsonCount(1, 'props.movements.data')
            ->assertJsonPath('props.movements.data.0.document', null);
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
