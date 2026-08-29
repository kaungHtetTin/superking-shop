<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('payment_proof_path')->nullable()->after('payment_method');
            $table->text('payment_rejection_reason')->nullable()->after('payment_proof_path');
            $table->timestamp('payment_reviewed_at')->nullable()->after('payment_rejection_reason');
            $table->foreignId('payment_reviewed_by')->nullable()->after('payment_reviewed_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('payment_reviewed_by');
            $table->dropColumn([
                'payment_proof_path',
                'payment_rejection_reason',
                'payment_reviewed_at',
            ]);
        });
    }
};
