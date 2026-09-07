<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};

return new class extends Migration {
    public function up(): void
    {
        Schema::create('pricing_states', function (Blueprint $table) {
            $table->unsignedInteger('id')->primary();
            $table->unsignedBigInteger('version')->default(1);
        });
        DB::table('pricing_states')->insert(['id' => 1, 'version' => 1]);
        Schema::create('pricing_rules', function (Blueprint $table) {
            $table->id();
            $table->string('code', 60)->unique(); // Stable compatibility key, never renamed.
            $table->string('name', 60)->unique(); // Preserve legacy names; new names are limited to 50.
            $table->string('pricing_mode', 16)->default('manual');
            $table->decimal('markup_percent', 8, 4)->default(0);
            $table->unsignedInteger('rounding')->default(1);
            $table->decimal('minimum_profit', 14, 2)->default(0);
            $table->unsignedBigInteger('version')->default(1);
            $table->timestamps();
        });
        Schema::table('product_price_types', fn (Blueprint $table) => $table->foreignId('pricing_rule_id')->nullable()->constrained('pricing_rules')->nullOnDelete());
        Schema::table('product_unit_prices', function (Blueprint $table) {
            $table->boolean('is_manual')->default(true);
            $table->string('calculation_status', 24)->default('manual');
            $table->unsignedBigInteger('applied_rule_version')->nullable();
        });
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('pricing_base_cost', 18, 6)->nullable();
            $table->decimal('pricing_buying_cost', 18, 6)->nullable();
            $table->foreignId('pricing_source_receipt_id')->nullable()->constrained('stock_receipts')->nullOnDelete();
            $table->unsignedBigInteger('pricing_version')->default(1);
        });
        Schema::table('stock_receipt_items', fn (Blueprint $table) => $table->decimal('free_quantity', 18, 4)->default(0));
        Schema::create('price_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('product_unit_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('pricing_rule_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('old_price', 14, 2)->nullable();
            $table->decimal('new_price', 14, 2);
            $table->decimal('cost_used', 18, 6);
            $table->json('rule_snapshot');
            $table->string('trigger', 40);
            $table->string('operation_id', 100)->index();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
        DB::table('products')->update(['pricing_base_cost' => DB::raw('original_price'), 'pricing_buying_cost' => DB::raw('original_price')]);
        $names = DB::table('product_price_types')->distinct()->pluck('name')->push('retail')->unique();
        foreach ($names as $name) {
            $id = DB::table('pricing_rules')->insertGetId(['code' => $name, 'name' => ucfirst($name), 'created_at' => now(), 'updated_at' => now()]);
            DB::table('product_price_types')->where('name', $name)->update(['pricing_rule_id' => $id]);
        }
    }
    public function down(): void
    {
        Schema::dropIfExists('price_changes');
        Schema::table('stock_receipt_items', fn (Blueprint $table) => $table->dropColumn('free_quantity'));
        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pricing_source_receipt_id');
            $table->dropColumn(['pricing_base_cost', 'pricing_buying_cost', 'pricing_version']);
        });
        Schema::table('product_unit_prices', fn (Blueprint $table) => $table->dropColumn(['is_manual', 'calculation_status', 'applied_rule_version']));
        Schema::table('product_price_types', fn (Blueprint $table) => $table->dropConstrainedForeignId('pricing_rule_id'));
        Schema::dropIfExists('pricing_rules');
        Schema::dropIfExists('pricing_states');
    }
};
