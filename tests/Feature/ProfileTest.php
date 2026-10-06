<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_page_is_displayed(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->get('/profile');

        $response->assertOk();
    }

    public function test_profile_information_can_be_updated(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->from('/profile')
            ->patch('/profile', [
                'name' => 'Test User',
                'email' => 'test@example.com',
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect('/profile');

        $user->refresh();

        $this->assertSame('Test User', $user->name);
        $this->assertSame('test@example.com', $user->email);
        $this->assertNull($user->email_verified_at);
    }

    public function test_email_verification_status_is_unchanged_when_the_email_address_is_unchanged(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->from('/profile')
            ->patch('/profile', [
                'name' => 'Test User',
                'email' => $user->email,
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect('/profile');

        $this->assertNotNull($user->refresh()->email_verified_at);
    }

    public function test_only_super_admin_can_delete_their_account(): void
    {
        $user = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);

        $response = $this
            ->actingAs($user)
            ->delete('/admin/profile', [
                'password' => 'password',
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect('/');

        $this->assertGuest();
        $this->assertSoftDeleted($user);
    }

    public function test_spa_account_deletion_returns_a_logout_redirect(): void
    {
        $user = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);

        $this->actingAs($user)
            ->withHeader('X-SPA', 'true')
            ->deleteJson('/admin/profile', ['password' => 'password'])
            ->assertOk()
            ->assertJsonPath('redirect', url('/'));

        $this->assertGuest();
        $this->assertSoftDeleted($user);
    }

    public function test_correct_password_must_be_provided_to_delete_super_admin_account(): void
    {
        $user = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);

        $response = $this
            ->actingAs($user)
            ->from('/profile')
            ->delete('/admin/profile', [
                'password' => 'wrong-password',
            ]);

        $response
            ->assertSessionHasErrors('password')
            ->assertRedirect('/profile');

        $this->assertNotNull($user->fresh());
    }

    public function test_other_roles_cannot_delete_accounts_from_either_profile_route(): void
    {
        foreach (['customer', 'staff', 'manager'] as $role) {
            $user = User::factory()->create(['role' => $role, 'status' => 'active']);

            $this->actingAs($user)->deleteJson('/profile', ['password' => 'password'])->assertForbidden();
            $this->actingAs($user)->deleteJson('/admin/profile', ['password' => 'password'])->assertForbidden();
            $this->assertNotNull($user->fresh());
        }
    }

    public function test_super_admin_cannot_use_storefront_profile_route_to_delete_account(): void
    {
        $user = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);

        $this->actingAs($user)->deleteJson('/profile', ['password' => 'password'])->assertForbidden();
        $this->assertNotNull($user->fresh());
    }
}
