<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Keep the weighted average precise until the monetary total is rounded.
        Schema::table('products', fn (Blueprint $table) => $table->decimal('original_price', 20, 6)->default(0)->change());
        Schema::table('order_items', function (Blueprint $table) {
            $table->decimal('cost_price', 20, 6)->default(0)->change();
            $table->decimal('foc_cost_price', 20, 6)->default(0)->change();
        });
        Schema::table('stock_receipt_items', function (Blueprint $table) {
            $table->decimal('previous_base_cost', 20, 6)->nullable()->change();
            $table->decimal('applied_base_cost', 20, 6)->nullable()->change();
        });
        Schema::table('stock_receipt_corrections', function (Blueprint $table) {
            $table->decimal('old_applied_base_cost', 20, 6)->change();
            $table->decimal('new_applied_base_cost', 20, 6)->change();
        });
    }

    public function down(): void
    {
        Schema::table('stock_receipt_corrections', function (Blueprint $table) {
            $table->decimal('old_applied_base_cost', 12, 2)->change();
            $table->decimal('new_applied_base_cost', 12, 2)->change();
        });
        Schema::table('stock_receipt_items', function (Blueprint $table) {
            $table->decimal('previous_base_cost', 18, 2)->nullable()->change();
            $table->decimal('applied_base_cost', 18, 2)->nullable()->change();
        });
        Schema::table('order_items', function (Blueprint $table) {
            $table->decimal('cost_price', 14, 2)->default(0)->change();
            $table->decimal('foc_cost_price', 14, 2)->default(0)->change();
        });
        Schema::table('products', fn (Blueprint $table) => $table->decimal('original_price', 14, 2)->default(0)->change());
    }
};
