<?php

namespace Tests\Feature;

use App\Events\InventoryBalanceChanged;
use App\Models\Category;
use App\Models\FlashSale;
use App\Models\FlashSaleItem;
use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\PosRegister;
use App\Models\PosShift;
use App\Models\User;
use App\Services\FlashSalePricingService;
use App\Services\Inventory\InventoryService;
use App\Services\Inventory\StorefrontInventoryService;
use App\Services\Inventory\StockTransferService;
use App\Services\POS\PosCheckoutService;
use App\Services\POS\PosShiftService;
use App\Services\OrderManagementService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ProductUnitArchitectureTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_code_is_generated_and_barcode_is_unique_per_product(): void
    {
        [$product] = $this->productWithUnits(barcode: '885000000001');

        $this->assertMatchesRegularExpression('/^PRD-\d{6}-[A-Z0-9]+$/', $product->product_code);
        $this->expectException(QueryException::class);
        $this->productWithUnits(barcode: '885000000001');
    }

    public function test_variant_tables_and_identifiers_are_absent_from_the_schema(): void
    {
        $this->assertFalse(Schema::hasTable('skus'));
        $this->assertFalse(Schema::hasColumn('order_items', 'sku_id'));
        $this->assertTrue(Schema::hasColumn('order_items', 'product_unit_id'));
        $this->assertTrue(Schema::hasColumn('inventory_balances', 'product_id'));
        $this->assertTrue(Schema::hasTable('product_price_types'));
        $this->assertTrue(Schema::hasColumn('product_unit_prices', 'product_price_type_id'));
        $this->assertFalse(Schema::hasColumn('product_unit_prices', 'price_type'));
    }

    public function test_units_convert_to_and_from_the_base_unit(): void
    {
        [, $piece, $box] = $this->productWithUnits();

        $this->assertSame(12.0, $box->toBaseQuantity(1));
        $this->assertSame(2.0, $box->fromBaseQuantity(24));
        $this->assertSame(1.0, $piece->toBaseQuantity(1));
    }

    public function test_stock_is_stored_in_base_units_when_a_box_is_sold(): void
    {
        Event::fake([InventoryBalanceChanged::class]);
        [$product, , $box] = $this->productWithUnits();
        $location = $this->location();
        $inventory = app(InventoryService::class);

        $inventory->receive($location, $product, 24, idempotencyKey: 'receive-24');
        $movement = $inventory->completeSale(
            $location,
            $product,
            $box->toBaseQuantity(1),
            idempotencyKey: 'sell-box',
            unit: $box,
            unitQuantity: 1,
        );

        $balance = InventoryBalance::where('location_id', $location->id)
            ->where('product_id', $product->id)
            ->firstOrFail();
        $this->assertSame(12.0, (float) $balance->on_hand_qty);
        $this->assertSame(-12.0, (float) $movement->quantity_delta);
        $this->assertSame(1.0, (float) $movement->unit_quantity);
        $this->assertSame($box->id, $movement->product_unit_id);
        Event::assertDispatched(InventoryBalanceChanged::class, 2);
    }

    public function test_inventory_mutations_remain_idempotent_per_product(): void
    {
        [$product] = $this->productWithUnits();
        $location = $this->location();
        $inventory = app(InventoryService::class);

        $first = $inventory->receive($location, $product, 5, idempotencyKey: 'receipt-line-1');
        $second = $inventory->receive($location, $product, 5, idempotencyKey: 'receipt-line-1');

        $this->assertSame($first->id, $second->id);
        $this->assertSame(5.0, (float) InventoryBalance::whereBelongsTo($product)->firstOrFail()->on_hand_qty);
    }

    public function test_default_selling_unit_is_shown_only_when_a_complete_unit_is_available(): void
    {
        [$product] = $this->productWithUnits();

        $fullBox = $product->displayQuantity(25);
        $piecesOnly = $product->displayQuantity(11);

        $this->assertSame('BOX', $fullBox['unit']);
        $this->assertSame(2.0, $fullBox['quantity']);
        $this->assertSame('PC', $piecesOnly['unit']);
        $this->assertSame(11.0, $piecesOnly['quantity']);
    }

    public function test_each_unit_supports_dynamic_prices_with_retail_as_default(): void
    {
        [, , $box] = $this->productWithUnits();

        $this->assertSame(110.0, (float) $box->priceFor('retail')->price);
        $this->assertSame(96.0, (float) $box->priceFor('wholesale')->price);
    }

    public function test_storefront_availability_converts_base_stock_for_every_unit(): void
    {
        [$product, $piece, $box] = $this->productWithUnits();
        $location = $this->location(default: true);
        app(InventoryService::class)->receive($location, $product, 25);

        app(StorefrontInventoryService::class)->attachAvailableQuantities(collect([$product]), $location);

        $this->assertSame(25.0, (float) $piece->available_qty);
        $this->assertSame(2.0833, (float) $box->available_qty);
        $this->assertSame('BOX', $product->stock_display['unit']);
    }

    public function test_flash_sale_pricing_targets_a_product_unit(): void
    {
        [$product, , $box] = $this->productWithUnits();
        $sale = FlashSale::create([
            'name' => 'Box promotion',
            'starts_at' => now()->subMinute(),
            'ends_at' => now()->addHour(),
            'is_active' => true,
        ]);
        FlashSaleItem::create([
            'flash_sale_id' => $sale->id,
            'product_unit_id' => $box->id,
            'discount_type' => FlashSaleItem::TYPE_PERCENTAGE,
            'discount_value' => 10,
        ]);

        $product->load('units.prices');
        app(FlashSalePricingService::class)->attachToProducts(collect([$product]));
        $promotedBox = $product->units->firstWhere('id', $box->id);

        $this->assertSame(99.0, (float) $promotedBox->flash_sale['sale_price']);
        $this->assertArrayNotHasKey('flash_sale', $product->units->firstWhere('is_base', true)->getAttributes());
    }

    public function test_pos_attaches_a_different_foc_unit_to_the_same_paid_product_line(): void
    {
        [$product, $piece, $box] = $this->productWithUnits();
        // Keep this unit-conversion scenario above cost; losses have a separate test.
        $product->update(['original_price' => 6]);
        $location = $this->location();
        $cashier = User::factory()->create(['role' => 'super_admin']);
        $customer = User::factory()->create(['role' => User::CUSTOMER_ROLE]);
        $shift = $this->shift($location, $cashier);
        app(InventoryService::class)->receive($location, $product, 25, idempotencyKey: 'pos-foc-opening');

        $order = app(PosCheckoutService::class)->checkout([
            'location_id' => $location->id,
            'shift_id' => $shift->id,
            'customer_id' => $customer->id,
            'items' => [
                [
                    'product_unit_id' => $box->id,
                    'quantity' => 1,
                    'price_type' => 'wholesale',
                    'foc_quantity' => 2,
                    'foc_product_unit_id' => $piece->id,
                ],
            ],
            'tender_type' => 'cash',
            'amount_tendered' => 100,
        ], $cashier);

        $paidLine = $order->items->sole();
        $balance = InventoryBalance::where('location_id', $location->id)->where('product_id', $product->id)->firstOrFail();

        $this->assertSame(96.0, (float) $order->total_amount);
        $this->assertSame(96.0, (float) $order->final_amount);
        $this->assertMatchesRegularExpression('/^POS-\d{6}-\d{6}$/', $order->order_number);
        $this->assertMatchesRegularExpression('/^RCT-\d{6}-\d{6}$/', $order->receipt_number);
        $this->assertSame($shift->id, $order->shift_id);
        $this->assertSame($shift->pos_register_id, $order->register_id);
        $this->assertSame(4.0, (float) $order->payments->sole()->change_due);
        $this->assertSame(0.0, (float) $shift->fresh()->cash_sales);
        $this->assertSame('wholesale', $paidLine->price_type);
        $this->assertSame(96.0, (float) $paidLine->unit_price);
        $this->assertSame($piece->id, $paidLine->foc_product_unit_id);
        $this->assertSame(2.0, (float) $paidLine->foc_quantity);
        $this->assertSame(2.0, (float) $paidLine->foc_base_quantity);
        $this->assertSame(12.0, (float) $paidLine->foc_cost_price);
        $this->assertSame(96.0, (float) $paidLine->total_price);
        $this->assertSame(11.0, (float) $balance->on_hand_qty);
    }

    public function test_pos_uses_retail_price_when_wholesale_price_is_missing(): void
    {
        [$product, , $box] = $this->productWithUnits();
        $box->priceFor('wholesale')->delete();
        $location = $this->location();
        $cashier = User::factory()->create(['role' => 'super_admin']);
        $shift = $this->shift($location, $cashier);
        app(InventoryService::class)->receive($location, $product, 12);

        $order = app(PosCheckoutService::class)->checkout([
            'location_id' => $location->id,
            'shift_id' => $shift->id,
            'items' => [[
                'product_unit_id' => $box->id,
                'quantity' => 1,
                'price_type' => 'wholesale',
                'expected_unit_price' => 110,
            ]],
            'tender_type' => 'cash',
            'amount_tendered' => 110,
        ], $cashier);

        $this->assertSame(110.0, (float) $order->final_amount);
        $this->assertSame('retail', $order->items->sole()->price_type);
        $this->assertSame(110.0, (float) $order->items->sole()->unit_price);
    }

    public function test_pos_uses_retail_price_when_wholesale_price_is_zero(): void
    {
        [$product, $piece] = $this->productWithUnits();
        $piece->priceFor('wholesale')->update(['price' => 0]);
        $location = $this->location();
        $cashier = User::factory()->create(['role' => 'super_admin']);
        $shift = $this->shift($location, $cashier);
        app(InventoryService::class)->receive($location, $product, 1);

        $order = app(PosCheckoutService::class)->checkout([
            'location_id' => $location->id,
            'shift_id' => $shift->id,
            'items' => [[
                'product_unit_id' => $piece->id,
                'quantity' => 1,
                'price_type' => 'wholesale',
                'expected_unit_price' => 10,
            ]],
            'tender_type' => 'cash',
            'amount_tendered' => 10,
        ], $cashier);

        $this->assertSame(10.0, (float) $order->final_amount);
        $this->assertSame('retail', $order->items->sole()->price_type);
        $this->assertSame(10.0, (float) $order->items->sole()->unit_price);
    }

    public function test_pos_rejects_loss_after_discount_and_free_stock_without_posting(): void
    {
        [$product, $piece] = $this->productWithUnits();
        $product->update(['original_price' => 10]);
        $piece->prices()->update(['price' => 20]);
        $location = $this->location();
        $cashier = User::factory()->create(['role' => 'super_admin']);
        $shift = $this->shift($location, $cashier);
        app(InventoryService::class)->receive($location, $product, 25, idempotencyKey: 'loss-opening');
        foreach ([[11, 0], [1, 1]] as [$discount, $free]) {
            try {
                app(PosCheckoutService::class)->checkout(['location_id' => $location->id, 'shift_id' => $shift->id,
                    'items' => [['product_unit_id' => $piece->id, 'quantity' => 1, 'price_type' => 'retail', 'foc_quantity' => $free, 'foc_product_unit_id' => $piece->id]],
                    'discount_type' => 'amount', 'discount_value' => $discount, 'tender_type' => 'cash', 'amount_tendered' => 20], $cashier);
                $this->fail('Loss-making sale was accepted.');
            } catch (ValidationException $exception) {
                $this->assertStringContainsString('below accounting cost', $exception->errors()['items'][0]);
            }
        }
        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('financial_entries', 0);
        $this->assertEquals(25, InventoryBalance::where('product_id', $product->id)->where('location_id', $location->id)->value('on_hand_qty'));
    }

    public function test_pos_accepts_a_walk_in_cash_sale_without_a_customer_account(): void
    {
        [$product, $piece] = $this->productWithUnits();
        $location = $this->location();
        $cashier = User::factory()->create(['role' => 'super_admin']);
        $shift = $this->shift($location, $cashier);
        app(InventoryService::class)->receive($location, $product, 5, idempotencyKey: 'walk-in-opening');

        $order = app(PosCheckoutService::class)->checkout([
            'location_id' => $location->id,
            'shift_id' => $shift->id,
            'customer_id' => null,
            'customer_name' => 'Walk-in customer',
            'items' => [[
                'product_unit_id' => $piece->id,
                'quantity' => 1,
                'price_type' => 'retail',
            ]],
            'tender_type' => 'cash',
            'amount_tendered' => 10,
        ], $cashier);

        $this->assertNull($order->user_id);
        $this->assertSame('Walk-in customer', $order->receiver_name);
        $this->assertSame('paid', $order->payment_status);
        $this->assertSame('cash', $order->payment_method);
    }

    public function test_pos_mmqr_sale_is_recorded_in_payment_and_shift_totals(): void
    {
        [$product, $piece] = $this->productWithUnits();
        $location = $this->location();
        $cashier = User::factory()->create(['role' => 'super_admin']);
        $shift = $this->shift($location, $cashier);
        app(InventoryService::class)->receive($location, $product, 5, idempotencyKey: 'mmqr-opening');

        $order = app(PosCheckoutService::class)->checkout([
            'location_id' => $location->id,
            'shift_id' => $shift->id,
            'items' => [['product_unit_id' => $piece->id, 'quantity' => 1, 'price_type' => 'retail']],
            'tender_type' => 'mmqr',
            'amount_tendered' => 10,
        ], $cashier);

        $this->assertSame('mmqr', $order->payment_method);
        $this->assertSame('mmqr', $order->payments->sole()->tender_type);
        $this->assertEquals(10, app(PosShiftService::class)->summary($shift)['mmqr_sales_total']);
        $this->assertEquals(0, app(PosShiftService::class)->summary($shift)['net_cash_sales']);
        $closedShift = app(PosShiftService::class)->close($shift, $cashier, 1000);
        $this->assertEquals(10, $closedShift->mmqr_sales_total);
        $this->assertEquals(1000, $closedShift->expected_cash);
    }

    public function test_pos_rejects_card_and_mobile_tenders(): void
    {
        [$product, $piece] = $this->productWithUnits();
        $location = $this->location();
        $cashier = User::factory()->create(['role' => 'super_admin']);
        $shift = $this->shift($location, $cashier);
        app(InventoryService::class)->receive($location, $product, 5, idempotencyKey: 'old-tender-opening');

        foreach (['card', 'mobile'] as $tenderType) {
            try {
                app(PosCheckoutService::class)->checkout([
                    'location_id' => $location->id,
                    'shift_id' => $shift->id,
                    'items' => [['product_unit_id' => $piece->id, 'quantity' => 1, 'price_type' => 'retail']],
                    'tender_type' => $tenderType,
                    'amount_tendered' => 10,
                ], $cashier);
                $this->fail("{$tenderType} tender should be rejected.");
            } catch (ValidationException $exception) {
                $this->assertArrayHasKey('tender_type', $exception->errors());
            }
        }
    }

    public function test_pos_walk_in_customer_cannot_use_credit(): void
    {
        [$product, $piece] = $this->productWithUnits();
        $location = $this->location();
        $cashier = User::factory()->create(['role' => 'super_admin']);
        $shift = $this->shift($location, $cashier);
        app(InventoryService::class)->receive($location, $product, 5, idempotencyKey: 'walk-in-credit-opening');

        try {
            app(PosCheckoutService::class)->checkout([
                'location_id' => $location->id,
                'shift_id' => $shift->id,
                'customer_id' => null,
                'customer_name' => 'Walk-in customer',
                'items' => [[
                    'product_unit_id' => $piece->id,
                    'quantity' => 1,
                    'price_type' => 'retail',
                ]],
                'tender_type' => 'credit',
                'amount_tendered' => 0,
            ], $cashier);
            $this->fail('A walk-in customer was allowed to use credit.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('customer_id', $exception->errors());
        }
    }

    public function test_pos_derives_a_missing_unit_price_from_the_base_unit_and_conversion(): void
    {
        [$product, $piece, $box] = $this->productWithUnits();
        $location = $this->location();
        $cashier = User::factory()->create(['role' => 'super_admin']);
        $customer = User::factory()->create(['role' => User::CUSTOMER_ROLE]);
        $shift = $this->shift($location, $cashier);
        app(InventoryService::class)->receive($location, $product, 24, idempotencyKey: 'pos-derived-price-opening');

        $box->priceFor('retail')->update(['price' => 0]);

        $order = app(PosCheckoutService::class)->checkout([
            'location_id' => $location->id,
            'shift_id' => $shift->id,
            'customer_id' => $customer->id,
            'items' => [[
                'product_unit_id' => $box->id,
                'quantity' => 2,
                'price_type' => 'retail',
            ]],
            'tender_type' => 'cash',
            'amount_tendered' => 240,
        ], $cashier);

        $line = $order->items->sole();

        $this->assertSame(120.0, (float) $line->unit_price);
        $this->assertSame(240.0, (float) $line->total_price);
        $this->assertSame(240.0, (float) $order->final_amount);
    }

    public function test_pos_foc_requires_discount_permission(): void
    {
        [$product, $piece] = $this->productWithUnits();
        $location = $this->location();
        $cashier = User::factory()->create(['role' => 'staff']);
        $customer = User::factory()->create(['role' => User::CUSTOMER_ROLE]);
        $cashier->locations()->attach($location->id, ['is_default' => true]);
        $shift = $this->shift($location, $cashier);
        app(InventoryService::class)->receive($location, $product, 5, idempotencyKey: 'pos-foc-denied-opening');

        $this->expectException(ValidationException::class);
        app(PosCheckoutService::class)->checkout([
            'location_id' => $location->id,
            'shift_id' => $shift->id,
            'customer_id' => $customer->id,
            'items' => [
                ['product_unit_id' => $piece->id, 'quantity' => 1, 'price_type' => 'retail', 'foc_quantity' => 1, 'foc_product_unit_id' => $piece->id],
            ],
            'tender_type' => 'cash',
            'amount_tendered' => 10,
        ], $cashier);
    }

    public function test_pos_foc_unit_must_belong_to_the_paid_product(): void
    {
        [$product, $piece] = $this->productWithUnits();
        [, $otherPiece] = $this->productWithUnits();
        $location = $this->location();
        $cashier = User::factory()->create(['role' => 'super_admin']);
        $customer = User::factory()->create(['role' => User::CUSTOMER_ROLE]);
        $shift = $this->shift($location, $cashier);
        app(InventoryService::class)->receive($location, $product, 5, idempotencyKey: 'pos-foc-product-opening');

        $this->expectException(ValidationException::class);
        app(PosCheckoutService::class)->checkout([
            'location_id' => $location->id,
            'shift_id' => $shift->id,
            'customer_id' => $customer->id,
            'items' => [
                ['product_unit_id' => $piece->id, 'quantity' => 1, 'price_type' => 'retail', 'foc_quantity' => 1, 'foc_product_unit_id' => $otherPiece->id],
            ],
            'tender_type' => 'cash',
            'amount_tendered' => 10,
        ], $cashier);
    }

    public function test_pos_credit_sale_records_deposit_balance_due_date_and_ledger(): void
    {
        [$product, $piece] = $this->productWithUnits();
        $location = $this->location();
        $cashier = User::factory()->create(['role' => 'super_admin']);
        $customer = User::factory()->create([
            'role' => User::CUSTOMER_ROLE,
            'credit_status' => 'active',
            'credit_limit' => 100,
            'credit_terms_days' => 14,
        ]);
        $shift = $this->shift($location, $cashier);
        app(InventoryService::class)->receive($location, $product, 5, idempotencyKey: 'credit-sale-stock');

        $order = app(PosCheckoutService::class)->checkout([
            'location_id' => $location->id,
            'shift_id' => $shift->id,
            'customer_id' => $customer->id,
            'items' => [['product_unit_id' => $piece->id, 'quantity' => 1, 'price_type' => 'retail']],
            'tender_type' => 'credit',
            'amount_tendered' => 2,
            'credit_deposit_method' => 'cash',
        ], $cashier);

        $this->assertSame('partially_paid', $order->payment_status);
        $this->assertSame(2.0, (float) $order->paid_amount);
        $this->assertSame(8.0, (float) $order->credit_amount);
        $this->assertSame(now()->addDays(14)->toDateString(), $order->credit_due_date->toDateString());
        $this->assertSame(2.0, (float) $order->payments->sole()->amount);
        $this->assertSame(0.0, (float) $shift->fresh()->cash_sales);
        $this->assertDatabaseHas('customer_credit_transactions', [
            'customer_id' => $customer->id,
            'order_id' => $order->id,
            'type' => 'sale',
            'amount' => 8,
            'balance_after' => 8,
        ]);
    }

    public function test_pos_credit_sale_cannot_exceed_customer_limit(): void
    {
        [$product, $piece] = $this->productWithUnits();
        $location = $this->location();
        $cashier = User::factory()->create(['role' => 'super_admin']);
        $customer = User::factory()->create([
            'role' => User::CUSTOMER_ROLE,
            'credit_status' => 'active',
            'credit_limit' => 5,
        ]);
        $shift = $this->shift($location, $cashier);
        app(InventoryService::class)->receive($location, $product, 5, idempotencyKey: 'credit-limit-stock');

        $this->expectException(ValidationException::class);
        app(PosCheckoutService::class)->checkout([
            'location_id' => $location->id,
            'shift_id' => $shift->id,
            'customer_id' => $customer->id,
            'items' => [['product_unit_id' => $piece->id, 'quantity' => 1, 'price_type' => 'retail']],
            'tender_type' => 'credit',
            'amount_tendered' => 0,
        ], $cashier);
    }

    public function test_credit_repayment_updates_order_ledger_and_cash_shift(): void
    {
        [$product, $piece] = $this->productWithUnits();
        $location = $this->location();
        $cashier = User::factory()->create(['role' => 'super_admin']);
        $cashier->roles()->sync([\App\Models\Role::where('name', 'super_admin')->value('id')]);
        $customer = User::factory()->create(['role' => User::CUSTOMER_ROLE, 'credit_status' => 'active', 'credit_limit' => 100]);
        $shift = $this->shift($location, $cashier);
        app(InventoryService::class)->receive($location, $product, 5, idempotencyKey: 'credit-payment-stock');
        $order = app(PosCheckoutService::class)->checkout([
            'location_id' => $location->id,
            'shift_id' => $shift->id,
            'customer_id' => $customer->id,
            'items' => [['product_unit_id' => $piece->id, 'quantity' => 1, 'price_type' => 'retail']],
            'tender_type' => 'credit',
            'amount_tendered' => 2,
            'credit_deposit_method' => 'cash',
        ], $cashier);

        $this->post('/admin/login', ['email' => $cashier->email, 'password' => 'password'])->assertRedirect();

        $response = $this->post("/admin/customers/{$customer->id}/credit-payments", [
            'order_id' => $order->id,
            'amount' => 3,
            'tender_type' => 'cash',
            'shift_id' => $shift->id,
            'notes' => 'Part payment',
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('success', 'Credit payment recorded.');
        $this->assertSame(5.0, (float) $order->fresh()->paid_amount);
        $this->assertSame('partially_paid', $order->fresh()->payment_status);
        $this->assertSame(5.0, (float) $customer->creditTransactions()->latest()->first()->balance_after);
        $this->assertSame(0.0, (float) $shift->fresh()->cash_sales);
    }

    public function test_account_credit_payment_is_allocated_to_oldest_due_invoices_first(): void
    {
        [$product, $piece] = $this->productWithUnits();
        $location = $this->location();
        $cashier = User::factory()->create(['role' => 'super_admin']);
        $cashier->roles()->sync([\App\Models\Role::where('name', 'super_admin')->value('id')]);
        $customer = User::factory()->create(['role' => User::CUSTOMER_ROLE, 'credit_status' => 'active', 'credit_limit' => 100]);
        $shift = $this->shift($location, $cashier);
        app(InventoryService::class)->receive($location, $product, 5, idempotencyKey: 'credit-fifo-stock');

        $first = app(PosCheckoutService::class)->checkout([
            'location_id' => $location->id, 'shift_id' => $shift->id, 'customer_id' => $customer->id,
            'items' => [['product_unit_id' => $piece->id, 'quantity' => 1, 'price_type' => 'retail']],
            'tender_type' => 'credit', 'amount_tendered' => 0,
        ], $cashier);
        $second = app(PosCheckoutService::class)->checkout([
            'location_id' => $location->id, 'shift_id' => $shift->id, 'customer_id' => $customer->id,
            'items' => [['product_unit_id' => $piece->id, 'quantity' => 1, 'price_type' => 'retail']],
            'tender_type' => 'credit', 'amount_tendered' => 0,
        ], $cashier);
        $first->update(['credit_due_date' => now()->subDay()]);
        $second->update(['credit_due_date' => now()->addDay()]);

        $this->post('/admin/login', ['email' => $cashier->email, 'password' => 'password'])->assertRedirect();
        $this->post("/admin/customers/{$customer->id}/credit-payments", [
            'order_id' => '', 'amount' => 15, 'tender_type' => 'mobile', 'reference' => 'FIFO-TEST',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $this->assertSame('paid', $first->fresh()->payment_status);
        $this->assertSame(10.0, (float) $first->fresh()->paid_amount);
        $this->assertSame('partially_paid', $second->fresh()->payment_status);
        $this->assertSame(5.0, (float) $second->fresh()->paid_amount);
        $this->assertDatabaseHas('payments', ['order_id' => $first->id, 'transaction_id' => 'FIFO-TEST-1', 'amount' => 10]);
        $this->assertDatabaseHas('payments', ['order_id' => $second->id, 'transaction_id' => 'FIFO-TEST-2', 'amount' => 5]);
    }

    public function test_unpaid_credit_order_cancellation_reverses_debt_and_restores_stock(): void
    {
        [$product, $piece] = $this->productWithUnits();
        $location = $this->location();
        $cashier = User::factory()->create(['role' => 'super_admin']);
        $customer = User::factory()->create(['role' => User::CUSTOMER_ROLE, 'credit_status' => 'active', 'credit_limit' => 100]);
        $shift = $this->shift($location, $cashier);
        app(InventoryService::class)->receive($location, $product, 5, idempotencyKey: 'credit-cancel-stock');
        $order = app(PosCheckoutService::class)->checkout([
            'location_id' => $location->id,
            'shift_id' => $shift->id,
            'customer_id' => $customer->id,
            'items' => [['product_unit_id' => $piece->id, 'quantity' => 1, 'price_type' => 'retail']],
            'tender_type' => 'credit',
            'amount_tendered' => 0,
        ], $cashier);

        app(OrderManagementService::class)->cancelOrder($order, $cashier, 'Customer cancelled', restoreStock: true);

        $this->assertSame('cancelled', $order->fresh()->status);
        $this->assertSame('cancelled', $order->fresh()->payment_status);
        $this->assertSame(0.0, (float) $customer->creditTransactions()->latest()->first()->balance_after);
        $this->assertSame(5.0, (float) InventoryBalance::where('location_id', $location->id)->where('product_id', $product->id)->value('on_hand_qty'));
    }

    public function test_closed_shift_rejects_a_stale_sale_without_changing_stock(): void
    {
        [$product, $piece] = $this->productWithUnits();
        $location = $this->location();
        $cashier = User::factory()->create(['role' => 'super_admin']);
        $customer = User::factory()->create(['role' => User::CUSTOMER_ROLE]);
        $shift = $this->shift($location, $cashier);
        app(InventoryService::class)->receive($location, $product, 5, idempotencyKey: 'closed-shift-stock');
        app(PosShiftService::class)->close($shift, $cashier, 1000);

        try {
            app(PosCheckoutService::class)->checkout([
                'location_id' => $location->id,
                'shift_id' => $shift->id,
                'customer_id' => $customer->id,
                'items' => [['product_unit_id' => $piece->id, 'quantity' => 1, 'price_type' => 'retail']],
                'tender_type' => 'cash',
                'amount_tendered' => 10,
            ], $cashier);
            $this->fail('A closed shift accepted a sale.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('shift_id', $exception->errors());
        }

        $this->assertSame(5.0, (float) InventoryBalance::where('location_id', $location->id)->where('product_id', $product->id)->value('on_hand_qty'));
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_stock_transfer_preserves_value_without_external_income_or_purchase(): void
    {
        [$product, , $box] = $this->productWithUnits();
        $source = $this->location();
        $destination = $this->location();
        $actor = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        app(InventoryService::class)->receive($source, $product, 24, idempotencyKey: 'valued-transfer-stock');

        $transfer = app(StockTransferService::class)->transferNow(
            $source,
            $destination,
            [['product_unit_id' => $box->id, 'requested_quantity' => 2]],
            $actor,
        );

        $this->assertSame(192.0, (float) $transfer->total_amount);
        $this->assertSame(96.0, (float) $transfer->items->sole()->unit_cost);
        $this->assertSame(192.0, (float) $transfer->items->sole()->line_total);
        $this->assertSame(0.0, (float) InventoryBalance::whereBelongsTo($source)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertSame(24.0, (float) InventoryBalance::whereBelongsTo($destination)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertDatabaseMissing('financial_entries', ['stock_transfer_id' => $transfer->id]);

        $csv = $this->actingAs($actor)->get('/admin/inventory/transfers/export?source='.$source->id);
        $csv->assertOk()->assertDownload();
        $this->assertStringContainsString('FILTERED OVERALL SUMMARY', $csv->streamedContent());
        $this->assertStringContainsString($transfer->transfer_number, $csv->streamedContent());
        $this->assertStringContainsString($destination->name, $csv->streamedContent());
    }

    /** @return array{Product, ProductUnit, ProductUnit} */
    public function test_online_checkout_rejects_below_cost_even_with_shipping_collected(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');
        [$product, $piece] = $this->productWithUnits();
        $piece->prices()->update(['price' => 1]);
        $location = $this->location(true);
        app(InventoryService::class)->receive($location, $product, 25, idempotencyKey: 'online-loss-opening');
        $method = \App\Models\PaymentMethod::create(['banking_service' => 'Test', 'account_name' => 'Store', 'account_no' => '123', 'is_active' => true]);
        $user = User::factory()->create(['role' => User::CUSTOMER_ROLE]);
        $this->actingAs($user)->postJson('/checkout', [
            'lines' => [['product_unit_id' => $piece->id, 'quantity' => 1]],
            'receiver_name' => 'Customer', 'receiver_phone' => '091234567', 'shipping_address' => 'Test address',
            'payment_method_id' => $method->id, 'payment_proof' => \Illuminate\Http\UploadedFile::fake()->createWithContent('proof.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE9sAAAAASUVORK5CYII=')),
        ])->assertStatus(422)->assertJsonValidationErrors('lines')->assertJsonPath('errors.lines.0', 'The current prices and discounts cannot be applied to this order. Please remove discounts or contact the store.');
        $this->assertDatabaseCount('orders', 0);
        $this->assertEquals(0, InventoryBalance::where('product_id', $product->id)->where('location_id', $location->id)->value('reserved_qty'));
    }

    private function productWithUnits(?string $barcode = null): array
    {
        $category = Category::create([
            'name' => 'Category '.uniqid(),
            'slug' => 'category-'.uniqid(),
            'is_active' => true,
        ]);
        $product = Product::create([
            'category_id' => $category->id,
            'barcode' => $barcode,
            'name' => 'Product '.uniqid(),
            'slug' => 'product-'.uniqid(),
            'description' => 'Unit conversion test product',
            'min_quantity' => 6,
            'original_price' => 8,
            'status' => 'active',
            'is_active' => true,
        ]);
        $piece = $product->units()->create([
            'name' => 'Piece',
            'code' => 'PC',
            'conversion_factor' => 1,
            'is_base' => true,
            'is_default_selling' => false,
            'is_active' => true,
            'sort_order' => 0,
        ]);
        $box = $product->units()->create([
            'name' => 'Box',
            'code' => 'BOX',
            'conversion_factor' => 12,
            'is_base' => false,
            'is_default_selling' => true,
            'is_active' => true,
            'sort_order' => 1,
        ]);
        $retail = $product->priceTypes()->create(['name' => 'retail', 'is_default' => true, 'sort_order' => 0]);
        $wholesale = $product->priceTypes()->create(['name' => 'wholesale', 'is_default' => false, 'sort_order' => 1]);
        $piece->prices()->createMany([
            ['product_price_type_id' => $retail->id, 'price' => 10],
            ['product_price_type_id' => $wholesale->id, 'price' => 8],
        ]);
        $box->prices()->createMany([
            ['product_price_type_id' => $retail->id, 'price' => 110],
            ['product_price_type_id' => $wholesale->id, 'price' => 96],
        ]);
        $piece->load('prices');
        $box->load('prices');
        $product->setRelation('units', collect([$piece, $box]));
        $product->setRelation('baseUnit', $piece);
        $product->setRelation('defaultSellingUnit', $box);

        return [$product, $piece, $box];
    }

    private function location(bool $default = false): Location
    {
        return Location::create([
            'code' => 'WH-'.uniqid(),
            'name' => 'Warehouse '.uniqid(),
            'type' => 'warehouse',
            'timezone' => 'Asia/Rangoon',
            'is_active' => true,
            'is_default_fulfillment' => $default,
            'is_system' => false,
        ]);
    }

    private function shift(Location $location, User $cashier): PosShift
    {
        $register = PosRegister::create([
            'location_id' => $location->id,
            'code' => 'REG-'.uniqid(),
            'name' => 'Register '.uniqid(),
            'is_active' => true,
        ]);

        return PosShift::create([
            'pos_register_id' => $register->id,
            'location_id' => $location->id,
            'cashier_id' => $cashier->id,
            'status' => 'open',
            'open_slot' => 1,
            'opening_cash' => 1000,
            'expected_cash' => 1000,
            'opened_at' => now(),
        ]);
    }
}
