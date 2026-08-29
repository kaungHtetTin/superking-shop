<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_returns', function (Blueprint $table) {
            $table->foreignId('inventory_movement_id')->nullable()->after('processed_at')->constrained('inventory_movements')->nullOnDelete();
            $table->foreignId('restocked_by')->nullable()->after('inventory_movement_id')->constrained('users')->nullOnDelete();
            $table->timestamp('restocked_at')->nullable()->after('restocked_by');
        });
    }

    public function down(): void
    {
        Schema::table('order_returns', function (Blueprint $table) {
            $table->dropConstrainedForeignId('inventory_movement_id');
            $table->dropConstrainedForeignId('restocked_by');
            $table->dropColumn('restocked_at');
        });
    }
};
