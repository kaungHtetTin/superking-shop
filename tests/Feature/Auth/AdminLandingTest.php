<?php

namespace Tests\Feature\Auth;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminLandingTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_without_dashboard_permission_lands_on_an_allowed_page(): void
    {
        $user = $this->staffWithPermissions(['pos.access']);

        $this->post('/admin/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertRedirect('/admin/pos');

        $this->get('/admin')->assertRedirect('/admin/pos');
        $this->get('/admin/login')->assertRedirect('/admin/pos');
        $this->get('/admin/dashboard')->assertRedirect('/admin/pos');
        $this->getJson('/admin/dashboard')->assertForbidden();
    }

    public function test_staff_without_any_page_permission_can_use_profile_and_logout(): void
    {
        $user = $this->staffWithPermissions([]);

        $this->post('/admin/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertRedirect('/admin/profile');

        $this->get('/admin')->assertRedirect('/admin/profile');
        $this->get('/admin/dashboard')->assertRedirect('/admin/profile');
        $this->withHeaders(['X-SPA' => 'true', 'Accept' => 'application/json'])
            ->get('/admin/dashboard')->assertRedirect('/admin/profile');
        $this->getJson('/admin/profile')->assertOk()
            ->assertJsonPath('component', 'Profile/Edit')
            ->assertJsonPath('props.admin_landing_path', '/admin/profile');
        $this->postJson('/admin/products', [])->assertForbidden();
        $this->post('/admin/logout')->assertRedirect('/admin/login');
        $this->assertGuest();
    }

    private function staffWithPermissions(array $permissions): User
    {
        $role = Role::create([
            'name' => 'limited_staff',
            'display_name' => 'Limited Staff',
            'is_admin' => true,
            'is_system' => false,
            'sort_order' => 60,
        ]);
        $role->permissions()->sync(Permission::query()->whereIn('name', $permissions)->pluck('id'));

        $user = User::factory()->create([
            'role' => $role->name,
            'status' => 'active',
        ]);
        $user->roles()->sync([$role->id]);

        return $user->fresh();
    }
}
