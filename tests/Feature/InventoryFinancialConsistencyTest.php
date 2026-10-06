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

    public function test_internal_transfers_are_not_offered_as_financial_categories(): void
    {
        $options = FinancialEntry::categoryOptions();

        $this->assertNotContains(
            FinancialEntry::CATEGORY_INTERNAL_TRANSFER,
            collect($options['income'])->pluck('value')->all(),
        );
        $this->assertNotContains(
            FinancialEntry::CATEGORY_INTERNAL_TRANSFER,
            collect($options['expense'])->pluck('value')->all(),
        );
        $this->assertContains(
            FinancialEntry::CATEGORY_STOCK_RECEIPT,
            collect($options[FinancialEntry::TYPE_ASSET])->pluck('value')->all(),
        );
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
        $this->assertDatabaseHas('financial_entries', [
            'reference' => $receipt->receipt_number,
            'type' => FinancialEntry::TYPE_ASSET,
            'category' => FinancialEntry::CATEGORY_STOCK_RECEIPT,
            'amount' => 200,
        ]);
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

    public function test_purchase_receipt_correction_updates_purchase_total_and_keeps_audit_history(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $service = app(StockReceiptService::class);
        $receipt = $service->createDraft($location, [['product_unit_id' => $unit->id, 'received_quantity' => 10, 'unit_cost' => 2200]], $actor);
        $service->post($receipt, $actor);
        $item = $receipt->fresh('items')->items->sole();
        $correction = $service->correctPostedItem($receipt, $item, [
            'reason' => 'purchase_error', 'received_quantity' => 11, 'free_quantity' => 0,
            'unit_cost' => 2200, 'notes' => 'Supplier invoice shows 11 paid units.',
        ], $actor);

        $this->assertEquals(2200, $correction->purchase_amount_delta);
        $this->assertEquals(21, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertEquals(24200, $this->summary($actor)['stock_purchases']);
        $this->assertEquals(0, $this->summary($actor)['net_profit']);
        $this->assertDatabaseHas('stock_receipt_corrections', ['id' => $correction->id, 'old_received_quantity' => 10, 'new_received_quantity' => 11]);
    }

    public function test_supplier_bonus_adds_free_stock_without_increasing_purchase_amount(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $service = app(StockReceiptService::class);
        $receipt = $service->createDraft($location, [['product_unit_id' => $unit->id, 'received_quantity' => 10, 'unit_cost' => 2200]], $actor);
        $service->post($receipt, $actor);
        $item = $receipt->fresh('items')->items->sole();
        $correction = $service->correctPostedItem($receipt, $item, [
            'reason' => 'supplier_bonus', 'received_quantity' => 10, 'free_quantity' => 1,
            'unit_cost' => 2200, 'notes' => 'Supplier invoice charges for 10 and includes one free.',
        ], $actor);

        $this->assertEquals(0, $correction->purchase_amount_delta);
        $this->assertEquals(21, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertEquals(22000, $this->summary($actor)['stock_purchases']);
        $this->assertEquals(0, $this->summary($actor)['net_profit']);
    }

    public function test_overentered_purchase_can_be_reduced_without_becoming_a_stock_loss(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $service = app(StockReceiptService::class);
        $receipt = $service->createDraft($location, [['product_unit_id' => $unit->id, 'received_quantity' => 11, 'unit_cost' => 2200]], $actor);
        $service->post($receipt, $actor);
        $correction = $service->correctPostedItem($receipt, $receipt->fresh('items')->items->sole(), [
            'reason' => 'purchase_error', 'received_quantity' => 10, 'free_quantity' => 0,
            'unit_cost' => 2200, 'notes' => 'Invoice and delivery note both show 10 units.',
        ], $actor);

        $this->assertEquals(-2200, $correction->purchase_amount_delta);
        $this->assertEquals(20, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertEquals(22000, $this->summary($actor)['stock_purchases']);
        $this->assertEquals(0, $this->summary($actor)['net_profit']);
        $this->assertDatabaseMissing('financial_entries', ['category' => FinancialEntry::CATEGORY_STOCK_ADJUSTMENT]);
    }

    public function test_receipt_correction_rejects_later_stock_activity(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $service = app(StockReceiptService::class);
        $receipt = $service->createDraft($location, [['product_unit_id' => $unit->id, 'received_quantity' => 10, 'unit_cost' => 20]], $actor);
        $service->post($receipt, $actor);
        app(InventoryService::class)->completeSale($location, $product, 1);

        $this->expectException(ValidationException::class);
        $service->correctPostedItem($receipt, $receipt->fresh('items')->items->sole(), [
            'reason' => 'purchase_error', 'received_quantity' => 11, 'free_quantity' => 0,
            'unit_cost' => 20, 'notes' => 'Invoice correction.',
        ], $actor);
    }

    public function test_posted_receipt_correction_route_requires_reason_and_is_authorized(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $service = app(StockReceiptService::class);
        $receipt = $service->createDraft($location, [['product_unit_id' => $unit->id, 'received_quantity' => 10, 'unit_cost' => 20]], $actor);
        $service->post($receipt, $actor);

        $this->actingAs($actor)->post("/admin/inventory/receipts/{$receipt->id}/corrections", [
            'item_id' => $receipt->fresh('items')->items->sole()->id,
            'reason' => 'purchase_error',
            'received_quantity' => 11,
            'free_quantity' => 0,
            'unit_cost' => 20,
            'notes' => 'Invoice shows one additional paid unit.',
        ])->assertRedirect();

        $this->assertEquals(220, $this->summary($actor)['stock_purchases']);
        $this->assertDatabaseCount('stock_receipt_corrections', 1);
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
        $gain = $service->createPosted($location, [['product_unit_id' => $unit->id, 'counted_quantity' => 9]], 'physical_count', $actor);
        $this->assertEquals(50, $gain->items->sole()->value_delta);
        $this->assertDatabaseHas('financial_entries', [
            'reference' => $gain->adjustment_number.':'.$gain->items->sole()->id,
            'type' => FinancialEntry::TYPE_ASSET,
            'category' => FinancialEntry::CATEGORY_STOCK_ADJUSTMENT,
            'amount' => 50,
        ]);
        $this->assertEquals(-20, $this->summary($actor)['net_profit']);
        $this->assertEquals(0, $this->summary($actor)['stock_purchases']);
    }

    public function test_documented_data_correction_changes_quantity_without_finance_entry(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $adjustment = app(StockAdjustmentService::class)->createPosted($location,
            [['product_unit_id' => $unit->id, 'counted_quantity' => 11]],
            'data_correction', $actor, 'Correct duplicate opening count DOC-1');

        $this->assertEquals(11, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertDatabaseMissing('financial_entries', ['reference' => $adjustment->adjustment_number.':'.$adjustment->items->sole()->id]);
        $this->assertEquals(0, $this->summary($actor)['net_profit']);
    }

    public function test_same_day_undo_then_new_adjustment_preserves_reversal_and_finance_effect(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $service = app(StockAdjustmentService::class);
        $original = $service->createPosted($location, [['product_unit_id' => $unit->id, 'counted_quantity' => 9, 'notes' => 'Count']], 'physical_count', $actor);
        $item = $original->items->sole();
        $service->undoPosted($original, $item->id, 'Original count and reason were entered incorrectly', $actor);
        $replacement = $service->createPosted($location, [['product_unit_id' => $unit->id, 'counted_quantity' => 8,
            'notes' => 'Two damaged pieces confirmed']], 'damage', $actor);

        $this->assertSame('reversed', $original->fresh()->status);
        $this->assertEquals($original->id, $original->reversal->reversal_of_id);
        $this->assertEquals(-2, $replacement->items->sole()->quantity_delta);
        $this->assertEquals(8, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertDatabaseHas('financial_entries', ['reference' => $original->adjustment_number.':'.$item->id, 'status' => 'void']);
        $this->assertEquals(-20, $this->summary($actor)['net_profit']);
        $adjustments = app(OperationsReportService::class)->inventory($actor)['adjustments'];
        $this->assertNull($adjustments->firstWhere('reason_code', 'physical_count'));
        $this->assertEquals(20, $adjustments->firstWhere('reason_code', 'damage')->loss_value);
    }

    public function test_undo_refuses_later_stock_activity_without_mutating_original(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $service = app(StockAdjustmentService::class);
        $original = $service->createPosted($location, [['product_unit_id' => $unit->id, 'counted_quantity' => 9, 'notes' => 'Count']], 'physical_count', $actor);
        app(InventoryService::class)->completeSale($location, $product, 1);
        try {
            $service->undoPosted($original, $original->items->sole()->id, 'Original counting sheet confirms eight', $actor);
            $this->fail('Later stock activity must block automatic correction.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('correction', $exception->errors());
        }
        $this->assertSame('posted', $original->fresh()->status);
        $this->assertEquals(8, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertDatabaseMissing('stock_adjustments', ['reversal_of_id' => $original->id]);
    }

    public function test_undo_refuses_a_mismatched_finance_entry_without_changing_stock(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $service = app(StockAdjustmentService::class);
        $original = $service->createPosted($location, [['product_unit_id' => $unit->id, 'counted_quantity' => 9,
            'notes' => 'One damaged piece']], 'damage', $actor);
        FinancialEntry::query()->where('reference', $original->adjustment_number.':'.$original->items->sole()->id)
            ->update(['amount' => 999]);

        try {
            $service->undoPosted($original, $original->items->sole()->id, 'Original count was entered incorrectly', $actor);
            $this->fail('Undo must not separate stock from a mismatched finance entry.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('correction', $exception->errors());
        }

        $this->assertEquals(9, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertSame('posted', $original->fresh()->status);
        $this->assertDatabaseMissing('stock_adjustments', ['reversal_of_id' => $original->id]);
    }

    public function test_undo_cannot_be_posted_twice(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $service = app(StockAdjustmentService::class);
        $original = $service->createPosted($location, [['product_unit_id' => $unit->id, 'counted_quantity' => 9,
            'notes' => 'One damaged piece']], 'damage', $actor);
        $service->undoPosted($original, $original->items->sole()->id, 'Original count was entered incorrectly', $actor);

        try {
            $service->undoPosted($original, $original->items->sole()->id, 'Second undo attempt must be rejected', $actor);
            $this->fail('Undo must not happen twice.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('correction', $exception->errors());
        }
        $this->assertEquals(10, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertEquals(1, $original->fresh()->reversal()->count());
    }

    public function test_wrong_plus_two_data_correction_becomes_one_damaged_unit_and_one_cost_expense(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $service = app(StockAdjustmentService::class);
        $original = $service->createPosted($location,
            [['product_unit_id' => $unit->id, 'counted_quantity' => 12]],
            'data_correction', $actor, 'Opening count entry DOC-2 was wrong');
        $this->assertEquals(12, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertEquals(0, $this->summary($actor)['net_profit']);

        $service->undoPosted($original, $original->items->sole()->id, 'Correct source count shows one damaged piece', $actor);
        $replacement = $service->createPosted($location, [['product_unit_id' => $unit->id, 'counted_quantity' => 9,
            'notes' => 'One damaged piece confirmed']], 'damage', $actor);

        $this->assertEquals(9, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertEquals(-1, $replacement->items->sole()->quantity_delta);
        $this->assertEquals(10, $replacement->items->sole()->base_cost);
        $this->assertEquals(-10, $this->summary($actor)['net_profit']);
        $this->assertDatabaseHas('financial_entries', [
            'reference' => $replacement->adjustment_number.':'.$replacement->items->sole()->id,
            'type' => 'expense', 'amount' => 10, 'status' => 'approved',
        ]);
    }

    public function test_adjustment_form_accepts_counted_total_for_one_damaged_unit(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $this->actingAs($actor)->post('/admin/inventory/adjustments', [
            'location_id' => $location->id, 'reason_code' => 'damage', 'notes' => 'One unit broken during handling',
            'items' => [['product_unit_id' => $unit->id, 'counted_quantity' => 9]],
        ])->assertRedirect();
        $this->assertEquals(9, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertEquals(-10, $this->summary($actor)['net_profit']);
    }

    public function test_adjustment_api_requires_counted_total_not_a_hidden_signed_change(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $this->actingAs($actor)->post('/admin/inventory/adjustments', [
            'location_id' => $location->id, 'reason_code' => 'damage', 'notes' => 'One unit broken during handling',
            'items' => [['product_unit_id' => $unit->id, 'quantity_change' => -1]],
        ])->assertSessionHasErrors('items.0.counted_quantity');
        $this->assertEquals(10, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
    }

    public function test_undo_mistaken_plus_two_restores_eleven_and_voids_finance_effect(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        app(InventoryService::class)->receive($location, $product, 1);
        $original = app(StockAdjustmentService::class)->createPosted($location,
            [['product_unit_id' => $unit->id, 'counted_quantity' => 13]], 'physical_count', $actor);
        $this->assertEquals(13, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));

        $this->actingAs($actor)->post('/admin/inventory/adjustments/'.$original->id.'/undo', [
            'item_id' => $original->items->sole()->id,
            'explanation' => 'The original count sheet shows eleven pieces',
        ])->assertRedirect();

        $this->assertEquals(11, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertSame('reversed', $original->fresh()->status);
        $this->assertDatabaseHas('financial_entries', [
            'reference' => $original->adjustment_number.':'.$original->items->sole()->id,
            'status' => 'void',
        ]);
        $this->assertEquals(0, $this->summary($actor)['net_profit']);
        $this->assertEquals(1, $original->fresh()->reversal()->count());
    }

    public function test_undo_then_new_damage_adjustment_finishes_at_nine(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        app(InventoryService::class)->receive($location, $product, 1);
        $original = app(StockAdjustmentService::class)->createPosted($location,
            [['product_unit_id' => $unit->id, 'counted_quantity' => 13]],
            'data_correction', $actor, 'The original count was entered as thirteen');

        $this->actingAs($actor)->post('/admin/inventory/adjustments/'.$original->id.'/undo', [
            'item_id' => $original->items->sole()->id,
            'explanation' => 'Count sheet shows two damaged pieces from eleven',
        ])->assertRedirect();
        $this->assertEquals(11, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->actingAs($actor)->post('/admin/inventory/adjustments', [
            'location_id' => $location->id, 'reason_code' => 'damage',
            'notes' => 'Count sheet shows two damaged pieces from eleven',
            'items' => [['product_unit_id' => $unit->id, 'counted_quantity' => 9]],
        ])->assertRedirect();

        $this->assertEquals(9, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertEquals(-20, $this->summary($actor)['net_profit']);
        $this->assertDatabaseHas('financial_entries', [
            'type' => 'expense', 'category' => FinancialEntry::CATEGORY_STOCK_ADJUSTMENT,
            'amount' => 20, 'status' => 'approved',
        ]);
    }

    public function test_undo_then_new_documented_data_correction_removes_wrong_finance_effect(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $original = app(StockAdjustmentService::class)->createPosted($location,
            [['product_unit_id' => $unit->id, 'counted_quantity' => 12]], 'physical_count', $actor);

        $this->actingAs($actor)->post('/admin/inventory/adjustments/'.$original->id.'/undo', [
            'item_id' => $original->items->sole()->id,
            'explanation' => 'Opening import source document confirms eleven',
        ])->assertRedirect();
        $this->actingAs($actor)->post('/admin/inventory/adjustments', [
            'location_id' => $location->id, 'reason_code' => 'data_correction',
            'notes' => 'Opening import source document confirms eleven',
            'items' => [['product_unit_id' => $unit->id, 'counted_quantity' => 11]],
        ])->assertRedirect();

        $this->assertEquals(11, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertDatabaseHas('financial_entries', [
            'reference' => $original->adjustment_number.':'.$original->items->sole()->id,
            'status' => 'void',
        ]);
        $this->assertEquals(0, $this->summary($actor)['net_profit']);
    }

    public function test_write_off_reduces_stock_and_profit_but_not_purchase_total_or_cash_funds(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        app(StockAdjustmentService::class)->createPosted($location,
            [['product_unit_id' => $unit->id, 'counted_quantity' => 9, 'notes' => 'Expired unit written off.']],
            'write_off', $actor);

        $this->assertEquals(9, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
        $this->assertEquals(-10, $this->summary($actor)['net_profit']);
        $this->assertEquals(0, $this->summary($actor)['stock_purchases']);
    }

    public function test_damage_cannot_increase_stock_and_corrections_need_a_source_note(): void
    {
        [$actor, $location, $product, $unit] = $this->fixture();
        $service = app(StockAdjustmentService::class);
        try {
            $service->createPosted($location, [['product_unit_id' => $unit->id, 'counted_quantity' => 11]], 'damage', $actor);
            $this->fail('Damage must not increase stock.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('reason_code', $exception->errors());
        }
        try {
            $service->createPosted($location, [['product_unit_id' => $unit->id, 'counted_quantity' => 11]], 'data_correction', $actor);
            $this->fail('An undocumented correction must not post.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('notes', $exception->errors());
        }
        $this->assertEquals(10, InventoryBalance::whereBelongsTo($location)->whereBelongsTo($product)->value('on_hand_qty'));
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
        $this->assertSame('11.666667', $product->fresh()->original_price);
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
