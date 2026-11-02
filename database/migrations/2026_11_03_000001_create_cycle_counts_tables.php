<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cycle_counts', function (Blueprint $table) {
            $table->id();
            $table->string('count_number')->unique();
            $table->foreignId('location_id')->constrained()->restrictOnDelete();
            $table->string('status')->default('draft')->index();
            $table->text('notes')->nullable();
            $table->unsignedInteger('revision')->default(1);
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('posted_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignId('stock_adjustment_id')->nullable()->constrained()->restrictOnDelete();
            $table->timestamp('snapshot_at');
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();
        });
        Schema::create('cycle_count_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cycle_count_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_unit_id')->constrained()->restrictOnDelete();
            $table->string('product_name');
            $table->string('product_code')->nullable();
            $table->string('unit_name');
            $table->decimal('system_quantity', 18, 4);
            $table->decimal('counted_quantity', 18, 4)->nullable();
            $table->decimal('base_cost', 18, 6);
            $table->unsignedBigInteger('balance_version');
            $table->string('notes', 1000)->nullable();
            $table->timestamps();
            $table->unique(['cycle_count_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cycle_count_items');
        Schema::dropIfExists('cycle_counts');
    }
};
