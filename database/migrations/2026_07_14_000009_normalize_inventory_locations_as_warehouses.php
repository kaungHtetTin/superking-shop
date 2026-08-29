<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('locations')) {
            return;
        }

        DB::table('locations')->update(['type' => 'warehouse']);

        $mainWarehouseId = DB::table('locations')->where('code', 'MAIN-WH')->value('id');
        if (! $mainWarehouseId) {
            return;
        }
        $mainStoreId = DB::table('locations')->where('code', 'MAIN-STORE')->value('id');

        DB::table('locations')->update(['is_default_fulfillment' => false]);
        DB::table('locations')->where('id', $mainWarehouseId)->update(['is_default_fulfillment' => true]);

        if (Schema::hasTable('location_user')) {
            DB::table('location_user')->update(['is_default' => false]);
            DB::table('location_user')->where('location_id', $mainWarehouseId)->update(['is_default' => true]);
        }

        if ($mainStoreId && Schema::hasTable('inventory_balances')) {
            $warehouseProductIds = DB::table('inventory_balances')
                ->where('location_id', $mainWarehouseId)
                ->pluck('product_id')
                ->all();

            DB::table('inventory_balances')
                ->where('location_id', $mainStoreId)
                ->where('on_hand_qty', 0)
                ->where('reserved_qty', 0)
                ->when($warehouseProductIds, fn ($query) => $query->whereNotIn('product_id', $warehouseProductIds))
                ->update(['location_id' => $mainWarehouseId]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('locations')) {
            return;
        }

        DB::table('locations')->where('code', 'MAIN-WH')->update(['type' => 'warehouse', 'is_default_fulfillment' => false]);
        DB::table('locations')->where('code', 'MAIN-STORE')->update(['type' => 'store', 'is_default_fulfillment' => true]);

        $mainStoreId = DB::table('locations')->where('code', 'MAIN-STORE')->value('id');
        if ($mainStoreId && Schema::hasTable('location_user')) {
            DB::table('location_user')->update(['is_default' => false]);
            DB::table('location_user')->where('location_id', $mainStoreId)->update(['is_default' => true]);
        }
    }
};
