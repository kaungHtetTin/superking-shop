<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Location;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminStaffAccountUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_json_staff_update_returns_the_updated_row_without_redirecting_patch(): void
    {
        $admin = $this->staffWithRole('super_admin');
        $staff = $this->staffWithRole('staff');

        $this->actingAs($admin)->patchJson("/admin/users/{$staff->id}", [
            'name' => 'Updated Staff',
            'email' => 'updated-staff@example.com',
            'phone' => '09123456789',
            'role' => 'manager',
            'status' => 'active',
        ])->assertOk()
            ->assertJsonPath('message', 'Staff account updated successfully.')
            ->assertJsonPath('user.id', $staff->id)
            ->assertJsonPath('user.name', 'Updated Staff')
            ->assertJsonPath('user.role', 'manager')
            ->assertJsonPath('user.status', 'active');

        $this->assertSame('Updated Staff', $staff->fresh()->name);
        $this->assertSame('manager', $staff->fresh()->adminRoleName());
    }

    public function test_self_role_change_returns_a_modal_validation_error(): void
    {
        $admin = $this->staffWithRole('super_admin');

        $this->actingAs($admin)->patchJson("/admin/users/{$admin->id}", [
            'name' => $admin->name,
            'email' => $admin->email,
            'role' => 'manager',
            'status' => 'active',
        ])->assertUnprocessable()->assertJsonValidationErrors('role');

        $this->assertSame('super_admin', $admin->fresh()->adminRoleName());
    }

    public function test_multiple_branch_assignments_are_saved_and_returned(): void
    {
        $admin = $this->staffWithRole('super_admin');
        $staff = $this->staffWithRole('staff');
        $first = Location::create(['name' => 'Branch A', 'code' => 'BR-A', 'type' => 'warehouse', 'is_active' => true]);
        $second = Location::create(['name' => 'Branch B', 'code' => 'BR-B', 'type' => 'warehouse', 'is_active' => true]);

        $this->actingAs($admin)->patchJson("/admin/users/{$staff->id}", [
            'name' => $staff->name, 'email' => $staff->email, 'role' => 'staff', 'status' => 'active',
            'location_ids' => [$first->id, $second->id],
        ])->assertOk()->assertJsonCount(2, 'user.locations');

        $this->assertEqualsCanonicalizing([$first->id, $second->id], $staff->locations()->pluck('locations.id')->all());
    }

    public function test_invalid_branch_assignment_does_not_modify_staff(): void
    {
        $admin = $this->staffWithRole('super_admin');
        $staff = $this->staffWithRole('staff');
        $this->actingAs($admin)->patchJson("/admin/users/{$staff->id}", [
            'name' => 'Should not save', 'email' => $staff->email, 'role' => 'staff', 'status' => 'active',
            'location_ids' => [999999999],
        ])->assertUnprocessable()->assertJsonValidationErrors('location_ids.0');
        $this->assertSame($staff->name, $staff->fresh()->name);
    }

    public function test_super_admin_branch_assignment_is_not_editable(): void
    {
        $admin = $this->staffWithRole('super_admin');
        $location = Location::create(['name' => 'All access branch', 'code' => 'ALL-ACCESS', 'type' => 'warehouse', 'is_active' => true]);
        $this->actingAs($admin)->patchJson("/admin/users/{$admin->id}", [
            'name' => $admin->name, 'email' => $admin->email, 'role' => 'super_admin', 'status' => 'active',
            'location_ids' => [$location->id],
        ])->assertOk()->assertJsonCount(0, 'user.locations');
        $this->assertContains($location->id, $admin->fresh()->accessibleLocationIds());
        $this->assertTrue($admin->fresh()->canAccessLocation($location));
    }

    private function staffWithRole(string $roleName): User
    {
        $role = Role::query()->where('name', $roleName)->firstOrFail();
        $user = User::factory()->create([
            'role' => $roleName,
            'status' => 'active',
        ]);
        $user->roles()->sync([$role->id]);

        return $user->fresh();
    }
}
