<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $permissionIds = DB::table('permissions')
            ->whereIn('name', [
                'inventory.transfer.approve',
                'inventory.transfer.ship',
                'inventory.transfer.receive',
            ])
            ->pluck('id');

        if ($permissionIds->isEmpty()) {
            return;
        }

        DB::table('role_permission')->whereIn('permission_id', $permissionIds)->delete();
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();
    }

    public function down(): void
    {
        $now = now();
        $permissions = [
            ['inventory.transfer.approve', 'Approve stock transfers', 'Inventory'],
            ['inventory.transfer.ship', 'Ship stock transfers', 'Inventory'],
            ['inventory.transfer.receive', 'Receive stock transfers', 'Inventory'],
        ];

        foreach ($permissions as [$name, $displayName, $group]) {
            DB::table('permissions')->updateOrInsert(
                ['name' => $name],
                [
                    'display_name' => $displayName,
                    'group' => $group,
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );
        }
    }
};
