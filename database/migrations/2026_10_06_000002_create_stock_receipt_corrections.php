<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_receipt_corrections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_receipt_id')->constrained()->restrictOnDelete();
            $table->foreignId('stock_receipt_item_id')->constrained()->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reason', 40);
            $table->text('notes');
            $table->decimal('old_received_quantity', 18, 4);
            $table->decimal('new_received_quantity', 18, 4);
            $table->decimal('old_free_quantity', 18, 4);
            $table->decimal('new_free_quantity', 18, 4);
            $table->decimal('old_unit_cost', 12, 2);
            $table->decimal('new_unit_cost', 12, 2);
            $table->decimal('old_applied_base_cost', 12, 2);
            $table->decimal('new_applied_base_cost', 12, 2);
            $table->decimal('purchase_amount_delta', 14, 2);
            $table->foreignId('movement_id')->nullable()->constrained('inventory_movements')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_receipt_corrections');
    }
};
