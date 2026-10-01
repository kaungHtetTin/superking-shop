<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('permissions')->updateOrInsert(['name' => 'finance_book.manage'], [
            'display_name' => 'Manage finance book', 'group' => 'Finance',
            'description' => 'Manage daily funds and actual cash balances for assigned branches.',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $id = DB::table('permissions')->where('name', 'finance_book.manage')->value('id');
        $financeId = DB::table('permissions')->where('name', 'manage_finance')->value('id');
        foreach (DB::table('role_permission')->where('permission_id', $financeId)->pluck('role_id') as $roleId) {
            DB::table('role_permission')->insertOrIgnore(['role_id' => $roleId, 'permission_id' => $id]);
        }
    }

    public function down(): void
    {
        $id = DB::table('permissions')->where('name', 'finance_book.manage')->value('id');
        DB::table('role_permission')->where('permission_id', $id)->delete();
        DB::table('permissions')->where('name', 'finance_book.manage')->delete();
    }
};
