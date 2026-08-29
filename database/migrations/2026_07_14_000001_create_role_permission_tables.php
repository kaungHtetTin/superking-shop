<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('display_name');
            $table->text('description')->nullable();
            $table->boolean('is_admin')->default(true);
            $table->boolean('is_system')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('display_name');
            $table->string('group')->default('General');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('role_permission', function (Blueprint $table) {
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();
            $table->foreignId('permission_id')->constrained()->cascadeOnDelete();
            $table->primary(['role_id', 'permission_id']);
        });

        Schema::create('role_user', function (Blueprint $table) {
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['role_id', 'user_id']);
            $table->unique('user_id');
        });

        $now = now();
        $roles = [
            ['name' => 'super_admin', 'display_name' => 'Admin', 'description' => 'System owner with unrestricted access.', 'is_system' => true, 'sort_order' => 10],
            ['name' => 'manager', 'display_name' => 'Manager', 'description' => 'Runs store operations, sales, inventory, and reports.', 'is_system' => true, 'sort_order' => 20],
            ['name' => 'inventory_staff', 'display_name' => 'Inventory Staff', 'description' => 'Receives, counts, adjusts, and transfers assigned inventory.', 'is_system' => true, 'sort_order' => 30],
            ['name' => 'sales', 'display_name' => 'Sales', 'description' => 'Handles orders and point-of-sale workflows.', 'is_system' => true, 'sort_order' => 40],
            ['name' => 'support', 'display_name' => 'Support', 'description' => 'Handles customers, reviews, and support conversations.', 'is_system' => true, 'sort_order' => 50],
        ];

        DB::table('roles')->insert(array_map(fn (array $role) => array_merge($role, [
            'is_admin' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]), $roles));

        $permissions = [
            ['dashboard.view', 'View dashboard', 'Overview'],
            ['roles.manage', 'Manage roles and permissions', 'Access control'],
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
            ['view_reports', 'View business reports', 'Sales'],
            ['manage_finance', 'Manage finance', 'Sales'],
            ['manage_payment_methods', 'Manage payment methods', 'Sales'],
            ['manage_coupons', 'Manage coupons', 'Marketing'],
            ['manage_flash_sales', 'Manage flash sales', 'Marketing'],
            ['manage_blogs', 'Manage blogs', 'Marketing'],
            ['chat.manage', 'Manage customer chats', 'Support'],
            ['moderate_reviews', 'Moderate reviews', 'Support'],
            ['locations.view', 'View locations', 'Inventory'],
            ['locations.manage', 'Manage locations', 'Inventory'],
            ['registers.manage', 'Manage POS registers', 'Inventory'],
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

        DB::table('permissions')->insert(array_map(fn (array $permission) => [
            'name' => $permission[0],
            'display_name' => $permission[1],
            'group' => $permission[2],
            'created_at' => $now,
            'updated_at' => $now,
        ], $permissions));

        $permissionIds = DB::table('permissions')->pluck('id', 'name');
        $roleIds = DB::table('roles')->pluck('id', 'name');
        $allPermissions = $permissionIds->keys()->all();

        $managerPermissions = array_values(array_diff($allPermissions, [
            'roles.manage',
            'staff.manage',
            'settings.manage',
        ]));

        $rolePermissions = [
            'super_admin' => $allPermissions,
            'manager' => $managerPermissions,
            'inventory_staff' => [
                'dashboard.view', 'catalog.view', 'locations.view', 'inventory.view', 'inventory.history',
                'inventory.receive', 'inventory.adjust.create', 'inventory.transfer.create',
                'reports.inventory',
            ],
            'sales' => [
                'dashboard.view', 'catalog.view', 'catalog.manage', 'storefront.manage', 'orders.view',
                'orders.manage', 'chat.manage', 'inventory.view', 'pos.access', 'pos.shift.open',
                'pos.shift.close', 'pos.discount', 'pos.hold',
            ],
            'support' => [
                'dashboard.view', 'catalog.view', 'catalog.manage', 'storefront.manage', 'orders.view',
                'chat.manage', 'moderate_reviews', 'view_customers',
            ],
        ];

        foreach ($rolePermissions as $roleName => $names) {
            $rows = collect($names)
                ->filter(fn (string $name) => $permissionIds->has($name))
                ->map(fn (string $name) => [
                    'role_id' => $roleIds[$roleName],
                    'permission_id' => $permissionIds[$name],
                ])
                ->values()
                ->all();

            if ($rows) {
                DB::table('role_permission')->insert($rows);
            }
        }

        DB::table('users')->where('role', 'cashier')->update(['role' => 'sales']);

        DB::table('users')
            ->whereIn('role', $roleIds->keys())
            ->orderBy('id')
            ->each(function ($user) use ($roleIds) {
                DB::table('role_user')->insertOrIgnore([
                    'role_id' => $roleIds[$user->role],
                    'user_id' => $user->id,
                ]);
            });
    }

    public function down(): void
    {
        DB::table('users')->where('role', 'sales')->update(['role' => 'cashier']);

        Schema::dropIfExists('role_user');
        Schema::dropIfExists('role_permission');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
    }
};
