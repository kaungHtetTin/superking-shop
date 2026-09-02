<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Preserve the audit history while removing old internal movements from
        // active finance totals. New transfers no longer create these entries.
        DB::table('financial_entries')
            ->where('category', 'internal_transfer')
            ->update(['status' => 'void', 'updated_at' => now()]);
    }

    public function down(): void
    {
        // Voided historical records are intentionally not re-approved on rollback.
    }
};
