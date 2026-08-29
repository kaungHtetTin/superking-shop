<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('operations_health_checks', function (Blueprint $table) {
            $table->id();
            $table->string('check_name', 80);
            $table->string('status', 20);
            $table->string('summary');
            $table->json('details')->nullable();
            $table->timestamp('checked_at');
            $table->timestamps();
            $table->index(['check_name', 'checked_at']);
            $table->index(['status', 'checked_at']);
        });

        Schema::create('inventory_stock_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_balance_id')->constrained()->cascadeOnDelete();
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('type', 24);
            $table->string('status', 20)->default('open');
            $table->decimal('available_qty', 18, 4);
            $table->decimal('min_quantity', 18, 4);
            $table->timestamp('detected_at');
            $table->timestamp('last_notified_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->unique(['inventory_balance_id', 'type']);
            $table->index(['status', 'type']);
            $table->index(['location_id', 'status']);
        });

        $salesRoleId = DB::table('roles')->where('name', 'sales')->value('id');
        $salesReportsPermissionId = DB::table('permissions')->where('name', 'reports.sales')->value('id');
        if ($salesRoleId && $salesReportsPermissionId) {
            DB::table('role_permission')->insertOrIgnore([
                'role_id' => $salesRoleId,
                'permission_id' => $salesReportsPermissionId,
            ]);
        }
    }

    public function down(): void
    {
        $salesRoleId = DB::table('roles')->where('name', 'sales')->value('id');
        $salesReportsPermissionId = DB::table('permissions')->where('name', 'reports.sales')->value('id');
        if ($salesRoleId && $salesReportsPermissionId) {
            DB::table('role_permission')
                ->where('role_id', $salesRoleId)
                ->where('permission_id', $salesReportsPermissionId)
                ->delete();
        }

        Schema::dropIfExists('inventory_stock_alerts');
        Schema::dropIfExists('operations_health_checks');
    }
};
