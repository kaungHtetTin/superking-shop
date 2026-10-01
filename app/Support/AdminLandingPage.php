<?php

namespace App\Support;

use App\Models\User;

class AdminLandingPage
{
    public static function path(?User $user): string
    {
        if (! $user) {
            return '/admin/login';
        }

        $pages = [
            ['dashboard.view', '/admin/dashboard'],
            ['pos.access', '/admin/pos'],
            ['registers.manage', '/admin/registers'],
            ['orders.view', '/admin/orders'],
            ['view_customers', '/admin/customers'],
            ['manage_finance', '/admin/finance'],
            ['finance_book.manage', '/admin/finance-book'],
            ['manage_payment_methods', '/admin/payment-methods'],
            ['view_reports', '/admin/reports'],
            ['reports.sales', '/admin/reports'],
            ['reports.inventory', '/admin/reports'],
            ['manage_blogs', '/admin/blogs'],
            ['manage_flash_sales', '/admin/flash-sales'],
            ['manage_coupons', '/admin/coupons'],
            ['catalog.view', '/admin/products'],
            ['inventory.view', '/admin/inventory'],
            ['inventory.receive', '/admin/inventory/receipts'],
            ['inventory.adjust.create', '/admin/inventory/adjustments'],
            ['inventory.transfer.create', '/admin/inventory/transfers'],
            ['locations.view', '/admin/locations'],
            ['chat.manage', '/admin/chats'],
            ['moderate_reviews', '/admin/reviews'],
            ['staff.manage', '/admin/users'],
            ['roles.manage', '/admin/roles'],
            ['settings.manage', '/admin/settings'],
            ['pricing.manage', '/admin/settings?section=prices'],
            ['view_audit_logs', '/admin/audit-logs'],
            ['storefront.manage', '/admin/storefront'],
        ];

        foreach ($pages as [$permission, $path]) {
            if ($permission === 'pos.access' && ! config('inventory.pos_enabled', true)) {
                continue;
            }

            if ($user->hasAdminPermission($permission)) {
                return $path;
            }
        }

        return '/admin/profile';
    }
}
