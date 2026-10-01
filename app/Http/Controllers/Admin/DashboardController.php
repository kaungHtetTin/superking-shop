<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\InventoryBalance;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use App\Services\OrderManagementService;
use App\Support\Spa;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request, OrderManagementService $orderManagementService)
    {
        $locationIds = $request->user()->accessibleLocationIds();
        $locationId = $request->integer('location_id');
        abort_if($locationId && ! in_array($locationId, array_map('intval', $locationIds), true), 403);
        $locations = \App\Models\Location::whereIn('id', $locationIds)->orderBy('name')->get(['id', 'name', 'code']);
        if ($locationId) {
            $locationIds = [$locationId];
        }
        $stats = $orderManagementService->stats($locationIds);
        $monthStart = now()->startOfMonth();

        $salesByDay = Order::query()
            ->whereIn('location_id', $locationIds)
            ->selectRaw('DATE(created_at) as day, COUNT(*) as orders, COALESCE(SUM(final_amount), 0) as revenue')
            ->where('payment_status', 'paid')
            ->where('created_at', '>=', $monthStart)
            ->groupBy('day')
            ->orderBy('day')
            ->get()
            ->keyBy('day');

        $salesTrend = collect(range(1, now()->day))->map(function (int $dayOfMonth) use ($salesByDay) {
            $day = now()->startOfMonth()->addDays($dayOfMonth - 1)->toDateString();
            $row = $salesByDay->get($day);

            return [
                'day' => $day,
                'orders' => (int) ($row->orders ?? 0),
                'revenue' => (float) ($row->revenue ?? 0),
            ];
        })->values();

        $lowStockBase = InventoryBalance::query()
            ->whereIn('location_id', $locationIds)
            ->where(function ($query) {
                $query
                    ->whereHas('product', fn ($product) => $product->whereRaw('(inventory_balances.on_hand_qty - inventory_balances.reserved_qty) <= products.min_quantity'))
                    ->orWhereRaw('(on_hand_qty - reserved_qty) <= 0');
            });

        $lowStockCount = (clone $lowStockBase)->count();

        $lowStockItems = (clone $lowStockBase)
            ->with(['product:id,name,product_code,min_quantity', 'product.units:id,product_id,name,code,conversion_factor,is_base,is_default_selling,is_active', 'location:id,name'])
            ->orderByRaw('(on_hand_qty - reserved_qty) asc')
            ->limit(5)
            ->get()
            ->map(fn (InventoryBalance $balance) => [
                'product_id' => $balance->product_id,
                'product_code' => $balance->product?->product_code,
                'name' => $balance->product?->name ?: 'Unknown item',
                'location' => $balance->location?->name,
                'available' => $balance->available_qty,
                'min_quantity' => $balance->product?->min_quantity,
                'units' => $balance->product?->units?->values(),
            ]);

        $topProducts = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->leftJoin('products', 'products.id', '=', 'order_items.product_id')
            ->where('orders.payment_status', 'paid')
            ->whereIn('orders.location_id', $locationIds)
            ->where('orders.created_at', '>=', $monthStart)
            ->selectRaw(
                'COALESCE(products.name, ?) as name, SUM(order_items.quantity) as units, COALESCE(SUM(order_items.total_price), 0) as revenue',
                ['Deleted product']
            )
            ->groupBy('products.id', 'products.name')
            ->orderByDesc('revenue')
            ->limit(5)
            ->get()
            ->map(fn ($row) => [
                'name' => $row->name,
                'units' => (int) $row->units,
                'revenue' => (float) $row->revenue,
            ]);

        $recentOrders = Order::query()
            ->whereIn('location_id', $locationIds)
            ->with(['user:id,name,email', 'items'])
            ->withCount('items')
            ->latest()
            ->limit(6)
            ->get();

        return Spa::render('Admin/Dashboard', [
            'locations' => $locations,
            'filters' => ['location_id' => $locationId ?: null],
            'stats' => $stats,
            'recentOrders' => $recentOrders,
            'productCount' => Product::count(),
            'customerCount' => User::where('role', 'customer')->count(),
            'dashboard' => [
                'salesTrend' => $salesTrend,
                'topProducts' => $topProducts,
                'lowStockCount' => $lowStockCount,
                'lowStockItems' => $lowStockItems,
                'todayRevenue' => (float) Order::where('payment_status', 'paid')
                    ->whereIn('location_id', $locationIds)
                    ->whereDate('created_at', today())
                    ->sum('final_amount'),
                'todayOrders' => Order::whereIn('location_id', $locationIds)->whereDate('created_at', today())->count(),
                'monthRevenue' => (float) Order::where('payment_status', 'paid')
                    ->whereIn('location_id', $locationIds)
                    ->where('created_at', '>=', $monthStart)
                    ->sum('final_amount'),
                'activeProducts' => Product::where('status', 'active')->count(),
                'draftProducts' => Product::where('status', 'draft')->count(),
            ],
        ]);
    }

    public function uiShowcase()
    {
        return Spa::render('Admin/UiShowcase');
    }
}
