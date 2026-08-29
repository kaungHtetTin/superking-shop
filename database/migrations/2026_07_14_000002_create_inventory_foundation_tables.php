<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->unique();
            $table->string('name');
            $table->enum('type', ['warehouse', 'store']);
            $table->text('address')->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('timezone', 64)->default('Asia/Yangon');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default_fulfillment')->default(false);
            $table->boolean('is_system')->default(false);
            $table->timestamps();
            $table->index(['type', 'is_active']);
        });

        Schema::create('location_user', function (Blueprint $table) {
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_default')->default(false);
            $table->timestamps();
            $table->primary(['location_id', 'user_id']);
            $table->index(['user_id', 'is_default']);
        });

        Schema::create('inventory_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->decimal('on_hand_qty', 18, 4)->default(0);
            $table->decimal('reserved_qty', 18, 4)->default(0);
            $table->unsignedBigInteger('version')->default(0);
            $table->timestamps();
            $table->unique(['location_id', 'product_id']);
            $table->index(['location_id', 'on_hand_qty']);
        });

        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_unit_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 40);
            $table->decimal('unit_quantity', 18, 4)->nullable();
            $table->decimal('conversion_factor', 18, 6)->nullable();
            $table->decimal('quantity_delta', 18, 4)->default(0);
            $table->decimal('reserved_delta', 18, 4)->default(0);
            $table->decimal('on_hand_before', 18, 4);
            $table->decimal('on_hand_after', 18, 4);
            $table->decimal('reserved_before', 18, 4);
            $table->decimal('reserved_after', 18, 4);
            $table->nullableMorphs('reference');
            $table->string('reason_code', 80)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('occurred_at');
            $table->string('idempotency_key', 191)->nullable()->unique();
            $table->timestamps();
            $table->index(['location_id', 'product_id', 'occurred_at'], 'inventory_movement_location_product_time');
            $table->index(['type', 'occurred_at']);
        });

        Schema::create('inventory_imports', function (Blueprint $table) {
            $table->id();
            $table->string('batch_number', 50)->unique();
            $table->foreignId('location_id')->constrained()->restrictOnDelete();
            $table->enum('mode', ['stock_receipt', 'opening_balance', 'price_only', 'physical_count']);
            $table->enum('status', ['uploaded', 'validating', 'ready', 'posting', 'completed', 'failed', 'cancelled'])->default('uploaded');
            $table->string('original_filename');
            $table->string('stored_file_path');
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('valid_rows')->default(0);
            $table->unsignedInteger('error_rows')->default(0);
            $table->unsignedInteger('posted_rows')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('posted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();
            $table->index(['location_id', 'status']);
        });

        Schema::create('inventory_import_rows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_import_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('row_number');
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('product_unit_id')->nullable()->constrained()->nullOnDelete();
            $table->json('raw_data')->nullable();
            $table->decimal('quantity', 18, 4)->nullable();
            $table->decimal('base_quantity', 18, 4)->nullable();
            $table->decimal('original_price', 12, 2)->nullable();
            $table->json('selling_prices')->nullable();
            $table->json('validation_errors')->nullable();
            $table->json('validation_warnings')->nullable();
            $table->enum('status', ['pending', 'valid', 'warning', 'error', 'posted', 'skipped'])->default('pending');
            $table->foreignId('movement_id')->nullable()->constrained('inventory_movements')->nullOnDelete();
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('idempotency_key', 191)->nullable()->unique();
            $table->timestamps();
            $table->unique(['inventory_import_id', 'row_number']);
            $table->index(['inventory_import_id', 'status']);
        });

        $now = now();
        DB::table('locations')->insert([
            [
                'code' => 'MAIN-WH',
                'name' => 'Main Warehouse',
                'type' => 'warehouse',
                'timezone' => 'Asia/Yangon',
                'is_active' => true,
                'is_default_fulfillment' => true,
                'is_system' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'code' => 'MAIN-STORE',
                'name' => 'Main Store',
                'type' => 'warehouse',
                'timezone' => 'Asia/Yangon',
                'is_active' => true,
                'is_default_fulfillment' => false,
                'is_system' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        $locationIds = DB::table('locations')->pluck('id', 'code');
        DB::table('users')
            ->whereIn('role', ['super_admin', 'manager', 'inventory_staff', 'sales', 'support', 'cashier'])
            ->orderBy('id')
            ->each(function ($user) use ($locationIds, $now) {
                foreach ($locationIds as $code => $locationId) {
                    DB::table('location_user')->insertOrIgnore([
                        'location_id' => $locationId,
                        'user_id' => $user->id,
                        'is_default' => $code === 'MAIN-WH',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_import_rows');
        Schema::dropIfExists('inventory_imports');
        Schema::dropIfExists('inventory_movements');
        Schema::dropIfExists('inventory_balances');

        Schema::dropIfExists('location_user');
        Schema::dropIfExists('locations');
    }
};
