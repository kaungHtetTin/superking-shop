<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->where('role', 'customer')
            ->whereNotNull('deleted_at')
            ->orderBy('id')
            ->chunkById(100, function ($customers): void {
                foreach ($customers as $customer) {
                    DB::table('users')->where('id', $customer->id)->update([
                        'email' => 'deleted-'.$customer->id.'@deleted.invalid',
                        'phone' => null,
                        'google_id' => null,
                        'remember_token' => null,
                        'updated_at' => now(),
                    ]);
                }
            });
    }

    public function down(): void
    {
        // This irreversible cleanup intentionally leaves released contacts available for reuse.
    }
};
