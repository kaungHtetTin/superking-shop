<?php

namespace Tests\Feature;

use App\Models\Role;
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
