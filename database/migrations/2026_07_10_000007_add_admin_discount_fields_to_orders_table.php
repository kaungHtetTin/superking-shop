<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('admin_discount_type')->nullable()->after('discount_amount');
            $table->decimal('admin_discount_value', 10, 2)->default(0)->after('admin_discount_type');
            $table->decimal('admin_discount_amount', 10, 2)->default(0)->after('admin_discount_value');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'admin_discount_type',
                'admin_discount_value',
                'admin_discount_amount',
            ]);
        });
    }
};
