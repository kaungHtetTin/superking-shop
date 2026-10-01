<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('finance_book_funds', fn (Blueprint $table) => $table->date('entry_date')->nullable()->index());
        DB::table('finance_book_funds')->update(['entry_date' => DB::raw('DATE(created_at)')]);
        Schema::create('finance_book_counts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->restrictOnDelete();
            $table->date('entry_date');
            $table->decimal('actual_balance', 18, 2);
            $table->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
            $table->string('notes', 1000)->nullable();
            $table->timestamps();
            $table->unique(['location_id', 'entry_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_book_counts');
        Schema::table('finance_book_funds', fn (Blueprint $table) => $table->dropColumn('entry_date'));
    }
};
