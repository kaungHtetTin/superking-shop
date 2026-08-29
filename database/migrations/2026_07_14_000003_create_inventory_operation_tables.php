<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_import_rows', function (Blueprint $table) {
            $table->decimal('min_quantity', 18, 4)->nullable()->after('selling_prices');
        });

        Schema::create('stock_receipts', function (Blueprint $table) {
            $table->id();
            $table->string('receipt_number', 50)->unique();
            $table->foreignId('location_id')->constrained()->restrictOnDelete();
            $table->foreignId('inventory_import_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->string('supplier_reference')->nullable();
            $table->string('status', 30)->default('draft');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();
            $table->index(['location_id', 'status']);
        });

        Schema::create('stock_receipt_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_receipt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_unit_id')->constrained()->restrictOnDelete();
            $table->decimal('expected_quantity', 18, 4)->nullable();
            $table->decimal('received_quantity', 18, 4);
            $table->decimal('base_quantity', 18, 4);
            $table->decimal('conversion_factor', 18, 6);
            $table->decimal('unit_cost', 12, 2)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('movement_id')->nullable()->constrained('inventory_movements')->nullOnDelete();
            $table->timestamps();
            $table->unique(['stock_receipt_id', 'product_id', 'product_unit_id'], 'receipt_product_unit_unique');
        });

        Schema::create('stock_adjustments', function (Blueprint $table) {
            $table->id();
            $table->string('adjustment_number', 50)->unique();
            $table->foreignId('location_id')->constrained()->restrictOnDelete();
            $table->foreignId('inventory_import_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->foreignId('reversal_of_id')->nullable()->constrained('stock_adjustments')->nullOnDelete();
            $table->string('reason_code', 80);
            $table->string('status', 30)->default('draft');
            $table->text('notes')->nullable();
            $table->boolean('requires_approval')->default(false);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('posted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();
            $table->index(['location_id', 'status']);
        });

        Schema::create('stock_adjustment_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_adjustment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_unit_id')->constrained()->restrictOnDelete();
            $table->decimal('conversion_factor', 18, 6);
            $table->decimal('system_quantity', 18, 4);
            $table->decimal('counted_quantity', 18, 4);
            $table->decimal('base_counted_quantity', 18, 4);
            $table->decimal('quantity_delta', 18, 4);
            $table->text('notes')->nullable();
            $table->foreignId('movement_id')->nullable()->constrained('inventory_movements')->nullOnDelete();
            $table->timestamps();
            $table->unique(['stock_adjustment_id', 'product_id'], 'adjustment_product_unique');
        });

        Schema::table('stock_receipts', function (Blueprint $table) {
            $table->foreignId('reversal_adjustment_id')->nullable()->constrained('stock_adjustments')->nullOnDelete();
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::table('stock_receipts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reversal_adjustment_id');
        });
        Schema::dropIfExists('stock_adjustment_items');
        Schema::dropIfExists('stock_adjustments');
        Schema::dropIfExists('stock_receipt_items');
        Schema::dropIfExists('stock_receipts');
        Schema::table('inventory_import_rows', function (Blueprint $table) {
            $table->dropColumn('min_quantity');
        });
    }
};
