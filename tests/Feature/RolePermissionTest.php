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
        $this->actingAs($manager)->get('/admin/roles')->assertRedirect('/admin/dashboard');
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

    public function test_json_role_update_returns_updated_role_without_a_patch_redirect(): void
    {
        $admin = $this->staffWithRole('super_admin');
        $role = Role::create([
            'name' => 'inventory_helper',
            'display_name' => 'Inventory Helper',
            'is_admin' => true,
            'is_system' => false,
            'sort_order' => 60,
        ]);

        $this->actingAs($admin)->patchJson("/admin/roles/{$role->id}", [
            'display_name' => 'Inventory Assistant',
            'description' => 'Updated access',
            'permissions' => ['dashboard.view', 'inventory.view'],
        ])->assertOk()
            ->assertJsonPath('role.id', $role->id)
            ->assertJsonPath('role.display_name', 'Inventory Assistant')
            ->assertJsonPath('role.permissions.0', 'dashboard.view')
            ->assertJsonPath('role.permissions.1', 'inventory.view');
    }

    public function test_custom_role_can_be_deleted_and_is_absent_from_refreshed_list(): void
    {
        $admin = $this->staffWithRole('super_admin');
        $role = Role::create([
            'name' => 'temporary_role',
            'display_name' => 'Temporary Role',
            'is_admin' => true,
            'is_system' => false,
            'sort_order' => 60,
        ]);

        $this->actingAs($admin)->deleteJson("/admin/roles/{$role->id}")
            ->assertOk()
            ->assertJsonPath('deleted_role_id', $role->id);

        $this->assertDatabaseMissing('roles', ['id' => $role->id]);
        $this->getJson('/admin/roles')->assertOk()
            ->assertJsonMissing(['name' => 'temporary_role']);
    }

    public function test_assigned_role_delete_returns_a_modal_validation_error(): void
    {
        $admin = $this->staffWithRole('super_admin');
        $role = Role::create([
            'name' => 'assigned_role',
            'display_name' => 'Assigned Role',
            'is_admin' => true,
            'is_system' => false,
            'sort_order' => 60,
        ]);
        $this->staffWithRole('assigned_role');

        $this->actingAs($admin)->deleteJson("/admin/roles/{$role->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');

        $this->assertDatabaseHas('roles', ['id' => $role->id]);
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

    public function test_permission_catalog_explains_current_features_and_legacy_keys(): void
    {
        $response = $this->actingAs($this->staffWithRole('super_admin'))->getJson('/admin/roles')->assertOk();
        $items = collect($response->json('props.permissionGroups'))->pluck('items')->flatten(1)->keyBy('value');

        $this->assertStringContainsString('receipt', $items['settings.manage']['label']);
        $this->assertStringContainsString('reversals', $items['inventory.transfer.create']['label']);
        $this->assertStringContainsString('shifts', $items['pos.access']['label']);
        $this->assertStringContainsString('PDFs', $items['orders.view']['label']);
        $this->assertTrue($items['pos.refund']['inactive']);
        $this->assertTrue($items['inventory.adjust.approve']['inactive']);
        $this->assertFalse($items['pricing.manage']['inactive']);
    }

    public function test_pricing_only_role_can_manage_prices_but_not_other_settings(): void
    {
        $user = $this->staffWithPermissions(['pricing.manage']);
        $this->actingAs($user)->get('/admin/settings')->assertRedirect('/admin/settings?section=prices');
        $this->get('/admin/settings?section=general')->assertRedirect('/admin/settings?section=prices');
        $this->getJson('/admin/settings?section=prices')->assertOk()
            ->assertJsonPath('props.canManageSettings', false)
            ->assertJsonPath('props.initialSection', 'prices');
        $this->get('/admin/settings/prices')->assertRedirect();
        foreach (['general', 'branding', 'contacts', 'receipts', 'security'] as $section) {
            $this->getJson('/admin/settings?section='.$section)->assertForbidden();
        }
        $this->postJson('/admin/settings', ['app_name' => 'Unauthorized change'])->assertForbidden();
        $this->postJson('/admin/settings/prices', [
            'name' => 'Permission test price', 'pricing_mode' => 'manual',
            'markup_percent' => 0, 'rounding' => 1, 'minimum_profit' => 0,
        ])->assertStatus(303);
        $this->assertDatabaseHas('pricing_rules', ['name' => 'Permission test price']);
        $this->get('/admin/roles')->assertRedirect('/admin/settings?section=prices');
        $this->getJson('/admin/profile')->assertOk()->assertJsonPath('component', 'Profile/Edit');
    }

    public function test_settings_permission_preserves_access_to_prices_and_receipts(): void
    {
        $this->actingAs($this->staffWithPermissions(['settings.manage']))
            ->getJson('/admin/settings?section=receipts')->assertOk()
            ->assertJsonPath('props.canManageSettings', true);
        $this->getJson('/admin/settings?section=prices')->assertOk();
        $this->get('/admin/settings/prices/create')->assertRedirect();
    }

    public function test_staff_without_pricing_permission_cannot_read_or_mutate_rules(): void
    {
        $this->actingAs($this->staffWithRole('staff'));
        $rule = \App\Models\PricingRule::firstOrFail();
        $this->getJson('/admin/settings?section=prices')->assertForbidden();
        $this->get('/admin/settings/prices')->assertRedirect('/admin/dashboard');
        $this->postJson('/admin/settings/prices', [])->assertForbidden();
        $this->postJson('/admin/settings/prices/preview', [])->assertForbidden();
        $this->patchJson('/admin/settings/prices/'.$rule->id, [])->assertForbidden();
        $this->deleteJson('/admin/settings/prices/'.$rule->id)->assertForbidden();
        $this->assertDatabaseHas('pricing_rules', ['id' => $rule->id]);
    }

    private function staffWithPermissions(array $permissions): User
    {
        $role = Role::create([
            'name' => 'scoped_settings', 'display_name' => 'Scoped Settings',
            'is_admin' => true, 'is_system' => false, 'sort_order' => 60,
        ]);
        $role->permissions()->sync(Permission::whereIn('name', $permissions)->pluck('id'));
        return $this->staffWithRole($role->name);
    }
}
