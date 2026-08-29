<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Services\AppSettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CurrencySettingTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_update_the_currency_label(): void
    {
        $role = Role::query()->where('name', 'super_admin')->firstOrFail();
        $admin = User::factory()->create([
            'role' => 'super_admin',
            'status' => 'active',
            'permissions' => [],
        ]);
        $admin->roles()->sync([$role->id]);

        $this->actingAs($admin)
            ->post('/admin/settings', [
                'app_name' => 'LaLaPick',
                'currency_label' => 'USD',
                'theme_color' => '#087f74',
                'contacts' => [],
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('settings', [
            'key' => 'currency_label',
            'value' => 'USD',
            'group' => 'general',
        ]);
        $this->assertSame('USD', app(AppSettingsService::class)->publicSettings()['currency_label']);
    }

    public function test_currency_label_is_required_and_limited_to_twelve_characters(): void
    {
        $role = Role::query()->where('name', 'super_admin')->firstOrFail();
        $admin = User::factory()->create([
            'role' => 'super_admin',
            'status' => 'active',
            'permissions' => [],
        ]);
        $admin->roles()->sync([$role->id]);

        $this->actingAs($admin)
            ->from('/admin/settings')
            ->post('/admin/settings', [
                'app_name' => 'LaLaPick',
                'currency_label' => 'TOO-LONG-CURRENCY',
                'theme_color' => '#087f74',
                'contacts' => [],
            ])
            ->assertRedirect('/admin/settings')
            ->assertSessionHasErrors('currency_label');
    }
}
