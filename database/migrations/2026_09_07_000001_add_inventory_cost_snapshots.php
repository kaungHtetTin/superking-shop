<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_receipt_items', function (Blueprint $table) {
            $table->decimal('previous_base_cost', 18, 2)->nullable();
            $table->decimal('applied_base_cost', 18, 2)->nullable();
        });
        Schema::table('stock_adjustment_items', function (Blueprint $table) {
            $table->decimal('base_cost', 18, 2)->nullable();
            $table->decimal('value_delta', 18, 2)->nullable();
        });
        // Historical cost cannot be reconstructed reliably from today's price.
        // Leave legacy snapshots unknown rather than silently inventing values.
    }

    public function down(): void
    {
        Schema::table('stock_receipt_items', fn (Blueprint $table) => $table->dropColumn(['previous_base_cost', 'applied_base_cost']));
        Schema::table('stock_adjustment_items', fn (Blueprint $table) => $table->dropColumn(['base_cost', 'value_delta']));
    }
};
