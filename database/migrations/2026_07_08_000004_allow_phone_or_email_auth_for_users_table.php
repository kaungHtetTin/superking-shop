<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE users MODIFY email VARCHAR(255) NULL');

        $duplicatePhones = DB::table('users')
            ->select('phone')
            ->whereNotNull('phone')
            ->where('phone', '<>', '')
            ->groupBy('phone')
            ->havingRaw('COUNT(*) > 1')
            ->exists();

        if (! $duplicatePhones) {
            DB::statement('CREATE UNIQUE INDEX users_phone_unique ON users (phone)');
        }
    }

    public function down(): void
    {
        $phoneIndex = DB::selectOne(
            "SELECT COUNT(*) AS count FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'users_phone_unique'"
        );

        if ((int) $phoneIndex->count > 0) {
            DB::statement('DROP INDEX users_phone_unique ON users');
        }

        DB::statement('ALTER TABLE users MODIFY email VARCHAR(255) NOT NULL');
    }
};
