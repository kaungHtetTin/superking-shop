<?php

namespace Tests\Feature;

use App\Models\{Category, FinancialEntry, InventoryBalance, Location, Order, Product, User};
use App\Services\Inventory\{InventoryService, StockAdjustmentService, StockReceiptService, StockTransferService};
use App\Services\{OperationsReportService, OrderManagementService};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class InventoryFinancialConsistencyTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $actor = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $location = Location::create(['name' => 'Financial test store', 'code' => 'FIN-'.uniqid(), 'type' => 'warehouse', 'is_active' => true, 'timezone' => 'Asia/Rangoon']);
        $category = Category::create(['name' => 'Finance', 'slug' => 'fin-'.uniqid(), 'is_active' => true]);
        $product = Product::create(['category_id' => $category->id, 'name' => 'Test stock', 'slug' => 'stock-'.uniqid(), 'description' => 'Test', 'original_price' => 10, 'min_quantity' => 0, 'status' => 'active', 'is_active' => true]);
        $unit = $product->units()->create(['name' => 'Piece', 'code' => 'PC', 'conversion_factor' => 1, 'is_base' => true, 'is_default_selling' => true, 'is_active' => true]);
        app(InventoryService::class)->receive($location, $product, 10);
        return [$actor, $location, $product, $unit];
    }

    private function order(array $fixture, array $attributes = []): Order
    {
        [$actor, $location, $product, $unit] = $fixture;
        $order = Order::create(array_merge(['order_number' => 'FIN-'.uniqid(), 'receipt_number' => 'RCT-'.uniqid(), 'sales_channel' => 'pos', 'location_id' => $location->id, 'served_by' => $actor->id, 'total_amount' => 100, 'final_amount' => 100, 'discount_amount' => 0, 'shipping_fee' => 0, 'status' => 'delivered', 'payment_status' => 'paid', 'paid_amount' => 100, 'receiver_name' => 'Walk-in'], $attributes));
        $order->items()->create(['product_id' => $product->id, 'product_unit_id' => $unit->id, 'quantity' => 2, 'base_quantity' => 2, 'conversion_factor' => 1, 'unit_name' => 'Piece', 'unit_price' => 50, 'cost_price' => 10, 'total_price' => 100]);
        app(InventoryService::class)->completeSale($location, $product, 2, reference: $order);
        return $order;
    }

    private function entry(User $actor, Location $location, array $attributes = []): FinancialEntry
    {
        return FinancialEntry::create(array_merge(['recorded_by' => $actor->id, 'location_id' => $location->id, 'type' => 'income', 'category' => 'other_income', 'title' => 'Test entry', 'amount' => 100, 'entry_date' => now()->toDateString(), 'status' => 'approved'], $attributes));
    }

    private function summary(User $actor): array
    {
        return $this->actingAs($actor)->getJson('/admin/finance')->assertOk()->json('props.summary');
    }

    public function test_transfers_and_legacy_transfer_postings_do_not_inflate_profit_or_purchases(): void
    {
        [$actor, $source, $product, $unit] = $this->fixture();
        $destination = $source->replicate();
        $destination->code = 'DST-'.uniqid();
        $destination->save();
        $transfer = app(StockTransferService::class)->transferNow($source, $destination, [['product_unit_id' => $unit->id, 'requested_quantity' => 2]], $actor);
        $this->assertDatabaseMissing('financial_entries', ['stock_transfer_id' => $transfer->id]);
        $this->entry($actor, $source, ['category' => 'internal_transfer', 'reference' => $transfer->transfer_number]);
        $this->entry($actor, $destination, ['type' => 'expense', 'category' => 'stock_receipt', 'reference' => $transfer->transfer_number]);
        $summary = $this->summary($actor);
        $this->assertEquals(0, $summary['net_profit']);
        $this->assertEquals(0, $summary['stock_purchases']);
        $this->actingAs($actor)->getJson('/admin/reports?view=sales')->assertOk()->assertJsonPath('props.summary.net_profit', 0);
    }

    public function test_credit_revenue_and_cost_are_recognized_before_collection_and_do_not_move_on_payment(): void
    {
        $fixture = $this->fixture();
        [$actor, $location] = $fixture;
        $order = $this->order($fixture, ['payment_status' => 'partially_paid', 'credit_amount' => 75, 'paid_amount' => 25]);
        $this->entry($actor, $location, ['category' => 'pos_sale', 'amount' => 25]);
        $summary = $this->summary($actor);
        $this->assertEquals(100, $summary['order_revenue']);
        $this->assertEquals(20, $summary['cost_of_goods']);
        $this->assertEquals(80, $summary['net_profit']);
        $this->assertEquals(0, $summary['paid_orders']);
        $order->update(['payment_status' => 'paid', 'paid_amount' => 100]);
        $this->entry($actor, $location, ['category' => 'pos_sale', 'amount' => 75]);
        $this->assertEquals(80, $this->summary($actor)['net_profit']);
        $this->actingAs($actor)->getJson('/admin/reports?view=sales')->assertOk()->assertJsonPath('props.summary.net_profit', 80);
    }

    public function test_credit_collection_does_not_backdate_new_revenue_into_the_collection_period(): void
    {
        $fixture = $this->fixture();
        [$actor, $location] = $fixture;
        $order = $this->order($fixture, ['payment_status' => 'unpaid', 'credit_amount' => 100, 'paid_amount' => 0]);
        $order->forceFill(['created_at' => now()->subMonthsNoOverflow(2)])->save();
        $this->assertEquals(0, $this->summary($actor)['order_revenue']);
        $order->update(['payment_status' => 'paid', 'paid_amount' => 100]);
        $this->entry($actor, $location, ['category' => 'pos_sale']);
        $this->assertEquals(0, $this->summary($actor)['order_revenue']);
    }

    public function test_cancel_then_delete_keeps_payment_audit_and_never_restores_stock_twice(): void
    {
        $fixture = $this->fixture();
        [$actor, $location, $product] = $fixture;
        $order = $this->order($fixture);
        $payment = $order->payments()->create(['amount' => 100, 'amount_tendered' => 100, 'method' => 'cash', 'tender_type' => 'cash', 'status' => 'paid']);
        $this->entry($actor, $location, ['category' => 'pos_sale', 'reference' => $order->receipt_number]);
        app(OrderManagementService::class)->cancelOrder($order, $actor);
        app(OrderManagementService::class)->deleteOrderAsReturn($order->fresh(), $actor);
        app(OrderManagementService::class)->deleteOrderAsReturn($order->fresh(), $actor);
        $this->assertEquals(10, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertSame('cancelled', $order->fresh()->payment_status);
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'paid']);
        $this->assertDatabaseHas('financial_entries', ['reference' => 'order-refund:'.$order->id, 'category' => 'refund_payable', 'status' => 'pending', 'amount' => 100]);
        $summary = $this->summary($actor);
        $this->assertEquals(0, $summary['order_revenue']);
        $this->assertEquals(0, $summary['cost_of_goods']);
        $this->assertEquals(100, $summary['refunds_due']);
    }

    public function test_legacy_cancelled_paid_orders_are_not_reported_or_restocked_again(): void
    {
        $fixture = $this->fixture();
        [$actor, $location, $product] = $fixture;
        $order = $this->order($fixture, ['status' => 'cancelled']);
        app(InventoryService::class)->returnSale($location, $product, 2);
        app(OrderManagementService::class)->deleteOrderAsReturn($order, $actor);
        $this->assertEquals(10, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertEquals(0, $this->summary($actor)['net_profit']);
    }

    public function test_receipt_uses_weighted_cost_and_deletion_restores_original_cost(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $service = app(StockReceiptService::class);
        $receipt = $service->createDraft($location, [['product_unit_id' => $unit->id, 'received_quantity' => 10, 'unit_cost' => 20]], $actor);
        $service->post($receipt, $actor);
        $service->post($receipt, $actor);
        $this->assertEquals(15, $product->fresh()->original_price);
        $this->assertEquals(200, $this->summary($actor)['stock_purchases']);
        $service->delete($receipt, $actor);
        $this->assertEquals(10, $product->fresh()->original_price);
        $this->assertEquals(10, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertEquals(0, $this->summary($actor)['stock_purchases']);
    }

    public function test_receipt_reversal_with_later_stock_activity_is_rejected_atomically(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $service = app(StockReceiptService::class);
        $receipt = $service->createDraft($location, [['product_unit_id' => $unit->id, 'received_quantity' => 10, 'unit_cost' => 20]], $actor);
        $service->post($receipt, $actor);
        app(InventoryService::class)->completeSale($location, $product, 1);
        try {
            $service->delete($receipt, $actor);
            $this->fail('Receipt with dependent activity was deleted.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('receipt', $exception->errors());
        }
        $this->assertEquals(19, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertEquals(15, $product->fresh()->original_price);
        $this->assertDatabaseHas('financial_entries', ['reference' => $receipt->receipt_number, 'amount' => 200]);
    }

    public function test_receipts_without_cost_cannot_post_unvalued_stock(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $service = app(StockReceiptService::class);
        $receipt = $service->createDraft($location, [['product_unit_id' => $unit->id, 'received_quantity' => 10]], $actor);
        $this->expectException(ValidationException::class);
        $service->post($receipt, $actor);
    }

    public function test_adjustment_losses_and_gains_post_at_fixed_historical_cost(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $service = app(StockAdjustmentService::class);
        $loss = $service->createPosted($location, [['product_unit_id' => $unit->id, 'counted_quantity' => 8, 'notes' => 'Damaged']], 'damage', $actor);
        $this->assertEquals(-20, $loss->items->sole()->value_delta);
        $this->assertEquals(-20, $this->summary($actor)['net_profit']);
        $product->update(['original_price' => 50]);
        $inventory = app(OperationsReportService::class)->inventory($actor);
        $this->assertEquals(20, $inventory['adjustments']->first()->loss_value);
        $service->createPosted($location, [['product_unit_id' => $unit->id, 'counted_quantity' => 9]], 'physical_count', $actor);
        $this->assertEquals(30, $this->summary($actor)['net_profit']);
    }

    public function test_generated_financial_entries_cannot_be_changed_or_deleted_manually(): void
    {
        [$actor, $location] = $this->fixture();
        foreach (FinancialEntry::SYSTEM_CATEGORIES as $category) {
            $entry = $this->entry($actor, $location, ['category' => $category]);
            $this->actingAs($actor)->patch('/admin/finance/entries/'.$entry->id, ['amount' => 999])->assertSessionHas('error');
            $this->actingAs($actor)->delete('/admin/finance/entries/'.$entry->id)->assertSessionHas('error');
            $this->assertEquals(100, $entry->fresh()->amount);
        }
    }

    public function test_manual_entries_cannot_impersonate_system_categories(): void
    {
        [$actor, $location] = $this->fixture();
        foreach (FinancialEntry::SYSTEM_CATEGORIES as $category) {
            $this->actingAs($actor)->postJson('/admin/finance/entries', ['location_id' => $location->id, 'type' => 'income', 'category' => $category, 'title' => 'Forged', 'amount' => 10, 'entry_date' => now()->toDateString(), 'status' => 'approved'])
                ->assertUnprocessable()->assertJsonValidationErrors('category');
        }
    }

    public function test_online_payment_confirmation_snapshots_current_cost_and_records_collection(): void
    {
        $fixture = $this->fixture();
        [$actor, $location, $product] = $fixture;
        $order = $this->order($fixture, ['sales_channel' => 'online', 'status' => 'pending', 'payment_status' => 'pending_review', 'paid_amount' => 0]);
        // The fixture deducted stock; put it back to model an unfulfilled order.
        app(InventoryService::class)->returnSale($location, $product, 2);
        $product->update(['original_price' => 20]);
        app(\App\Services\OrderPaymentService::class)->confirmPayment($order, $actor);
        $this->assertEquals(100, $order->fresh()->paid_amount);
        $this->assertEquals(20, $order->items()->sole()->cost_price);
        $this->assertDatabaseHas('payments', ['order_id' => $order->id, 'amount' => 100, 'status' => 'paid']);
        $this->assertDatabaseHas('financial_entries', ['reference' => $order->order_number, 'amount' => 100, 'category' => 'pos_sale']);
        $this->assertEquals(60, $this->summary($actor)['net_profit']);
    }

    public function test_cancellation_restores_free_stock_and_only_the_unreturned_paid_quantity(): void
    {
        $fixture = $this->fixture();
        [$actor, $location, $product, $unit] = $fixture;
        $order = $this->order($fixture);
        $item = $order->items()->sole();
        $item->update(['foc_product_unit_id' => $unit->id, 'foc_quantity' => 1, 'foc_base_quantity' => 1, 'foc_cost_price' => 10]);
        app(InventoryService::class)->completeSale($location, $product, 1, reference: $order);
        app(InventoryService::class)->returnSale($location, $product, 1, reference: $order);
        $order->returns()->create(['order_item_id' => $item->id, 'quantity' => 1, 'status' => 'received', 'restocked_at' => now()]);
        app(OrderManagementService::class)->cancelOrder($order, $actor);
        app(OrderManagementService::class)->deleteOrderAsReturn($order->fresh(), $actor);
        $this->assertEquals(10, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
    }

    public function test_returned_stock_uses_sale_cost_even_after_a_new_purchase_cost(): void
    {
        $fixture = $this->fixture();
        [$actor, $location, $product, $unit] = $fixture;
        $order = $this->order($fixture);
        $service = app(StockReceiptService::class);
        $receipt = $service->createDraft($location, [['product_unit_id' => $unit->id, 'received_quantity' => 2, 'unit_cost' => 20]], $actor);
        $service->post($receipt, $actor);
        $this->assertEquals(12, $product->fresh()->original_price);
        app(OrderManagementService::class)->cancelOrder($order, $actor);
        $this->assertEquals(11.67, $product->fresh()->original_price);
    }

    public function test_historical_adjustments_are_flagged_instead_of_valued_at_todays_cost(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $adjustment = \App\Models\StockAdjustment::create(['adjustment_number' => 'OLD-'.uniqid(), 'location_id' => $location->id, 'reason_code' => 'damage', 'status' => 'posted', 'created_by' => $actor->id, 'posted_by' => $actor->id, 'posted_at' => now()]);
        $adjustment->items()->create(['product_id' => $product->id, 'product_unit_id' => $unit->id, 'conversion_factor' => 1, 'system_quantity' => 10, 'counted_quantity' => 9, 'base_counted_quantity' => 9, 'quantity_delta' => -1]);
        $this->assertEquals(1, $this->summary($actor)['unvalued_adjustment_lines']);
        $report = app(OperationsReportService::class)->inventory($actor);
        $this->assertEquals(1, $report['adjustments']->first()->unvalued_lines);
        $this->assertNull($report['adjustments']->first()->loss_value);
    }

    public function test_transfer_delete_does_not_delete_unrelated_manual_entry_with_same_reference(): void
    {
        [$actor, $source, $product, $unit] = $this->fixture();
        $destination = $source->replicate();
        $destination->code = 'OTHER-'.uniqid();
        $destination->save();
        $transfer = app(StockTransferService::class)->transferNow($source, $destination, [['product_unit_id' => $unit->id, 'requested_quantity' => 2]], $actor);
        $manual = $this->entry($actor, $source, ['reference' => $transfer->transfer_number]);
        app(StockTransferService::class)->delete($transfer, $actor);
        $this->assertDatabaseHas('financial_entries', ['id' => $manual->id]);
    }
}
