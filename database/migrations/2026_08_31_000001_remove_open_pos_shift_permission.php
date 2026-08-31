<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('permissions')->whereIn('name', ['pos.shift.open', 'pos.shift.close'])->delete();
    }

    public function down(): void
    {
        DB::table('permissions')->insertOrIgnore([
            'name' => 'pos.shift.open',
            'display_name' => 'Open POS shifts',
            'group' => 'POS',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('permissions')->insertOrIgnore([
            'name' => 'pos.shift.close',
            'display_name' => 'Close POS shifts',
            'group' => 'POS',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
};
