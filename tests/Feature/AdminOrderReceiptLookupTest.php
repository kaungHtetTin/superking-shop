<?php

namespace Tests\Feature;

use App\Models\Location;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminOrderReceiptLookupTest extends TestCase
{
    use RefreshDatabase;

    public function test_orders_can_be_found_by_receipt_or_order_number_and_export_keeps_receipt_number(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $location = Location::create([
            'name' => 'Receipt lookup store',
            'code' => 'RCT-LOOKUP',
            'type' => 'warehouse',
            'timezone' => 'Asia/Yangon',
            'is_active' => true,
        ]);
        $order = Order::create([
            'order_number' => 'POS-261015-123456',
            'receipt_number' => 'RCT-261015-654321',
            'sales_channel' => 'pos',
            'location_id' => $location->id,
            'status' => 'delivered',
            'payment_status' => 'paid',
            'total_amount' => 10000,
            'final_amount' => 10000,
            'paid_amount' => 10000,
        ]);
        Order::create([
            'order_number' => 'POS-261015-999999',
            'receipt_number' => 'RCT-261015-888888',
            'sales_channel' => 'pos',
            'location_id' => $location->id,
            'status' => 'delivered',
            'payment_status' => 'paid',
            'total_amount' => 5000,
            'final_amount' => 5000,
            'paid_amount' => 5000,
        ]);

        $this->actingAs($admin)->getJson('/admin/orders?q=RCT-261015-654321')
            ->assertOk()
            ->assertJsonCount(1, 'props.orders.data')
            ->assertJsonPath('props.orders.data.0.id', $order->id)
            ->assertJsonPath('props.orders.data.0.order_number', $order->order_number)
            ->assertJsonPath('props.orders.data.0.receipt_number', $order->receipt_number);
        $this->actingAs($admin)->getJson('/admin/orders?q=POS-261015-123456')
            ->assertOk()
            ->assertJsonCount(1, 'props.orders.data')
            ->assertJsonPath('props.orders.data.0.id', $order->id);
        $export = $this->actingAs($admin)->get('/admin/orders-export.csv?q=RCT-261015-654321');
        $export->assertOk();
        $this->assertStringContainsString('POS-261015-123456,RCT-261015-654321', $export->streamedContent());
        $this->assertStringNotContainsString('POS-261015-999999', $export->streamedContent());
    }

    public function test_pos_print_pdf_and_public_vouchers_use_receipt_number_but_online_invoice_keeps_order_number(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $location = Location::create([
            'name' => 'Voucher number store',
            'code' => 'RCT-VOUCHER',
            'type' => 'warehouse',
            'timezone' => 'Asia/Yangon',
            'is_active' => true,
        ]);
        $pos = Order::create([
            'order_number' => 'POS-261015-111111',
            'receipt_number' => 'RCT-261015-222222',
            'sales_channel' => 'pos',
            'location_id' => $location->id,
            'status' => 'delivered',
            'payment_status' => 'paid',
            'total_amount' => 10000,
            'final_amount' => 10000,
            'paid_amount' => 10000,
        ]);
        $online = Order::create([
            'order_number' => 'WEB-261015-333333',
            'sales_channel' => 'online',
            'location_id' => $location->id,
            'status' => 'pending',
            'payment_status' => 'pending',
            'total_amount' => 5000,
            'final_amount' => 5000,
            'paid_amount' => 0,
        ]);

        foreach (["/admin/orders/{$pos->id}/voucher", "/admin/orders/{$pos->id}/voucher/pdf"] as $url) {
            $this->actingAs($admin)->get($url)->assertOk()
                ->assertSee('<title>Sales receipt RCT-261015-222222</title>', false)
                ->assertSee('<strong>RCT-261015-222222</strong>', false)
                ->assertSee('Order No.: POS-261015-111111');
        }
        $this->get('/invoices/'.$pos->fresh()->voucher_public_token)->assertOk()
            ->assertSee('<strong>RCT-261015-222222</strong>', false)
            ->assertSee('Order No.: POS-261015-111111');

        $this->actingAs($admin)->get("/admin/orders/{$online->id}/voucher")->assertOk()
            ->assertSee('<title>Invoice WEB-261015-333333</title>', false)
            ->assertSee('<strong>WEB-261015-333333</strong>', false)
            ->assertDontSee('Order No.:');
    }
}
