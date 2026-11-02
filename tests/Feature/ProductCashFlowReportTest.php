<?php

namespace Tests\Feature;

use App\Models\{Category, InventoryBalance, Location, Order, Product, StockReceipt, User, Permission, Role};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductCashFlowReportTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $user = User::factory()->create(['role' => 'manager', 'status' => 'active', 'permissions' => ['reports.sales']]);
        $location = Location::create(['name' => 'Allowed warehouse', 'code' => 'CASH-A', 'type' => 'warehouse', 'is_active' => true]);
        $other = Location::create(['name' => 'Other warehouse', 'code' => 'CASH-B', 'type' => 'warehouse', 'is_active' => true]);
        $role = Role::create(['name' => 'cash_flow_reader', 'display_name' => 'Cash Flow Reader', 'is_admin' => true]);
        $role->permissions()->sync(Permission::where('name', 'reports.sales')->pluck('id'));
        $user->roles()->sync([$role->id]);
        $user->locations()->sync([$location->id]);
        $category = Category::create(['name' => 'Cash flow', 'slug' => 'cash-flow', 'is_active' => true]);
        $products = collect(['Alpha', 'Beta', 'Stock only'])->map(fn ($name) => Product::create([
            'category_id' => $category->id, 'name' => $name, 'slug' => str_replace(' ', '-', strtolower($name)),
            'description' => 'Test', 'original_price' => 12.5, 'status' => 'active', 'is_active' => true,
        ]));
        foreach ($products as $product) {
            $product->units()->create(['name' => 'Piece', 'code' => 'PC', 'conversion_factor' => 1, 'is_base' => true, 'is_active' => true]);
        }
        return [$user, $location, $other, $products];
    }

    private function receipt($location, $product, $status = 'posted', $date = '2026-05-01', $quantity = 3): void
    {
        $receipt = StockReceipt::create(['receipt_number' => 'CASH-'.uniqid(), 'location_id' => $location->id, 'status' => $status, 'received_at' => $date]);
        $receipt->items()->create(['product_id' => $product->id, 'product_unit_id' => $product->units()->first()->id,
            'received_quantity' => $quantity, 'free_quantity' => 2, 'base_quantity' => $quantity + 2, 'conversion_factor' => 1, 'unit_cost' => 10]);
    }

    private function sale($location, $products, array $attributes = []): void
    {
        $order = Order::create(array_merge(['order_number' => 'CASH-'.uniqid(), 'sales_channel' => 'pos', 'location_id' => $location->id,
            'total_amount' => 200, 'discount_amount' => 20, 'final_amount' => 180, 'shipping_fee' => 0,
            'status' => 'delivered', 'payment_status' => 'paid', 'receiver_name' => 'Walk-in'], $attributes));
        $order->forceFill(['created_at' => $attributes['created_at'] ?? '2026-05-31 23:59:59'])->save();
        foreach ($products as $index => $product) {
            $order->items()->create(['product_id' => $product->id, 'product_unit_id' => $product->units()->first()->id,
                'quantity' => 1, 'base_quantity' => 1, 'conversion_factor' => 1, 'unit_name' => 'Piece',
                'unit_price' => $index === 0 ? 150 : 50, 'cost_price' => 10, 'total_price' => $index === 0 ? 150 : 50]);
        }
    }

    public function test_totals_use_posted_purchases_recognized_sales_and_current_accessible_stock(): void
    {
        [$user, $location, $other, $products] = $this->fixture();
        $retail = $products[0]->priceTypes()->create(['name' => 'retail', 'is_default' => true]);
        $wholesale = $products[0]->priceTypes()->create(['name' => 'wholesale']);
        $baseUnit = $products[0]->units()->first();
        $baseUnit->prices()->create(['product_price_type_id' => $retail->id, 'price' => 25, 'is_manual' => true]);
        $baseUnit->prices()->create(['product_price_type_id' => $wholesale->id, 'price' => 20, 'is_manual' => true]);
        $carton = $products[0]->units()->create(['name' => 'Carton', 'code' => 'CTN', 'conversion_factor' => 12, 'is_default_selling' => true, 'is_active' => true]);
        $carton->prices()->create(['product_price_type_id' => $retail->id, 'price' => 300, 'is_manual' => true]);
        $this->receipt($location, $products[0]);
        $this->receipt($location, $products[0], quantity: 4);
        $this->receipt($location, $products[0], 'draft');
        $this->receipt($location, $products[0], 'reversed');
        $this->receipt($location, $products[0], date: '2026-04-30');
        $this->receipt($other, $products[0]);
        $this->sale($location, $products->take(2));
        $this->sale($location, $products->take(2), ['payment_status' => 'unpaid', 'credit_amount' => 180]);
        $this->sale($location, $products->take(2), ['status' => 'cancelled']);
        $this->sale($location, $products->take(2), ['payment_status' => 'unpaid']);
        $this->sale($location, $products->take(2), ['created_at' => '2026-06-01 00:00:00']);
        $this->sale($other, $products->take(2));
        InventoryBalance::create(['location_id' => $location->id, 'product_id' => $products[0]->id, 'on_hand_qty' => 4, 'reserved_qty' => 1]);
        InventoryBalance::create(['location_id' => $location->id, 'product_id' => $products[2]->id, 'on_hand_qty' => 2, 'reserved_qty' => 0]);
        InventoryBalance::create(['location_id' => $other->id, 'product_id' => $products[0]->id, 'on_hand_qty' => 100, 'reserved_qty' => 0]);
        $response = $this->actingAs($user)->getJson('/admin/reports?view=product-cash-flow&from=2026-05-01&to=2026-05-31')->assertOk();
        $summary = $response->json('props.productCashFlowReport.summary');
        $this->assertEquals(70, $summary['purchases']);
        $this->assertEquals(400, $summary['sales']);
        $this->assertEquals(40, $summary['discounts']);
        $this->assertEquals(290, $summary['profit']);
        $this->assertEquals(75, $summary['stock_value']);
        $rows = collect($response->json('props.productCashFlowReport.rows.data'));
        $this->assertCount(3, $rows);
        $alpha = $rows->firstWhere('product_id', $products[0]->id);
        $this->assertEquals(12.5, $alpha['current_unit_cost']);
        $this->assertEquals(25, $alpha['current_unit_price']);
        $this->assertEquals(100, $alpha['stock_sale_value']);
        $this->assertSame('Piece', $alpha['base_unit_name']);
        $this->assertNull($rows->firstWhere('product_id', $products[2]->id)['current_unit_price']);
        $this->assertNull($rows->firstWhere('product_id', $products[2]->id)['stock_sale_value']);
        $this->assertEquals(200, $rows->firstWhere('product_id', $products[0]->id)['profit']);
        $this->assertEquals(30, $rows->firstWhere('product_id', $products[0]->id)['discounts']);
        $this->assertEquals(25, $rows->firstWhere('product_id', $products[2]->id)['stock_value']);
        $this->getJson('/admin/reports?view=product-cash-flow&from=2026-05-01&to=2026-05-31&q=Beta')
            ->assertOk()->assertJsonCount(1, 'props.productCashFlowReport.rows.data');
        $this->getJson('/admin/reports?view=product-cash-flow&location_id='.$other->id)->assertForbidden();
        $this->getJson('/admin/reports/export?view=product-cash-flow&location_id='.$other->id)->assertForbidden();
        $this->getJson('/admin/reports?view=product-cash-flow&from=2026-05-31&to=2026-05-01')->assertUnprocessable();
        $this->get('/admin/reports/export?view=product-cash-flow&from=2026-05-01&to=2026-05-31')->assertDownload();
        $user->locations()->sync([$location->id, $other->id]);
        $this->getJson('/admin/reports?view=product-cash-flow&from=2026-05-01&to=2026-05-31&location_id='.$other->id)
            ->assertOk()->assertJsonPath('props.productCashFlowReport.rows.total', 2)
            ->assertJsonPath('props.productCashFlowReport.summary.purchases', '30.000000')
            ->assertJsonPath('props.productCashFlowReport.summary.sales', '200.00');
    }

    public function test_sales_permission_is_required(): void
    {
        [$user] = $this->fixture();
        $user->roles()->first()->permissions()->sync(Permission::where('name', 'reports.inventory')->pluck('id'));
        $user->unsetRelation('roles');
        $this->actingAs($user)->getJson('/admin/reports?view=product-cash-flow')->assertForbidden();
        $this->getJson('/admin/reports/export?view=product-cash-flow')->assertForbidden();
    }
}
