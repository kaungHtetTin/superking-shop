<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('coupon_id')->nullable()->after('user_id')->constrained('coupons')->nullOnDelete();
            $table->string('coupon_code')->nullable()->after('coupon_id');
            $table->integer('redeemed_points')->default(0)->after('discount_amount');
            $table->integer('earned_points')->default(0)->after('redeemed_points');
            $table->timestamp('loyalty_awarded_at')->nullable()->after('earned_points');
            $table->timestamp('points_restored_at')->nullable()->after('loyalty_awarded_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('coupon_id');
            $table->dropColumn([
                'coupon_code',
                'redeemed_points',
                'earned_points',
                'loyalty_awarded_at',
                'points_restored_at',
            ]);
        });
    }
};
