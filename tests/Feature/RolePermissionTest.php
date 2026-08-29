<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RolePermissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_admin_roles_and_permissions_are_seeded(): void
    {
        $this->assertDatabaseHas('roles', ['name' => 'super_admin', 'display_name' => 'Super Admin']);
        $this->assertDatabaseHas('roles', ['name' => 'manager']);
        $this->assertDatabaseHas('roles', ['name' => 'staff']);
        $this->assertDatabaseHas('permissions', ['name' => 'roles.manage']);
        $this->assertDatabaseMissing('permissions', ['name' => 'inventory.import']);
    }

    public function test_staff_permissions_are_resolved_from_the_assigned_role(): void
    {
        $sales = $this->staffWithRole('staff');

        $this->assertTrue($sales->hasAdminPermission('orders.manage'));
        $this->assertTrue($sales->hasAdminPermission('inventory.view'));
        $this->assertFalse($sales->hasAdminPermission('roles.manage'));
    }

    public function test_admin_can_open_role_management_and_manager_cannot(): void
    {
        $admin = $this->staffWithRole('super_admin');
        $manager = $this->staffWithRole('manager');

        $this->actingAs($admin)->get('/admin/roles')->assertOk();
        $this->actingAs($manager)->get('/admin/roles')->assertForbidden();
    }

    public function test_admin_can_update_a_role_permission_set(): void
    {
        $admin = $this->staffWithRole('super_admin');
        $role = Role::create([
            'name' => 'customer_care',
            'display_name' => 'Customer Care',
            'description' => 'Customer care team.',
            'is_admin' => true,
            'is_system' => false,
            'sort_order' => 60,
        ]);

        $this->actingAs($admin)
            ->patch("/admin/roles/{$role->id}", [
                'display_name' => 'Store Staff',
                'description' => 'Daily store operations team.',
                'permissions' => ['dashboard.view', 'chat.manage', 'view_customers'],
            ])
            ->assertRedirect();

        $this->assertSame('Store Staff', $role->fresh()->display_name);
        $this->assertEqualsCanonicalizing(
            ['dashboard.view', 'chat.manage', 'view_customers'],
            $role->fresh()->permissions()->pluck('name')->all(),
        );
    }

    public function test_custom_admin_role_can_be_assigned_without_code_changes(): void
    {
        $role = Role::create([
            'name' => 'regional_manager',
            'display_name' => 'Regional Manager',
            'is_admin' => true,
            'is_system' => false,
            'sort_order' => 60,
        ]);
        $role->permissions()->sync([
            Permission::query()->where('name', 'dashboard.view')->value('id'),
        ]);

        $user = User::factory()->create([
            'role' => $role->name,
            'status' => 'active',
            'permissions' => [],
        ]);
        $user->roles()->sync([$role->id]);

        $this->assertTrue($user->fresh()->isAdminStaff());
        $this->assertTrue($user->fresh()->hasAdminPermission('dashboard.view'));
    }

    public function test_staff_manager_cannot_assign_the_protected_admin_role(): void
    {
        $role = Role::create([
            'name' => 'team_lead',
            'display_name' => 'Team Lead',
            'is_admin' => true,
            'is_system' => false,
            'sort_order' => 60,
        ]);
        $role->permissions()->sync(Permission::query()
            ->whereIn('name', ['dashboard.view', 'staff.manage'])
            ->pluck('id'));

        $actor = User::factory()->create([
            'role' => $role->name,
            'status' => 'active',
        ]);
        $actor->roles()->sync([$role->id]);

        $this->actingAs($actor)
            ->post('/admin/users', [
                'name' => 'Unauthorized Admin',
                'email' => 'unauthorized-admin@example.com',
                'password' => 'password',
                'password_confirmation' => 'password',
                'role' => 'super_admin',
                'status' => 'active',
                'permissions' => [],
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('users', ['email' => 'unauthorized-admin@example.com']);
    }

    private function staffWithRole(string $roleName, array $directPermissions = []): User
    {
        $role = Role::query()->where('name', $roleName)->firstOrFail();
        $user = User::factory()->create([
            'role' => $roleName,
            'status' => 'active',
            'permissions' => $directPermissions,
        ]);
        $user->roles()->sync([$role->id]);

        return $user->fresh();
    }
}
