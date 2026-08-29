<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->foreignId('foc_product_unit_id')->nullable()->after('product_unit_id')->constrained('product_units')->restrictOnDelete();
            $table->decimal('foc_quantity', 12, 4)->default(0)->after('quantity');
            $table->decimal('foc_base_quantity', 18, 4)->default(0)->after('base_quantity');
            $table->decimal('foc_cost_price', 14, 2)->default(0)->after('cost_price');
            $table->dropColumn(['is_foc', 'reference_unit_price']);
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropForeign(['foc_product_unit_id']);
            $table->dropColumn(['foc_product_unit_id', 'foc_quantity', 'foc_base_quantity', 'foc_cost_price']);
            $table->boolean('is_foc')->default(false)->after('price_type');
            $table->decimal('reference_unit_price', 14, 2)->nullable()->after('unit_price');
        });
    }
};
