<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('financial_entries', function (Blueprint $table) {
            $table->foreignId('location_id')->nullable()->after('recorded_by')->constrained('locations')->nullOnDelete();
            $table->foreignId('stock_transfer_id')->nullable()->after('location_id')->constrained('stock_transfers')->nullOnDelete();
            $table->index(['location_id', 'status', 'entry_date']);
        });

        Schema::table('stock_transfers', function (Blueprint $table) {
            $table->foreignId('paid_by_location_id')->nullable()->after('destination_location_id')->constrained('locations')->nullOnDelete();
            $table->decimal('total_amount', 14, 2)->default(0)->after('status');
            $table->string('payment_method', 80)->nullable()->after('total_amount');
        });

        Schema::table('stock_transfer_items', function (Blueprint $table) {
            $table->decimal('unit_cost', 14, 2)->default(0)->after('requested_base_quantity');
            $table->decimal('line_total', 14, 2)->default(0)->after('unit_cost');
        });

        DB::table('financial_entries')->whereNull('location_id')->orderBy('id')->chunkById(200, function ($entries) {
            foreach ($entries as $entry) {
                $locationId = null;
                if ($entry->category === 'pos_sale' && $entry->reference) {
                    $locationId = DB::table('orders')->where('receipt_number', $entry->reference)->value('location_id');
                } elseif ($entry->category === 'stock_receipt' && $entry->reference) {
                    $locationId = DB::table('stock_receipts')->where('receipt_number', $entry->reference)->value('location_id');
                }
                if ($locationId) {
                    DB::table('financial_entries')->where('id', $entry->id)->update(['location_id' => $locationId]);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('stock_transfer_items', function (Blueprint $table) {
            $table->dropColumn(['unit_cost', 'line_total']);
        });

        Schema::table('stock_transfers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('paid_by_location_id');
            $table->dropColumn(['total_amount', 'payment_method']);
        });

        Schema::table('financial_entries', function (Blueprint $table) {
            $table->dropIndex(['location_id', 'status', 'entry_date']);
            $table->dropConstrainedForeignId('stock_transfer_id');
            $table->dropConstrainedForeignId('location_id');
        });
    }
};
