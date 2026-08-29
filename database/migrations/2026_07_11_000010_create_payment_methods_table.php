<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_methods', function (Blueprint $table) {
            $table->id();
            $table->string('banking_service');
            $table->string('account_name');
            $table->string('account_no');
            $table->string('icon_path')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('payment_method_id')
                ->nullable()
                ->after('payment_method')
                ->constrained('payment_methods')
                ->nullOnDelete();
            $table->json('payment_method_snapshot')->nullable()->after('payment_method_id');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('payment_method_id');
            $table->dropColumn('payment_method_snapshot');
        });

        Schema::dropIfExists('payment_methods');
    }
};
