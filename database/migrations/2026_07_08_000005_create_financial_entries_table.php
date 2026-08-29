<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('financial_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 20);
            $table->string('category')->default('general');
            $table->string('title');
            $table->decimal('amount', 12, 2);
            $table->date('entry_date');
            $table->string('payment_method')->nullable();
            $table->string('reference')->nullable();
            $table->string('status', 20)->default('approved');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['type', 'status', 'entry_date']);
            $table->index(['category', 'entry_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_entries');
    }
};
