<?php

namespace Tests\Feature;

use App\Models\Location;
use App\Models\PosRegister;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\MessageBag;
use Illuminate\Support\ViewErrorBag;
use Tests\TestCase;

class PosRegisterCrudTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_update_uses_the_member_route(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $location = Location::create(['code' => 'REG-TEST', 'name' => 'Register Warehouse', 'type' => 'warehouse', 'is_active' => true]);
        $register = PosRegister::create(['location_id' => $location->id, 'code' => 'REG-1', 'name' => 'Old Register', 'is_active' => true]);

        $this->actingAs($admin)->patch('/admin/registers/'.$register->id, [
            'location_id' => $location->id,
            'code' => 'REG-1',
            'name' => 'Updated Register',
            'is_active' => true,
        ])->assertStatus(303)
            ->assertRedirect(route('admin.registers.index'));

        $this->assertDatabaseHas('pos_registers', [
            'id' => $register->id,
            'name' => 'Updated Register',
        ]);
    }

    public function test_successful_register_update_clears_a_previous_error(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $location = Location::create(['code' => 'REG-TEST', 'name' => 'Register Warehouse', 'type' => 'warehouse', 'is_active' => true]);
        $register = PosRegister::create(['location_id' => $location->id, 'code' => 'REG-1', 'name' => 'Old Register', 'is_active' => true]);
        $errors = (new ViewErrorBag())->put('default', new MessageBag([
            'register' => ['The PATCH method is not supported for route admin/registers.'],
        ]));

        $response = $this->withSession([
            'error' => 'Previous request failed.',
            'errors' => $errors,
        ])->actingAs($admin)->patch('/admin/registers/'.$register->id, [
            'location_id' => $location->id,
            'code' => 'REG-1',
            'name' => 'Updated Register',
            'is_active' => true,
        ]);

        $response
            ->assertStatus(303)
            ->assertRedirect(route('admin.registers.index'))
            ->assertSessionHas('success', 'Register updated.')
            ->assertSessionMissing('error')
            ->assertSessionMissing('errors');
    }
}
