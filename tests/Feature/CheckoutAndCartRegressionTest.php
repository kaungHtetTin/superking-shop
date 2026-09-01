<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheckoutAndCartRegressionTest extends TestCase
{
    use RefreshDatabase;

    public function test_cart_selling_units_endpoint_returns_piece_and_box_with_converted_stock(): void
    {
        $category = Category::create([
            'name' => 'Test instruments',
            'slug' => 'test-instruments',
            'is_active' => true,
        ]);
        $product = Product::create([
            'category_id' => $category->id,
            'product_code' => 'PRD-CART-UNIT',
            'barcode' => '880000000001',
            'name' => 'Cart unit product',
            'slug' => 'cart-unit-product',
            'description' => 'Customer cart unit regression product',
            'min_quantity' => 1,
            'original_price' => 100,
            'status' => 'active',
            'is_active' => true,
        ]);
        $piece = $product->units()->create([
            'name' => 'Piece',
            'code' => 'pc',
            'conversion_factor' => 1,
            'is_base' => true,
            'is_default_selling' => true,
            'is_active' => true,
            'sort_order' => 0,
        ]);
        $box = $product->units()->create([
            'name' => 'Box',
            'code' => 'box',
            'conversion_factor' => 10,
            'is_base' => false,
            'is_default_selling' => false,
            'is_active' => true,
            'sort_order' => 1,
        ]);
        $retail = $product->priceTypes()->create([
            'name' => 'retail',
            'is_default' => true,
            'sort_order' => 0,
        ]);
        $piece->prices()->create(['product_price_type_id' => $retail->id, 'price' => 150]);
        $box->prices()->create(['product_price_type_id' => $retail->id, 'price' => 1400]);
        $location = Location::create([
            'code' => 'CART-WH',
            'name' => 'Cart Warehouse',
            'type' => 'warehouse',
            'timezone' => 'Asia/Yangon',
            'is_active' => true,
            'is_default_fulfillment' => true,
            'is_system' => false,
        ]);
        InventoryBalance::create([
            'location_id' => $location->id,
            'product_id' => $product->id,
            'on_hand_qty' => 25,
            'reserved_qty' => 0,
            'version' => 1,
        ]);

        $response = $this->postJson('/cart/selling-units', ['product_ids' => [$product->id]]);

        $response->assertOk()
            ->assertJsonPath("products.{$product->id}.0.name", 'Piece')
            ->assertJsonPath("products.{$product->id}.0.available_qty", 25)
            ->assertJsonPath("products.{$product->id}.1.name", 'Box')
            ->assertJsonPath("products.{$product->id}.1.available_qty", 2.5);
    }

    public function test_oversized_checkout_request_returns_payment_proof_error_instead_of_exception_page(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->call(
            'POST',
            '/checkout',
            [],
            [],
            [],
            [
                'CONTENT_LENGTH' => 20 * 1024 * 1024,
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest',
            ]
        );

        $response->assertStatus(413)
            ->assertJsonPath('errors.payment_proof.0', 'The payment screenshot is too large. Please upload an image no larger than 10 MB.');
    }

    public function test_inactive_category_product_cannot_be_quoted_by_a_crafted_checkout_request(): void
    {
        $user = User::factory()->create();
        $category = Category::create(['name' => 'Hidden', 'slug' => 'hidden', 'is_active' => false]);
        $product = Product::create([
            'category_id' => $category->id,
            'product_code' => 'PRD-HIDDEN',
            'barcode' => '880000000099',
            'name' => 'Hidden product',
            'slug' => 'hidden-product',
            'min_quantity' => 0,
            'original_price' => 10,
            'status' => 'active',
            'is_active' => true,
        ]);
        $unit = $product->units()->create([
            'name' => 'Piece', 'code' => 'pc', 'conversion_factor' => 1,
            'is_base' => true, 'is_default_selling' => true, 'is_active' => true,
        ]);
        $retail = $product->priceTypes()->create(['name' => 'retail', 'is_default' => true]);
        $unit->prices()->create(['product_price_type_id' => $retail->id, 'price' => 20]);

        $this->actingAs($user)->postJson('/checkout/quote', [
            'lines' => [['product_unit_id' => $unit->id, 'quantity' => 1]],
        ])->assertUnprocessable()->assertJsonValidationErrors('lines');
    }
}
