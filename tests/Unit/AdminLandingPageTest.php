<?php

namespace Tests\Unit;

use App\Models\User;
use App\Support\AdminLandingPage;
use Tests\TestCase;

class AdminLandingPageTest extends TestCase
{
    public function test_dashboard_is_preferred_when_allowed(): void
    {
        $this->assertSame('/admin/dashboard', AdminLandingPage::path($this->userWith(['dashboard.view', 'pos.access'])));
    }

    public function test_staff_without_dashboard_uses_first_allowed_page(): void
    {
        $this->assertSame('/admin/pos', AdminLandingPage::path($this->userWith(['pos.access'])));
        $this->assertSame('/admin/inventory/receipts', AdminLandingPage::path($this->userWith(['inventory.receive'])));
    }

    public function test_profile_is_the_safe_fallback(): void
    {
        $this->assertSame('/admin/profile', AdminLandingPage::path($this->userWith([])));
        $this->assertSame('/admin/profile', AdminLandingPage::path($this->userWith(['catalog.manage'])));
    }

    public function test_disabled_pos_is_not_selected_as_a_landing_page(): void
    {
        config()->set('inventory.pos_enabled', false);

        $this->assertSame('/admin/profile', AdminLandingPage::path($this->userWith(['pos.access'])));
    }

    private function userWith(array $permissions): User
    {
        $user = new class extends User
        {
            public array $granted = [];

            public function hasAdminPermission(string $permission): bool
            {
                return in_array($permission, $this->granted, true);
            }
        };

        $user->granted = $permissions;

        return $user;
    }
}
