<?php

namespace App\Services;

use App\Models\InventoryStockAlert;
use App\Models\OperationsHealthCheck;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class OperationsReportService
{
    public function inventory(User $user, array $filters = []): array
    {
        $locationIds = $this->locationIds($user, $filters['location_id'] ?? null);
        $base = DB::table('inventory_balances as balances')
            ->join('locations', 'locations.id', '=', 'balances.location_id')
            ->join('products', 'products.id', '=', 'balances.product_id')
            ->leftJoin('product_units as selling_units', function ($join) {
                $join->on('selling_units.product_id', '=', 'products.id')->where('selling_units.is_default_selling', true);
            })
            ->leftJoin('product_unit_prices as retail_prices', function ($join) {
                $join->on('retail_prices.product_unit_id', '=', 'selling_units.id');
            })
            ->leftJoin('product_price_types as retail_price_types', function ($join) {
                $join->on('retail_price_types.id', '=', 'retail_prices.product_price_type_id')->where('retail_price_types.name', 'retail');
            })
            ->where(fn ($query) => $query->whereNull('retail_prices.id')->orWhereNotNull('retail_price_types.id'))
            ->whereIn('balances.location_id', $locationIds);

        $summary = (clone $base)->selectRaw('
            COALESCE(SUM(balances.on_hand_qty), 0) as on_hand,
            COALESCE(SUM(balances.reserved_qty), 0) as reserved,
            COALESCE(SUM(balances.on_hand_qty - balances.reserved_qty), 0) as available,
            COALESCE(SUM(balances.on_hand_qty * products.original_price), 0) as cost_value,
            COALESCE(SUM(balances.on_hand_qty * (COALESCE(retail_prices.price, 0) / NULLIF(selling_units.conversion_factor, 0))), 0) as retail_value,
            SUM(CASE WHEN balances.on_hand_qty - balances.reserved_qty <= 0 THEN 1 ELSE 0 END) as out_of_stock,
            SUM(CASE WHEN products.min_quantity > 0 AND balances.on_hand_qty - balances.reserved_qty > 0 AND balances.on_hand_qty - balances.reserved_qty <= products.min_quantity THEN 1 ELSE 0 END) as low_stock
        ')->first();

        $stockRows = (clone $base)
            ->when($filters['q'] ?? null, function ($query, $search) {
                $like = '%'.trim($search).'%';
                $query->where(fn ($inner) => $inner
                    ->where('products.name', 'like', $like)
                    ->orWhere('products.product_code', 'like', $like)
                    ->orWhere('products.barcode', 'like', $like));
            })
            ->when($filters['stock_status'] ?? null, function ($query, $status) {
                if ($status === 'out') {
                    $query->whereRaw('(balances.on_hand_qty - balances.reserved_qty) <= 0');
                } elseif ($status === 'low') {
                    $query->where('products.min_quantity', '>', 0)
                        ->whereRaw('(balances.on_hand_qty - balances.reserved_qty) > 0')
                        ->whereRaw('(balances.on_hand_qty - balances.reserved_qty) <= products.min_quantity');
                }
            })
            ->select([
                'balances.id', 'locations.id as location_id', 'locations.name as location_name', 'locations.code as location_code',
                'products.id as product_id', 'products.product_code', 'products.name as product_name',
                'balances.on_hand_qty', 'balances.reserved_qty', 'products.min_quantity', 'products.original_price',
                'retail_prices.price as retail_price', 'selling_units.conversion_factor as selling_conversion_factor',
            ])
            ->selectRaw('(balances.on_hand_qty - balances.reserved_qty) as available_qty')
            ->selectRaw('(balances.on_hand_qty * products.original_price) as cost_value')
            ->orderByRaw('CASE WHEN (balances.on_hand_qty - balances.reserved_qty) <= 0 THEN 0 WHEN products.min_quantity > 0 AND (balances.on_hand_qty - balances.reserved_qty) <= products.min_quantity THEN 1 ELSE 2 END')
            ->orderBy('products.name')
            ->limit(250)
            ->get();

        $movements = DB::table('inventory_movements')
            ->whereIn('location_id', $locationIds)
            ->where('occurred_at', '>=', now()->subDays(30))
            ->groupBy('type')
            ->orderByDesc(DB::raw('SUM(ABS(quantity_delta))'))
            ->get([
                'type',
                DB::raw('COUNT(*) as movements'),
                DB::raw('SUM(quantity_delta) as net_quantity'),
                DB::raw('SUM(ABS(quantity_delta)) as absolute_quantity'),
            ]);

        $adjustments = DB::table('stock_adjustment_items as items')
            ->join('stock_adjustments as adjustments', 'adjustments.id', '=', 'items.stock_adjustment_id')
            ->join('products', 'products.id', '=', 'items.product_id')
            ->whereIn('adjustments.location_id', $locationIds)
            ->whereIn('adjustments.status', ['posted', 'reversed'])
            ->groupBy('adjustments.reason_code')
            ->orderByDesc(DB::raw('SUM(ABS(items.quantity_delta))'))
            ->get([
                'adjustments.reason_code',
                DB::raw('COUNT(DISTINCT adjustments.id) as documents'),
                DB::raw('SUM(items.quantity_delta) as net_quantity'),
                DB::raw('SUM(ABS(items.quantity_delta)) as absolute_quantity'),
                DB::raw('SUM(CASE WHEN items.value_delta IS NULL AND items.quantity_delta <> 0 THEN 1 ELSE 0 END) as unvalued_lines'),
                DB::raw('SUM(CASE WHEN items.quantity_delta < 0 THEN ABS(items.value_delta) ELSE 0 END) as loss_value'),
            ]);

        $transfers = DB::table('stock_transfers as transfers')
            ->join('locations as source', 'source.id', '=', 'transfers.source_location_id')
            ->join('locations as destination', 'destination.id', '=', 'transfers.destination_location_id')
            ->join('stock_transfer_items as items', 'items.stock_transfer_id', '=', 'transfers.id')
            ->where(fn ($query) => $query->whereIn('transfers.source_location_id', $locationIds)->orWhereIn('transfers.destination_location_id', $locationIds))
            ->where('transfers.created_at', '>=', now()->subDays(30))
            ->groupBy('transfers.id', 'transfers.transfer_number', 'source.name', 'destination.name', 'transfers.total_amount', 'transfers.created_at')
            ->orderByDesc('transfers.created_at')
            ->limit(50)
            ->get([
                'transfers.id', 'transfers.transfer_number', 'source.name as source_name', 'destination.name as destination_name', 'transfers.total_amount', 'transfers.created_at',
                DB::raw('SUM(COALESCE(items.requested_base_quantity, 0)) as moved_quantity'),
            ]);

        $sales = DB::table('order_items as items')
            ->join('orders', 'orders.id', '=', 'items.order_id')
            ->whereIn('orders.id', \App\Models\Order::query()->recognizedSale()->select('orders.id'))
            ->whereIn('orders.location_id', $locationIds)
            ->where('orders.created_at', '>=', now()->subDays(30))
            ->groupBy('items.product_id')
            ->selectRaw('items.product_id, SUM(items.base_quantity + items.foc_base_quantity) as units_sold');
        $stock = DB::table('inventory_balances')
            ->whereIn('location_id', $locationIds)
            ->groupBy('product_id')
            ->selectRaw('product_id, SUM(on_hand_qty) as on_hand_qty');
        $sellThrough = DB::query()
            ->fromSub($sales, 'sales')
            ->join('products', 'products.id', '=', 'sales.product_id')
            ->leftJoinSub($stock, 'stock', 'stock.product_id', '=', 'sales.product_id')
            ->select(['products.id', 'products.product_code', 'products.name as product_name', 'sales.units_sold', 'stock.on_hand_qty'])
            ->selectRaw('ROUND((sales.units_sold / NULLIF(sales.units_sold + COALESCE(stock.on_hand_qty, 0), 0)) * 100, 1) as sell_through_rate')
            ->orderByDesc('sell_through_rate')
            ->limit(25)
            ->get();

        $unitsByProduct = DB::table('product_units')
            ->whereIn('product_id', $stockRows->pluck('product_id')->merge($sellThrough->pluck('id'))->unique())
            ->where('is_active', true)
            ->orderByDesc('conversion_factor')
            ->get(['id', 'product_id', 'name', 'code', 'conversion_factor', 'is_base', 'is_default_selling', 'is_active'])
            ->groupBy('product_id');
        $stockRows->each(fn ($row) => $row->units = $unitsByProduct->get($row->product_id, collect())->values());
        $sellThrough->each(fn ($row) => $row->units = $unitsByProduct->get($row->id, collect())->values());

        return [
            'summary' => $summary,
            'stock_rows' => $stockRows,
            'movements' => $movements,
            'adjustments' => $adjustments,
            'transfers' => $transfers,
            'sell_through' => $sellThrough,
        ];
    }

    public function pos(User $user, array $filters = []): array
    {
        [$from, $to] = $this->dateRange($filters);
        $locationIds = $this->locationIds($user, $filters['location_id'] ?? null);
        $ownOnly = $user->adminRoleName() === 'staff';
        $orders = DB::table('orders')
            ->where('orders.sales_channel', 'pos')
            ->whereIn('orders.id', \App\Models\Order::query()->recognizedSale()->select('orders.id'))
            ->whereIn('orders.location_id', $locationIds)
            ->whereBetween('orders.created_at', [$from, $to])
            ->when($ownOnly, fn ($query) => $query->where('orders.served_by', $user->id));

        $summary = (clone $orders)->selectRaw('
            COUNT(*) as orders,
            COALESCE(SUM(final_amount), 0) as revenue,
            COALESCE(SUM(discount_amount), 0) as discounts,
            COALESCE(AVG(final_amount), 0) as average_sale
        ')->first();

        $byLocation = (clone $orders)
            ->join('locations', 'locations.id', '=', 'orders.location_id')
            ->groupBy('locations.id', 'locations.name')
            ->orderByDesc(DB::raw('SUM(orders.final_amount)'))
            ->get(['locations.id', 'locations.name', DB::raw('COUNT(*) as orders'), DB::raw('SUM(orders.final_amount) as revenue')]);
        $byRegister = (clone $orders)
            ->leftJoin('pos_registers', 'pos_registers.id', '=', 'orders.register_id')
            ->groupBy('pos_registers.id', 'pos_registers.name', 'pos_registers.code')
            ->orderByDesc(DB::raw('SUM(orders.final_amount)'))
            ->get([
                DB::raw('pos_registers.id as id'),
                DB::raw("COALESCE(pos_registers.name, 'Warehouse sale') as name"),
                DB::raw("COALESCE(pos_registers.code, 'DIRECT') as code"),
                DB::raw('COUNT(*) as orders'),
                DB::raw('SUM(orders.final_amount) as revenue'),
            ]);
        $byCashier = (clone $orders)
            ->join('users', 'users.id', '=', 'orders.served_by')
            ->groupBy('users.id', 'users.name')
            ->orderByDesc(DB::raw('SUM(orders.final_amount)'))
            ->get(['users.id', 'users.name', DB::raw('COUNT(*) as orders'), DB::raw('SUM(orders.final_amount) as revenue')]);
        $tenders = DB::table('payments')
            ->join('orders', 'orders.id', '=', 'payments.order_id')
            ->where('orders.sales_channel', 'pos')
            ->where('payments.status', 'paid')
            ->whereIn('orders.location_id', $locationIds)
            ->whereBetween('payments.created_at', [$from, $to])
            ->when($ownOnly, fn ($query) => $query->where('payments.received_by', $user->id))
            ->groupBy('payments.tender_type')
            ->orderByDesc(DB::raw('SUM(payments.amount)'))
            ->get(['payments.tender_type', DB::raw('COUNT(*) as payments'), DB::raw('SUM(payments.amount) as amount')]);
        return [
            'summary' => $summary,
            'by_location' => $byLocation,
            'by_register' => $byRegister,
            'by_cashier' => $byCashier,
            'tenders' => $tenders,
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'own_only' => $ownOnly,
        ];
    }

    public function health(User $user): array
    {
        $latestIds = OperationsHealthCheck::query()
            ->selectRaw('MAX(id)')
            ->groupBy('check_name');
        $checks = OperationsHealthCheck::query()
            ->whereIn('id', $latestIds)
            ->orderBy('check_name')
            ->get();
        $alerts = InventoryStockAlert::query()
            ->with(['location:id,name,code', 'product:id,name,product_code', 'product.units:id,product_id,name,code,conversion_factor,is_base,is_default_selling,is_active'])
            ->where('status', 'open')
            ->whereIn('location_id', $user->accessibleLocationIds())
            ->orderByRaw("FIELD(type, 'out_of_stock', 'low_stock')")
            ->orderBy('detected_at')
            ->limit(100)
            ->get();

        return [
            'checks' => $checks,
            'alerts' => $alerts,
            'summary' => [
                'healthy' => $checks->where('status', 'healthy')->count(),
                'warnings' => $checks->where('status', 'warning')->count(),
                'failed' => $checks->where('status', 'failed')->count(),
                'open_alerts' => $alerts->count(),
                'failed_jobs' => Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->count() : 0,
            ],
        ];
    }

    private function locationIds(User $user, $requestedLocationId = null): array
    {
        $accessible = array_map('intval', $user->accessibleLocationIds());
        $requested = (int) $requestedLocationId;

        return $requested && in_array($requested, $accessible, true) ? [$requested] : $accessible;
    }

    /** @return array{0:Carbon,1:Carbon} */
    private function dateRange(array $filters): array
    {
        $from = isset($filters['from']) ? Carbon::parse($filters['from'])->startOfDay() : now()->subDays(29)->startOfDay();
        $to = isset($filters['to']) ? Carbon::parse($filters['to'])->endOfDay() : now()->endOfDay();

        return [$from, $to];
    }
}
