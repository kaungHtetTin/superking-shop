<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('roles') || ! Schema::hasTable('permissions') || ! Schema::hasTable('role_user')) {
            return;
        }

        DB::transaction(function () {
            $now = now();
            $roleMap = [
                'super_admin' => 'super_admin',
                'manager' => 'manager',
                'inventory_staff' => 'staff',
                'sales' => 'staff',
                'support' => 'staff',
                'cashier' => 'staff',
                'staff' => 'staff',
            ];

            DB::table('role_user')
                ->join('roles', 'role_user.role_id', '=', 'roles.id')
                ->where('roles.is_admin', true)
                ->select('role_user.user_id', 'roles.name')
                ->orderBy('role_user.user_id')
                ->get()
                ->each(function ($assignment) use ($roleMap) {
                    $roleName = $roleMap[$assignment->name] ?? 'staff';
                    DB::table('users')->where('id', $assignment->user_id)->update([
                        'role' => $roleName,
                        'permissions' => json_encode([]),
                        'updated_at' => now(),
                    ]);
                });

            foreach ($roleMap as $oldRole => $newRole) {
                DB::table('users')->where('role', $oldRole)->update([
                    'role' => $newRole,
                    'permissions' => json_encode([]),
                    'updated_at' => $now,
                ]);
            }

            DB::table('role_user')->delete();
            DB::table('role_permission')->delete();

            DB::table('roles')
                ->where('is_admin', true)
                ->whereNotIn('name', ['super_admin', 'manager', 'staff'])
                ->delete();

            $roles = [
                [
                    'name' => 'super_admin',
                    'display_name' => 'Super Admin',
                    'description' => 'Owns the system and can access every admin feature.',
                    'sort_order' => 10,
                ],
                [
                    'name' => 'manager',
                    'display_name' => 'Manager',
                    'description' => 'Runs store operations, sales, inventory, reports, and staff accounts.',
                    'sort_order' => 20,
                ],
                [
                    'name' => 'staff',
                    'display_name' => 'Staff',
                    'description' => 'Handles daily POS, orders, customers, chats, and basic inventory lookup.',
                    'sort_order' => 30,
                ],
            ];

            foreach ($roles as $role) {
                DB::table('roles')->updateOrInsert(
                    ['name' => $role['name']],
                    [
                        'display_name' => $role['display_name'],
                        'description' => $role['description'],
                        'is_admin' => true,
                        'is_system' => true,
                        'sort_order' => $role['sort_order'],
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                );
            }

            $permissions = [
                ['dashboard.view', 'View dashboard', 'Overview'],
                ['roles.manage', 'View fixed roles and permissions', 'Access control'],
                ['staff.manage', 'Manage staff accounts', 'Access control'],
                ['settings.manage', 'Manage application settings', 'Access control'],
                ['view_audit_logs', 'View audit logs', 'Access control'],
                ['catalog.view', 'View product catalog', 'Catalog'],
                ['catalog.manage', 'Manage products and categories', 'Catalog'],
                ['pricing.manage', 'Manage product pricing', 'Catalog'],
                ['storefront.manage', 'Manage storefront content', 'Catalog'],
                ['orders.view', 'View orders', 'Sales'],
                ['orders.manage', 'Manage order fulfillment', 'Sales'],
                ['orders.review_payment', 'Review order payments', 'Sales'],
                ['orders.cancel', 'Cancel orders', 'Sales'],
                ['orders.returns', 'Manage order returns', 'Sales'],
                ['view_customers', 'View customers', 'Sales'],
                ['view_reports', 'View business reports', 'Reports'],
                ['manage_finance', 'Manage finance', 'Finance'],
                ['manage_payment_methods', 'Manage payment methods', 'Finance'],
                ['manage_coupons', 'Manage coupons', 'Marketing'],
                ['manage_flash_sales', 'Manage flash sales', 'Marketing'],
                ['manage_blogs', 'Manage blogs', 'Marketing'],
                ['chat.manage', 'Manage customer chats', 'Support'],
                ['moderate_reviews', 'Moderate reviews', 'Support'],
                ['locations.view', 'View locations', 'Inventory'],
                ['locations.manage', 'Manage locations', 'Inventory'],
                ['registers.manage', 'Manage POS registers', 'POS'],
                ['inventory.view', 'View inventory balances', 'Inventory'],
                ['inventory.history', 'View inventory history', 'Inventory'],
                ['inventory.receive', 'Receive stock', 'Inventory'],
                ['inventory.adjust.create', 'Create stock adjustments', 'Inventory'],
                ['inventory.adjust.approve', 'Approve stock adjustments', 'Inventory'],
                ['inventory.transfer.create', 'Create stock transfers', 'Inventory'],
                ['pos.access', 'Access POS', 'POS'],
                ['pos.shift.open', 'Open POS shifts', 'POS'],
                ['pos.shift.close', 'Close POS shifts', 'POS'],
                ['pos.discount', 'Apply POS discounts', 'POS'],
                ['pos.hold', 'Hold and resume POS sales', 'POS'],
                ['pos.void', 'Void POS sales', 'POS'],
                ['pos.refund', 'Refund POS sales', 'POS'],
                ['reports.sales', 'View sales reports', 'Reports'],
                ['reports.inventory', 'View inventory reports', 'Reports'],
            ];

            $permissionNames = collect($permissions)->pluck(0)->all();

            foreach ($permissions as $permission) {
                DB::table('permissions')->updateOrInsert(
                    ['name' => $permission[0]],
                    [
                        'display_name' => $permission[1],
                        'group' => $permission[2],
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                );
            }

            DB::table('permissions')->whereNotIn('name', $permissionNames)->delete();

            $permissionIds = DB::table('permissions')->pluck('id', 'name');
            $roleIds = DB::table('roles')->whereIn('name', ['super_admin', 'manager', 'staff'])->pluck('id', 'name');
            $allPermissions = $permissionIds->keys()->all();

            $rolePermissions = [
                'super_admin' => $allPermissions,
                'manager' => array_values(array_diff($allPermissions, [
                    'roles.manage',
                    'settings.manage',
                    'view_audit_logs',
                ])),
                'staff' => [
                    'dashboard.view',
                    'catalog.view',
                    'orders.view',
                    'orders.manage',
                    'view_customers',
                    'chat.manage',
                    'locations.view',
                    'inventory.view',
                    'pos.access',
                    'pos.shift.open',
                    'pos.shift.close',
                    'pos.hold',
                ],
            ];

            foreach ($rolePermissions as $roleName => $names) {
                $rows = collect($names)
                    ->filter(fn (string $name) => $permissionIds->has($name) && $roleIds->has($roleName))
                    ->map(fn (string $name) => [
                        'role_id' => $roleIds[$roleName],
                        'permission_id' => $permissionIds[$name],
                    ])
                    ->values()
                    ->all();

                if ($rows !== []) {
                    DB::table('role_permission')->insertOrIgnore($rows);
                }
            }

            DB::table('users')
                ->whereIn('role', ['super_admin', 'manager', 'staff'])
                ->orderBy('id')
                ->get(['id', 'role'])
                ->each(function ($user) use ($roleIds) {
                    if (! $roleIds->has($user->role)) {
                        return;
                    }

                    DB::table('role_user')->insertOrIgnore([
                        'role_id' => $roleIds[$user->role],
                        'user_id' => $user->id,
                    ]);
                });
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('roles') || ! Schema::hasTable('role_user')) {
            return;
        }

        DB::table('users')->where('role', 'staff')->update([
            'role' => 'sales',
            'updated_at' => now(),
        ]);
    }
};
