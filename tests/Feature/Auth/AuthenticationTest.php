<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Providers\RouteServiceProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_screen_can_be_rendered(): void
    {
        $response = $this->get('/login');

        $response->assertStatus(200);
    }

    public function test_users_can_authenticate_using_the_login_screen(): void
    {
        $user = User::factory()->create();

        $response = $this->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(RouteServiceProvider::HOME);
    }

    public function test_users_are_redirected_to_their_storefront_intended_page_after_login(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->withSession(['url.intended' => '/orders'])
            ->post('/login', [
                'email' => $user->email,
                'password' => 'password',
            ]);

        $this->assertAuthenticated();
        $response->assertRedirect('/orders');
    }

    public function test_storefront_login_ignores_admin_intended_pages(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->withSession(['url.intended' => '/admin/orders'])
            ->post('/login', [
                'email' => $user->email,
                'password' => 'password',
            ]);

        $this->assertAuthenticated();
        $response->assertRedirect('/');
    }

    public function test_users_can_not_authenticate_with_invalid_password(): void
    {
        $user = User::factory()->create();

        $this->post('/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);

        $this->assertGuest();
    }

    public function test_suspended_customers_cannot_authenticate(): void
    {
        $user = User::factory()->create(['status' => 'suspended']);

        $response = $this->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertGuest();
        $response->assertSessionHasErrors([
            'email' => 'Your account has been suspended.',
        ]);
    }

    public function test_staff_accounts_must_use_the_admin_login(): void
    {
        $user = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);

        $response = $this->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertGuest();
        $response->assertSessionHasErrors([
            'email' => 'Staff accounts must use the admin login.',
        ]);
    }

    public function test_admin_users_can_authenticate_using_the_admin_login_screen(): void
    {
        $user = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);

        $response = $this->post('/admin/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect('/admin/dashboard');
    }

    public function test_admin_users_are_redirected_to_their_admin_intended_page_after_login(): void
    {
        $user = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);

        $response = $this
            ->withSession(['url.intended' => '/admin/orders'])
            ->post('/admin/login', [
                'email' => $user->email,
                'password' => 'password',
            ]);

        $this->assertAuthenticated();
        $response->assertRedirect('/admin/orders');
    }

    public function test_admin_login_ignores_storefront_intended_pages(): void
    {
        $user = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);

        $response = $this
            ->withSession(['url.intended' => '/checkout'])
            ->post('/admin/login', [
                'email' => $user->email,
                'password' => 'password',
            ]);

        $this->assertAuthenticated();
        $response->assertRedirect('/admin/dashboard');
    }

    public function test_customers_cannot_authenticate_using_the_admin_login_screen(): void
    {
        $user = User::factory()->create();

        $response = $this->post('/admin/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertGuest();
        $response->assertSessionHasErrors([
            'email' => 'These credentials do not have access to the admin area.',
        ]);
    }

    public function test_suspended_admin_users_cannot_authenticate(): void
    {
        $user = User::factory()->create(['role' => 'super_admin', 'status' => 'suspended']);

        $response = $this->post('/admin/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertGuest();
        $response->assertSessionHasErrors([
            'email' => 'Your account has been suspended.',
        ]);
    }
}
