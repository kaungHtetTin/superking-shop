<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pos_shifts', function (Blueprint $table) {
            $table->foreignId('location_id')->nullable()->after('pos_register_id')->constrained()->restrictOnDelete();
            $table->foreignId('closed_by_user_id')->nullable()->after('cashier_id')->constrained('users')->nullOnDelete();
            $table->unsignedTinyInteger('open_slot')->nullable()->after('status');
            $table->decimal('cash_received_total', 14, 2)->default(0)->after('cash_sales');
            $table->decimal('change_given_total', 14, 2)->default(0)->after('cash_received_total');
            $table->decimal('net_cash_sales', 14, 2)->default(0)->after('change_given_total');
            $table->decimal('card_sales_total', 14, 2)->default(0)->after('net_cash_sales');
            $table->decimal('mobile_sales_total', 14, 2)->default(0)->after('card_sales_total');
            $table->unsignedInteger('sale_count')->default(0)->after('mobile_sales_total');
            $table->text('opening_notes')->nullable()->after('opened_at');
        });

        DB::table('pos_shifts')->orderBy('id')->each(function ($shift) {
            $locationId = DB::table('pos_registers')->where('id', $shift->pos_register_id)->value('location_id');
            DB::table('pos_shifts')->where('id', $shift->id)->update([
                'location_id' => $locationId,
                'open_slot' => null,
            ]);
        });

        DB::table('pos_shifts')->where('status', 'open')->whereNull('closed_at')
            ->select(['cashier_id', 'location_id'])->groupBy('cashier_id', 'location_id')->get()
            ->each(function ($group) {
                $openIds = DB::table('pos_shifts')->where('cashier_id', $group->cashier_id)
                    ->where('location_id', $group->location_id)->where('status', 'open')->whereNull('closed_at')
                    ->orderByDesc('opened_at')->orderByDesc('id')->pluck('id');
                $currentId = $openIds->shift();
                if ($currentId) {
                    DB::table('pos_shifts')->where('id', $currentId)->update(['open_slot' => 1]);
                }
                if ($openIds->isNotEmpty()) {
                    DB::table('pos_shifts')->whereIn('id', $openIds)->update([
                        'status' => 'closed',
                        'closed_at' => now(),
                        'closing_notes' => 'Automatically closed while enforcing the one-open-shift invariant.',
                    ]);
                }
            });

        Schema::table('pos_shifts', function (Blueprint $table) {
            $table->unique(['cashier_id', 'location_id', 'open_slot'], 'pos_shifts_one_open_per_cashier_location');
            $table->index(['location_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('pos_shifts', function (Blueprint $table) {
            $table->dropUnique('pos_shifts_one_open_per_cashier_location');
            $table->dropIndex(['location_id', 'status']);
            $table->dropConstrainedForeignId('closed_by_user_id');
            $table->dropConstrainedForeignId('location_id');
            $table->dropColumn(['open_slot', 'cash_received_total', 'change_given_total', 'net_cash_sales', 'card_sales_total', 'mobile_sales_total', 'sale_count', 'opening_notes']);
        });
    }
};
