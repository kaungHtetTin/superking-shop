<?php

namespace Tests\Feature;

use App\Models\Location;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BranchAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_non_super_admin_is_limited_to_assigned_branches(): void
    {
        $first = Location::create(['name' => 'Allowed', 'code' => 'ACCESS-A', 'type' => 'warehouse', 'is_active' => true]);
        $second = Location::create(['name' => 'Denied', 'code' => 'ACCESS-B', 'type' => 'warehouse', 'is_active' => true]);
        $user = User::factory()->create(['role' => 'manager', 'status' => 'active', 'permissions' => ['locations.manage']]);
        $user->locations()->sync([$first->id]);

        $this->assertSame([$first->id], $user->accessibleLocationIds());
        $this->assertTrue($user->canAccessLocation($first));
        $this->assertFalse($user->canAccessLocation($second));
        $user->locations()->detach();
        $this->assertSame([], $user->accessibleLocationIds());
        $this->assertFalse($user->canAccessLocation($first));
    }
}
