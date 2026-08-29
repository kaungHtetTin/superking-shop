<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pos_registers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->restrictOnDelete();
            $table->string('code', 50)->unique();
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['location_id', 'is_active']);
        });

        Schema::create('pos_shifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pos_register_id')->constrained('pos_registers')->restrictOnDelete();
            $table->foreignId('cashier_id')->constrained('users')->restrictOnDelete();
            $table->string('status', 24)->default('open');
            $table->decimal('opening_cash', 12, 2)->default(0);
            $table->decimal('cash_sales', 12, 2)->default(0);
            $table->decimal('cash_refunds', 12, 2)->default(0);
            $table->decimal('expected_cash', 12, 2)->default(0);
            $table->decimal('counted_cash', 12, 2)->nullable();
            $table->decimal('variance', 12, 2)->nullable();
            $table->timestamp('opened_at');
            $table->timestamp('closed_at')->nullable();
            $table->text('closing_notes')->nullable();
            $table->timestamps();
            $table->index(['pos_register_id', 'status']);
            $table->index(['cashier_id', 'status']);
        });

        Schema::create('held_carts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pos_register_id')->constrained('pos_registers')->cascadeOnDelete();
            $table->foreignId('cashier_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('label')->nullable();
            $table->json('cart_payload');
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
            $table->index(['cashier_id', 'pos_register_id']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->string('sales_channel', 24)->default('online')->after('order_number');
            $table->foreignId('location_id')->nullable()->after('sales_channel')->constrained()->nullOnDelete();
            $table->foreignId('register_id')->nullable()->after('location_id')->constrained('pos_registers')->nullOnDelete();
            $table->foreignId('shift_id')->nullable()->after('register_id')->constrained('pos_shifts')->nullOnDelete();
            $table->foreignId('served_by')->nullable()->after('shift_id')->constrained('users')->nullOnDelete();
            $table->string('receipt_number', 60)->nullable()->unique()->after('served_by');
            $table->json('pos_tender_summary')->nullable()->after('receipt_number');
        });

        DB::statement('ALTER TABLE orders MODIFY user_id BIGINT UNSIGNED NULL');

        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('register_id')->nullable()->after('order_id')->constrained('pos_registers')->nullOnDelete();
            $table->foreignId('shift_id')->nullable()->after('register_id')->constrained('pos_shifts')->nullOnDelete();
            $table->foreignId('received_by')->nullable()->after('shift_id')->constrained('users')->nullOnDelete();
            $table->decimal('amount_tendered', 12, 2)->nullable()->after('amount');
            $table->decimal('change_due', 12, 2)->default(0)->after('amount_tendered');
            $table->string('tender_type', 32)->nullable()->after('method');
            $table->index(['shift_id', 'status']);
        });

        $warehouseId = DB::table('locations')->where('code', 'MAIN-WH')->value('id')
            ?: DB::table('locations')->where('code', 'MAIN-STORE')->value('id');
        if ($warehouseId) {
            DB::table('pos_registers')->insertOrIgnore([
                'location_id' => $warehouseId,
                'code' => 'MAIN-REG-1',
                'name' => 'Main Register',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex(['shift_id', 'status']);
            $table->dropConstrainedForeignId('register_id');
            $table->dropConstrainedForeignId('shift_id');
            $table->dropConstrainedForeignId('received_by');
            $table->dropColumn(['amount_tendered', 'change_due', 'tender_type']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('location_id');
            $table->dropConstrainedForeignId('register_id');
            $table->dropConstrainedForeignId('shift_id');
            $table->dropConstrainedForeignId('served_by');
            $table->dropColumn(['sales_channel', 'receipt_number', 'pos_tender_summary']);
        });

        Schema::dropIfExists('held_carts');
        Schema::dropIfExists('pos_shifts');
        Schema::dropIfExists('pos_registers');

        DB::statement('ALTER TABLE orders MODIFY user_id BIGINT UNSIGNED NOT NULL');
    }
};
