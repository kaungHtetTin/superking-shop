<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use App\Models\Coupon;
use App\Models\Location;
use App\Models\FinancialEntry;
use App\Services\OperationsReportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use App\Support\Spa;

class ReportController extends Controller
{
    public function index(Request $request, OperationsReportService $operations)
    {
        $user = $request->user();
        $view = $request->string('view')->toString();
        if (! $view) {
            $view = $user->hasAdminPermission('view_reports') || $user->hasAdminPermission('reports.sales') ? 'sales' : 'inventory';
        }
        $this->authorizeView($user, $view);
        $filters = $request->validate([
            'view' => ['nullable', 'string', 'in:sales,inventory,pos,health'],
            'location_id' => ['nullable', 'integer', 'exists:locations,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'q' => ['nullable', 'string', 'max:120'],
            'stock_status' => ['nullable', 'string', 'in:low,out'],
        ]);
        $accessibleLocationIds = array_map('intval', $user->accessibleLocationIds());
        $requestedLocationId = (int) ($filters['location_id'] ?? 0);
        abort_if($requestedLocationId && ! in_array($requestedLocationId, $accessibleLocationIds, true), 403);
        $locationIds = $requestedLocationId ? [$requestedLocationId] : $accessibleLocationIds;
        $from = ! empty($filters['from']) ? \Illuminate\Support\Carbon::parse($filters['from'])->startOfDay() : null;
        $to = ! empty($filters['to']) ? \Illuminate\Support\Carbon::parse($filters['to'])->endOfDay() : null;
        $paidOrders = Order::query()
            ->recognizedSale()
            ->whereIn('location_id', $locationIds)
            ->when($from, fn ($query) => $query->where('created_at', '>=', $from))
            ->when($to, fn ($query) => $query->where('created_at', '<=', $to));
        $paidOrderCount = (clone $paidOrders)->count();
        $paidRevenue = (float) (clone $paidOrders)->sum('final_amount');
        $grossSales = (float) (clone $paidOrders)->sum('total_amount');
        $discounts = (float) (clone $paidOrders)->sum('discount_amount');
        $costOfGoods = (float) OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereIn('orders.id', \App\Models\Order::query()->recognizedSale()->select('orders.id'))
            ->whereIn('orders.location_id', $locationIds)
            ->when($from, fn ($query) => $query->where('orders.created_at', '>=', $from))
            ->when($to, fn ($query) => $query->where('orders.created_at', '<=', $to))
            ->selectRaw('COALESCE(SUM((order_items.cost_price * order_items.quantity) + order_items.foc_cost_price), 0) as total_cost')
            ->value('total_cost');
        $grossProfit = round($paidRevenue - $costOfGoods, 2);
        $financeEntries = FinancialEntry::query()->external()
            ->where('status', 'approved')
            ->when($requestedLocationId, fn ($query) => $query->where('location_id', $requestedLocationId))
            ->when(! $requestedLocationId, function ($query) use ($locationIds, $user) {
                $query->where(function ($locations) use ($locationIds, $user) {
                    $locations->whereIn('location_id', $locationIds);
                    if ($user->isSuperAdmin()) {
                        $locations->orWhereNull('location_id');
                    }
                });
            })
            ->when($from, fn ($query) => $query->where('entry_date', '>=', $from->toDateString()))
            ->when($to, fn ($query) => $query->where('entry_date', '<=', $to->toDateString()));
        $manualIncome = (float) (clone $financeEntries)->where('type', 'income')->where('category', '!=', FinancialEntry::CATEGORY_POS_SALE)->sum('amount');
        $expenses = (float) (clone $financeEntries)->where('type', 'expense')->whereNotIn('category', [FinancialEntry::CATEGORY_STOCK_RECEIPT, FinancialEntry::CATEGORY_REFUND_PAYABLE])->sum('amount');
        $stockExpenses = (float) (clone $financeEntries)->where('type', 'expense')->where('category', FinancialEntry::CATEGORY_STOCK_RECEIPT)->sum('amount');
        $paidCustomerCount = (clone $paidOrders)->distinct('user_id')->count('user_id');
        $unitsSold = (float) OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereIn('orders.id', \App\Models\Order::query()->recognizedSale()->select('orders.id'))
            ->whereIn('orders.location_id', $locationIds)
            ->when($from, fn ($query) => $query->where('orders.created_at', '>=', $from))
            ->when($to, fn ($query) => $query->where('orders.created_at', '<=', $to))
            ->sum('order_items.base_quantity');
        $repeatCustomerCount = DB::query()
            ->fromSub(
                Order::query()
                    ->recognizedSale()
                    ->whereNotNull('user_id')
                    ->whereIn('location_id', $locationIds)
                    ->when($from, fn ($query) => $query->where('created_at', '>=', $from))
                    ->when($to, fn ($query) => $query->where('created_at', '<=', $to))
                    ->select('user_id')
                    ->groupBy('user_id')
                    ->havingRaw('COUNT(*) > 1'),
                'repeat_customers'
            )
            ->count();

        $topProducts = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->whereIn('orders.id', \App\Models\Order::query()->recognizedSale()->select('orders.id'))
            ->whereIn('orders.location_id', $locationIds)
            ->when($from, fn ($query) => $query->where('orders.created_at', '>=', $from))
            ->when($to, fn ($query) => $query->where('orders.created_at', '<=', $to))
            ->groupBy('products.id', 'products.name')
            ->orderByDesc(DB::raw('SUM(order_items.base_quantity)'))
            ->limit(10)
            ->get([
                'products.id',
                'products.name',
                DB::raw('SUM(order_items.base_quantity) as units'),
                DB::raw('SUM(order_items.total_price) as revenue'),
            ]);

        $salesByDay = Order::query()
            ->recognizedSale()
            ->whereIn('location_id', $locationIds)
            ->where('created_at', '>=', $from ?? now()->subDays(30)->startOfDay())
            ->when($to, fn ($query) => $query->where('created_at', '<=', $to))
            ->selectRaw('DATE(created_at) as day, COUNT(*) as orders, SUM(final_amount) as revenue')
            ->groupBy('day')
            ->orderBy('day')
            ->get();

        $categoryPerformance = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->join('categories', 'categories.id', '=', 'products.category_id')
            ->whereIn('orders.id', \App\Models\Order::query()->recognizedSale()->select('orders.id'))
            ->whereIn('orders.location_id', $locationIds)
            ->when($from, fn ($query) => $query->where('orders.created_at', '>=', $from))
            ->when($to, fn ($query) => $query->where('orders.created_at', '<=', $to))
            ->groupBy('categories.id', 'categories.name')
            ->orderByDesc(DB::raw('SUM(order_items.total_price)'))
            ->limit(8)
            ->get([
                'categories.id',
                'categories.name',
                DB::raw('COUNT(DISTINCT orders.id) as orders'),
                DB::raw('COUNT(DISTINCT products.id) as products'),
                DB::raw('SUM(order_items.base_quantity) as units'),
                DB::raw('SUM(order_items.total_price) as revenue'),
            ]);

        $purchaseSegments = DB::query()
            ->fromSub(
                OrderItem::query()
                    ->join('orders', 'orders.id', '=', 'order_items.order_id')
                    ->whereIn('orders.id', \App\Models\Order::query()->recognizedSale()->select('orders.id'))
                    ->whereIn('orders.location_id', $locationIds)
                    ->when($from, fn ($query) => $query->where('orders.created_at', '>=', $from))
                    ->when($to, fn ($query) => $query->where('orders.created_at', '<=', $to))
                    ->groupBy('order_items.order_id')
                    ->selectRaw('order_items.order_id, SUM(order_items.quantity) as units, SUM(order_items.total_price) as revenue'),
                'baskets'
            )
            ->selectRaw("
                CASE
                    WHEN units = 1 THEN 'Single item'
                    WHEN units BETWEEN 2 AND 3 THEN 'Small bundle'
                    ELSE 'Large basket'
                END as segment,
                COUNT(*) as orders,
                SUM(units) as units,
                SUM(revenue) as revenue
            ")
            ->groupBy('segment')
            ->orderByDesc('orders')
            ->get();

        $productPairs = DB::table('order_items as first_items')
            ->join('order_items as second_items', function ($join) {
                $join->on('first_items.order_id', '=', 'second_items.order_id')
                    ->whereColumn('first_items.product_id', '<', 'second_items.product_id');
            })
            ->join('orders', 'orders.id', '=', 'first_items.order_id')
            ->join('products as first_products', 'first_products.id', '=', 'first_items.product_id')
            ->join('products as second_products', 'second_products.id', '=', 'second_items.product_id')
            ->whereIn('orders.id', \App\Models\Order::query()->recognizedSale()->select('orders.id'))
            ->whereIn('orders.location_id', $locationIds)
            ->when($from, fn ($query) => $query->where('orders.created_at', '>=', $from))
            ->when($to, fn ($query) => $query->where('orders.created_at', '<=', $to))
            ->groupBy('first_products.id', 'first_products.name', 'second_products.id', 'second_products.name')
            ->orderByDesc(DB::raw('COUNT(DISTINCT orders.id)'))
            ->limit(6)
            ->get([
                DB::raw("CONCAT(first_products.name, ' + ', second_products.name) as pair"),
                DB::raw('COUNT(DISTINCT orders.id) as orders'),
                DB::raw('SUM(first_items.base_quantity + second_items.base_quantity) as units'),
            ]);

        $couponPerformance = Coupon::query()
            ->leftJoin('orders', function ($join) use ($locationIds, $from, $to) {
                $join->on('orders.coupon_id', '=', 'coupons.id')
                    ->whereIn('orders.id', Order::query()->recognizedSale()->select('orders.id'));
                $join->whereIn('orders.location_id', $locationIds);
                if ($from) {
                    $join->where('orders.created_at', '>=', $from);
                }
                if ($to) {
                    $join->where('orders.created_at', '<=', $to);
                }
            })
            ->groupBy('coupons.id', 'coupons.code', 'coupons.type', 'coupons.value')
            ->orderByDesc(DB::raw('COUNT(orders.id)'))
            ->limit(8)
            ->get([
                'coupons.id',
                'coupons.code',
                'coupons.type',
                'coupons.value',
                DB::raw('COUNT(orders.id) as paid_orders'),
                DB::raw('COALESCE(SUM(orders.discount_amount), 0) as discount_given'),
                DB::raw('COALESCE(SUM(orders.final_amount), 0) as revenue'),
            ]);

        $flashSalePerformance = $requestedLocationId ? collect() : DB::table('flash_sales')
            ->leftJoin('flash_sale_items', 'flash_sale_items.flash_sale_id', '=', 'flash_sales.id')
            ->leftJoin('product_units', 'product_units.id', '=', 'flash_sale_items.product_unit_id')
            ->leftJoin('product_unit_prices', function ($join) {
                $join->on('product_unit_prices.product_unit_id', '=', 'product_units.id');
            })
            ->leftJoin('product_price_types', function ($join) {
                $join->on('product_price_types.id', '=', 'product_unit_prices.product_price_type_id')
                    ->where('product_price_types.name', '=', 'retail');
            })
            ->where(fn ($query) => $query->whereNull('product_unit_prices.id')->orWhereNotNull('product_price_types.id'))
            ->groupBy('flash_sales.id', 'flash_sales.name', 'flash_sales.starts_at', 'flash_sales.ends_at', 'flash_sales.is_active')
            ->orderByDesc(DB::raw('COALESCE(SUM(flash_sale_items.sold_count), 0)'))
            ->limit(8)
            ->get([
                'flash_sales.id',
                'flash_sales.name',
                'flash_sales.starts_at',
                'flash_sales.ends_at',
                'flash_sales.is_active',
                DB::raw('COUNT(flash_sale_items.id) as items'),
                DB::raw('COALESCE(SUM(flash_sale_items.sold_count), 0) as units_sold'),
                DB::raw("
                    COALESCE(SUM(
                        flash_sale_items.sold_count *
                        CASE
                            WHEN flash_sale_items.discount_type = 'percentage'
                                THEN product_unit_prices.price * (1 - (flash_sale_items.discount_value / 100))
                            ELSE flash_sale_items.discount_value
                        END
                    ), 0) as estimated_revenue
                "),
            ]);

        return Spa::render('Admin/Reports/Index', [
            'view' => $view,
            'filters' => $filters,
            'locations' => Location::query()
                ->whereIn('id', $user->accessibleLocationIds())
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'code', 'name', 'type']),
            'canViewSales' => $user->hasAdminPermission('view_reports') || $user->hasAdminPermission('reports.sales'),
            'canViewInventory' => $user->hasAdminPermission('view_reports') || $user->hasAdminPermission('reports.inventory'),
            'inventoryReport' => $view === 'inventory' ? $operations->inventory($user, $filters) : null,
            'posReport' => $view === 'pos' ? $operations->pos($user, $filters) : null,
            'healthReport' => $view === 'health' ? $operations->health($user) : null,
            'summary' => [
                'paid_orders' => (clone $paidOrders)->where('payment_status', 'paid')->count(),
                'recognized_orders' => $paidOrderCount,
                'unvalued_adjustment_lines' => \App\Services\FinancialIntegrityService::unvaluedAdjustmentLines($locationIds, $from, $to),
                'revenue' => $paidRevenue,
                'customers' => (clone $paidOrders)->whereNotNull('user_id')->distinct('user_id')->count('user_id'),
                'products' => DB::table('inventory_balances')->whereIn('location_id', $locationIds)->where('on_hand_qty', '>', 0)->distinct('product_id')->count('product_id'),
                'average_order_value' => $paidOrderCount > 0 ? round($paidRevenue / $paidOrderCount, 2) : 0,
                'units_sold' => $unitsSold,
                'units_per_order' => $paidOrderCount > 0 ? round($unitsSold / $paidOrderCount, 2) : 0,
                'repeat_customer_rate' => $paidCustomerCount > 0 ? round(($repeatCustomerCount / $paidCustomerCount) * 100, 1) : 0,
                'discount_rate' => $grossSales > 0 ? round(($discounts / $grossSales) * 100, 1) : 0,
                'cost_of_goods' => round($costOfGoods, 2),
                'gross_profit' => $grossProfit,
                'gross_margin' => $paidRevenue > 0 ? round(($grossProfit / $paidRevenue) * 100, 1) : 0,
                'manual_income' => $manualIncome,
                'expenses' => $expenses,
                'stock_expenses' => $stockExpenses,
                'net_profit' => round($paidRevenue + $manualIncome - $costOfGoods - $expenses, 2),
            ],
            'topProducts' => $topProducts,
            'salesByDay' => $salesByDay,
            'categoryPerformance' => $categoryPerformance,
            'purchaseSegments' => $purchaseSegments,
            'productPairs' => $productPairs,
            'couponPerformance' => $couponPerformance,
            'flashSalePerformance' => $flashSalePerformance,
        ]);
    }

    public function export(Request $request, OperationsReportService $operations)
    {
        $view = $request->string('view')->toString();
        if (! in_array($view, ['sales', 'inventory', 'pos'], true)) {
            throw ValidationException::withMessages(['view' => 'Choose sales, inventory, or POS for CSV export.']);
        }

        $this->authorizeView($request->user(), $view);
        $filters = $request->validate([
            'view' => ['required', 'string', 'in:sales,inventory,pos'],
            'location_id' => ['nullable', 'integer', 'exists:locations,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'q' => ['nullable', 'string', 'max:120'],
            'stock_status' => ['nullable', 'string', 'in:low,out'],
        ]);

        $accessibleIds = array_map('intval', $request->user()->accessibleLocationIds());
        $locationId = (int) ($filters['location_id'] ?? 0);
        abort_if($locationId && ! in_array($locationId, $accessibleIds, true), 403);
        $locationIds = $locationId ? [$locationId] : $accessibleIds;

        $filename = $view.'-report-'.now()->format('Ymd-His').'.csv';
        if ($view === 'sales') {
            $from = ! empty($filters['from']) ? \Illuminate\Support\Carbon::parse($filters['from'])->startOfDay() : null;
            $to = ! empty($filters['to']) ? \Illuminate\Support\Carbon::parse($filters['to'])->endOfDay() : null;
            $orders = Order::query()->with(['location:id,code,name', 'user:id,name,email,phone'])->withCount('items')
                ->recognizedSale()->whereIn('location_id', $locationIds)
                ->when($from, fn ($query) => $query->where('created_at', '>=', $from))
                ->when($to, fn ($query) => $query->where('created_at', '<=', $to));

            return response()->streamDownload(function () use ($orders) {
                $output = fopen('php://output', 'w');
                fwrite($output, "\xEF\xBB\xBF");
                fputcsv($output, ['Date', 'Store', 'Order number', 'Channel', 'Customer', 'Items', 'Gross sales', 'Discount', 'Shipping', 'Revenue', 'COGS', 'Gross profit']);
                $orders->orderBy('id')->chunkById(500, function ($rows) use ($output) {
                    $costs = OrderItem::query()->whereIn('order_id', $rows->pluck('id'))
                        ->selectRaw('order_id, COALESCE(SUM((cost_price * quantity) + foc_cost_price), 0) as cost')
                        ->groupBy('order_id')->pluck('cost', 'order_id');
                    foreach ($rows as $order) {
                        $cost = (float) ($costs[$order->id] ?? 0);
                        fputcsv($output, [$order->created_at?->format('Y-m-d H:i:s'), $order->location?->name, $order->order_number, $order->sales_channel, $order->user?->name, $order->items_count, $order->total_amount, $order->discount_amount, $order->shipping_fee, $order->final_amount, $cost, round((float) $order->final_amount - $cost, 2)]);
                    }
                });
                fclose($output);
            }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
        }

        $report = $view === 'inventory'
            ? $operations->inventory($request->user(), $filters)
            : $operations->pos($request->user(), $filters);

        return response()->streamDownload(function () use ($view, $report) {
            $output = fopen('php://output', 'w');
            fwrite($output, "\xEF\xBB\xBF");
            if ($view === 'inventory') {
                fputcsv($output, ['Warehouse', 'Product', 'Product code', 'On hand (base)', 'Reserved (base)', 'Available (base)', 'Minimum quantity', 'Cost value', 'Default retail price']);
                foreach ($report['stock_rows'] as $row) {
                    fputcsv($output, [
                        $row->location_name, $row->product_name, $row->product_code, $row->on_hand_qty,
                        $row->reserved_qty, $row->available_qty, $row->min_quantity, $row->cost_value, $row->retail_price,
                    ]);
                }
            } else {
                fputcsv($output, ['Tender type', 'Payments', 'Amount']);
                foreach ($report['tenders'] as $row) {
                    fputcsv($output, [
                        $row->tender_type, $row->payments, $row->amount,
                    ]);
                }
            }
            fclose($output);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    private function authorizeView(User $user, string $view): void
    {
        $allowed = match ($view) {
            'sales', 'pos' => $user->hasAdminPermission('view_reports') || $user->hasAdminPermission('reports.sales'),
            'inventory', 'health' => $user->hasAdminPermission('view_reports') || $user->hasAdminPermission('reports.inventory'),
            default => false,
        };

        abort_unless($allowed, 403, 'You do not have permission to view this report.');
    }
}
