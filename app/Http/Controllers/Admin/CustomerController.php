<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\OrderItem;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\LoyaltyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use App\Support\Spa;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query()
            ->where('role', User::CUSTOMER_ROLE)
            ->withCount('orders')
            ->withSum(['orders as paid_revenue' => fn ($q) => $q->where('payment_status', 'paid')], 'final_amount')
            ->latest();

        if ($request->filled('q')) {
            $term = '%'.trim($request->q).'%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                    ->orWhere('email', 'like', $term)
                    ->orWhere('phone', 'like', $term);
            });
        }

        if ($request->filled('tier')) {
            $query->where('tier', $request->tier);
        }

        return Spa::render('Admin/Customers/Index', [
            'customers' => $query->paginate(15)->withQueryString()->through(fn (User $customer) => [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
                'phone' => $customer->phone,
                'tier' => $customer->tier,
                'loyalty_points' => $customer->loyalty_points,
                'orders_count' => $customer->orders_count,
                'paid_revenue' => $customer->paid_revenue,
                'created_at' => $customer->created_at?->toDateString(),
            ]),
            'filters' => [
                'q' => $request->string('q')->toString(),
                'tier' => $request->string('tier')->toString(),
            ],
            'tiers' => array_keys(config('loyalty.tiers', [])),
        ]);
    }

    public function show(User $customer)
    {
        abort_unless($customer->role === User::CUSTOMER_ROLE, 404);

        $customer->loadCount(['orders', 'reviews'])
            ->loadSum(['orders as paid_revenue' => fn ($q) => $q->where('payment_status', 'paid')], 'final_amount');

        $paidOrders = $customer->orders()->where('payment_status', 'paid');
        $paidOrderCount = (clone $paidOrders)->count();
        $totalSpent = (float) (clone $paidOrders)->sum('final_amount');
        $cancelledOrders = $customer->orders()->where('status', 'cancelled')->count();
        $pendingPaymentOrders = $customer->orders()->where('payment_status', 'pending_review')->count();
        $lastOrder = $customer->orders()->latest()->first(['id', 'order_number', 'created_at']);

        $recentOrders = $customer->orders()
            ->withCount('items')
            ->latest()
            ->take(10)
            ->get();

        $topCategories = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->join('categories', 'categories.id', '=', 'products.category_id')
            ->where('orders.user_id', $customer->id)
            ->where('orders.payment_status', 'paid')
            ->groupBy('categories.id', 'categories.name')
            ->orderByDesc(DB::raw('SUM(order_items.total_price)'))
            ->limit(5)
            ->get([
                'categories.id',
                'categories.name',
                DB::raw('SUM(order_items.quantity) as units'),
                DB::raw('SUM(order_items.total_price) as revenue'),
            ]);

        $reviews = $customer->reviews()
            ->with('product:id,name,slug')
            ->latest()
            ->take(8)
            ->get();

        $rewardHistories = $customer->rewardHistories()
            ->with('order:id,order_number')
            ->latest()
            ->take(20)
            ->get();

        return Spa::render('Admin/Customers/Show', [
            'customer' => $customer,
            'stats' => [
                'orders' => $customer->orders_count,
                'paid_orders' => $paidOrderCount,
                'cancelled_orders' => $cancelledOrders,
                'pending_payment_orders' => $pendingPaymentOrders,
                'total_spent' => $totalSpent,
                'average_order_value' => $paidOrderCount > 0 ? round($totalSpent / $paidOrderCount, 2) : 0,
                'reviews' => $customer->reviews_count,
                'last_order_at' => $lastOrder?->created_at,
            ],
            'recentOrders' => $recentOrders,
            'topCategories' => $topCategories,
            'reviews' => $reviews,
            'rewardHistories' => $rewardHistories,
            'canAdjustLoyalty' => request()->user()->isSuperAdmin(),
        ]);
    }

    public function adjustLoyalty(Request $request, User $customer, LoyaltyService $loyaltyService, AuditLogService $auditLogService)
    {
        abort_unless($customer->role === User::CUSTOMER_ROLE, 404);
        abort_unless($request->user()->isSuperAdmin(), 403);

        $validated = $request->validate([
            'action' => ['required', Rule::in(['add', 'subtract'])],
            'points' => ['required', 'integer', 'min:1', 'max:100000000'],
            'description' => ['required', 'string', 'max:500'],
        ]);

        $points = (int) $validated['points'];
        $delta = $validated['action'] === 'subtract' ? -$points : $points;

        $loyaltyService->adjustPoints($customer, $delta, $validated['description'], $request->user());

        $auditLogService->record('customer.loyalty_adjusted', $customer, [
            'points' => $delta,
            'description' => $validated['description'],
        ], $request);

        return back()->with('success', 'Customer loyalty points updated.');
    }
}
