<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        $foreignKey = $this->foreignKeyName();

        if ($foreignKey) {
            DB::statement("ALTER TABLE order_returns DROP FOREIGN KEY `{$foreignKey}`");
        }

        DB::statement('ALTER TABLE order_returns MODIFY user_id BIGINT UNSIGNED NULL');
        DB::statement('ALTER TABLE order_returns ADD CONSTRAINT order_returns_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        $foreignKey = $this->foreignKeyName();

        if ($foreignKey) {
            DB::statement("ALTER TABLE order_returns DROP FOREIGN KEY `{$foreignKey}`");
        }

        DB::statement('ALTER TABLE order_returns MODIFY user_id BIGINT UNSIGNED NOT NULL');
        DB::statement('ALTER TABLE order_returns ADD CONSTRAINT order_returns_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
    }

    private function foreignKeyName(): ?string
    {
        $row = DB::selectOne(
            "SELECT CONSTRAINT_NAME
             FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'order_returns'
               AND COLUMN_NAME = 'user_id'
               AND REFERENCED_TABLE_NAME = 'users'
             LIMIT 1"
        );

        return $row?->CONSTRAINT_NAME;
    }
};
