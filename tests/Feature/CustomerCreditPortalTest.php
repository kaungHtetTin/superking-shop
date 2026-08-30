<?php

namespace Tests\Feature;

use App\Models\CustomerCreditTransaction;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerCreditPortalTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get('/my-credit')->assertRedirect('/login');
    }

    public function test_customer_only_sees_their_own_credit_records(): void
    {
        $customer = User::factory()->create([
            'role' => User::CUSTOMER_ROLE,
            'credit_status' => 'active',
            'credit_limit' => 500000,
            'credit_terms_days' => 30,
        ]);
        $otherCustomer = User::factory()->create(['role' => User::CUSTOMER_ROLE]);

        $order = Order::create([
            'user_id' => $customer->id,
            'order_number' => 'CREDIT-MINE',
            'receipt_number' => 'POS-MINE',
            'total_amount' => 100000,
            'final_amount' => 100000,
            'paid_amount' => 40000,
            'credit_amount' => 60000,
            'credit_due_date' => now()->addDays(30),
            'status' => 'delivered',
            'payment_status' => 'partially_paid',
        ]);
        $otherOrder = Order::create([
            'user_id' => $otherCustomer->id,
            'order_number' => 'CREDIT-OTHER',
            'receipt_number' => 'POS-OTHER',
            'total_amount' => 90000,
            'final_amount' => 90000,
            'paid_amount' => 0,
            'credit_amount' => 90000,
            'credit_due_date' => now()->addDays(30),
            'status' => 'delivered',
            'payment_status' => 'unpaid',
        ]);

        CustomerCreditTransaction::create([
            'transaction_number' => 'CR-MINE',
            'customer_id' => $customer->id,
            'order_id' => $order->id,
            'type' => 'sale',
            'amount' => 60000,
            'balance_after' => 60000,
        ]);
        CustomerCreditTransaction::create([
            'transaction_number' => 'CR-OTHER',
            'customer_id' => $otherCustomer->id,
            'order_id' => $otherOrder->id,
            'type' => 'sale',
            'amount' => 90000,
            'balance_after' => 90000,
        ]);

        $response = $this->actingAs($customer)->get('/my-credit', ['X-SPA' => 'true']);

        $response->assertOk()
            ->assertJsonPath('component', 'User/Credit/Index')
            ->assertJsonPath('props.creditSummary.balance', 60000)
            ->assertJsonPath('props.creditSummary.available', 440000)
            ->assertJsonPath('props.creditOrders.data.0.order_number', 'CREDIT-MINE')
            ->assertJsonPath('props.creditTransactions.data.0.transaction_number', 'CR-MINE')
            ->assertJsonMissing(['order_number' => 'CREDIT-OTHER'])
            ->assertJsonMissing(['transaction_number' => 'CR-OTHER']);
    }

    public function test_customer_can_download_their_credit_statement_pdf(): void
    {
        $customer = User::factory()->create([
            'role' => User::CUSTOMER_ROLE,
            'credit_status' => 'active',
            'credit_limit' => 500000,
        ]);
        CustomerCreditTransaction::create([
            'transaction_number' => 'CR-STATEMENT',
            'customer_id' => $customer->id,
            'type' => 'sale',
            'amount' => 25000,
            'balance_after' => 25000,
        ]);

        $this->actingAs($customer)->get('/my-credit/statement')
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');
    }
}
