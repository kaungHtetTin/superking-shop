<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PasswordUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_password_can_be_updated(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->from('/profile')
            ->put('/password', [
                'current_password' => 'password',
                'password' => 'new-password',
                'password_confirmation' => 'new-password',
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect('/profile');

        $this->assertTrue(Hash::check('new-password', $user->refresh()->password));
    }

    public function test_correct_password_must_be_provided_to_update_password(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->from('/profile')
            ->put('/password', [
                'current_password' => 'wrong-password',
                'password' => 'new-password',
                'password_confirmation' => 'new-password',
            ]);

        $response
            ->assertSessionHasErrors('current_password')
            ->assertRedirect('/profile');
    }

    public function test_admin_can_update_password_and_login_again_with_the_new_password(): void
    {
        $admin = User::factory()->create([
            'role' => 'super_admin',
            'status' => 'active',
            'password' => Hash::make('password'),
        ]);

        $this->actingAs($admin)
            ->from('/admin/profile')
            ->put('/admin/profile/password', [
                'current_password' => 'password',
                'password' => 'new-password',
                'password_confirmation' => 'new-password',
            ])
            ->assertSessionHasNoErrors()
            ->assertStatus(303)
            ->assertRedirect('/admin/profile?saved=password');

        $this->assertTrue(Hash::check('new-password', $admin->fresh()->password));

        auth()->logout();

        $this->post('/admin/login', [
            'email' => $admin->email,
            'password' => 'new-password',
        ])->assertRedirect('/admin/dashboard');

        $this->assertAuthenticatedAs($admin->fresh());
    }

    public function test_admin_spa_password_update_returns_an_immediate_success_response(): void
    {
        $admin = User::factory()->create([
            'role' => 'super_admin',
            'status' => 'active',
            'password' => Hash::make('password'),
        ]);

        $this->actingAs($admin)
            ->withHeader('X-SPA', 'true')
            ->putJson('/admin/profile/password', [
                'current_password' => 'password',
                'password' => 'new-password',
                'password_confirmation' => 'new-password',
            ])
            ->assertOk()
            ->assertExactJson(['status' => 'password-updated']);

        $this->assertTrue(Hash::check('new-password', $admin->fresh()->password));
    }
}
