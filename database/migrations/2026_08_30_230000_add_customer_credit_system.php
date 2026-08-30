<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('credit_limit', 14, 2)->default(0)->after('loyalty_points');
            $table->unsignedSmallInteger('credit_terms_days')->default(30)->after('credit_limit');
            $table->string('credit_status', 20)->default('disabled')->after('credit_terms_days');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->date('credit_due_date')->nullable()->after('payment_status');
            $table->decimal('credit_amount', 14, 2)->default(0)->after('credit_due_date');
            $table->decimal('paid_amount', 14, 2)->default(0)->after('credit_amount');
        });

        Schema::create('customer_credit_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('transaction_number')->unique();
            $table->foreignId('customer_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('register_id')->nullable()->constrained('pos_registers')->nullOnDelete();
            $table->foreignId('shift_id')->nullable()->constrained('pos_shifts')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 30); // sale, payment, adjustment, refund, reversal
            $table->decimal('amount', 14, 2); // debit is positive; payment/credit is negative
            $table->decimal('balance_after', 14, 2);
            $table->string('tender_type', 30)->nullable();
            $table->string('reference', 100)->nullable();
            $table->date('due_date')->nullable();
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['customer_id', 'created_at']);
            $table->index(['customer_id', 'due_date']);
            $table->index(['order_id', 'type']);
        });

        DB::table('permissions')->updateOrInsert(
            ['name' => 'credit.manage'],
            [
                'display_name' => 'Manage customer credit',
                'group' => 'Sales',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );

        $permissionId = DB::table('permissions')->where('name', 'credit.manage')->value('id');
        $roleIds = DB::table('roles')->whereIn('name', ['super_admin', 'manager'])->pluck('id');
        foreach ($roleIds as $roleId) {
            DB::table('role_permission')->insertOrIgnore([
                'role_id' => $roleId,
                'permission_id' => $permissionId,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_credit_transactions');

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['credit_due_date', 'credit_amount', 'paid_amount']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['credit_limit', 'credit_terms_days', 'credit_status']);
        });

        DB::table('permissions')->where('name', 'credit.manage')->delete();
    }
};
