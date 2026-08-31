<?php

namespace Tests\Feature;

use App\Models\CustomerCreditTransaction;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminCustomerCrudTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_customer_with_login_password(): void
    {
        $this->actingAs($this->admin())->post('/admin/customers', [
            'name' => 'Retail Customer',
            'email' => 'retail@example.com',
            'phone' => '09123456789',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ])->assertStatus(303)->assertRedirect('/admin/customers');

        $customer = User::where('email', 'retail@example.com')->firstOrFail();
        $this->assertSame(User::CUSTOMER_ROLE, $customer->role);
        $this->assertSame('active', $customer->status);
        $this->assertSame('disabled', $customer->credit_status);
        $this->assertTrue(Hash::check('Password123!', $customer->password));
    }

    public function test_customer_create_rejects_duplicate_email_and_unconfirmed_password(): void
    {
        User::factory()->create(['email' => 'taken@example.com']);

        $this->actingAs($this->admin())->post('/admin/customers', [
            'name' => 'Duplicate Customer',
            'email' => 'taken@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'DifferentPassword123!',
        ])->assertSessionHasErrors(['email', 'password']);
    }

    public function test_admin_can_update_customer_and_change_password(): void
    {
        $customer = User::factory()->create([
            'role' => User::CUSTOMER_ROLE,
            'status' => 'active',
        ]);

        $this->actingAs($this->admin())->patch("/admin/customers/{$customer->id}", [
            'name' => 'Updated Customer',
            'email' => 'updated@example.com',
            'phone' => '09999999999',
            'status' => 'suspended',
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ])->assertStatus(303)->assertRedirect('/admin/customers');

        $customer->refresh();
        $this->assertSame('Updated Customer', $customer->name);
        $this->assertSame('suspended', $customer->status);
        $this->assertTrue(Hash::check('NewPassword123!', $customer->password));
    }

    public function test_admin_can_soft_delete_customer_without_credit_balance(): void
    {
        $customer = User::factory()->create(['role' => User::CUSTOMER_ROLE]);

        $this->actingAs($this->admin())
            ->delete("/admin/customers/{$customer->id}")
            ->assertStatus(303)
            ->assertRedirect('/admin/customers');

        $this->assertSoftDeleted('users', ['id' => $customer->id]);
    }

    public function test_deleted_customer_email_and_phone_can_be_reused(): void
    {
        $customer = User::factory()->create([
            'role' => User::CUSTOMER_ROLE,
            'email' => 'reusable@example.com',
            'phone' => '09111111111',
        ]);
        $admin = $this->admin();

        $this->actingAs($admin)->delete("/admin/customers/{$customer->id}")->assertStatus(303);

        $this->actingAs($admin)->post('/admin/customers', [
            'name' => 'Replacement Customer',
            'email' => 'reusable@example.com',
            'phone' => '09111111111',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ])->assertStatus(303);

        $this->assertDatabaseHas('users', [
            'name' => 'Replacement Customer',
            'email' => 'reusable@example.com',
            'phone' => '09111111111',
            'deleted_at' => null,
        ]);
    }

    public function test_customer_with_outstanding_credit_cannot_be_deleted(): void
    {
        $customer = User::factory()->create(['role' => User::CUSTOMER_ROLE]);
        CustomerCreditTransaction::create([
            'transaction_number' => 'CRUD-CREDIT-1',
            'customer_id' => $customer->id,
            'type' => 'sale',
            'amount' => 1000,
            'balance_after' => 1000,
        ]);

        $this->actingAs($this->admin())
            ->delete("/admin/customers/{$customer->id}")
            ->assertSessionHasErrors('customer');

        $this->assertNotSoftDeleted('users', ['id' => $customer->id]);
    }

    private function admin(): User
    {
        $role = Role::where('name', 'super_admin')->firstOrFail();
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $admin->roles()->sync([$role->id]);

        return $admin->fresh();
    }
}
