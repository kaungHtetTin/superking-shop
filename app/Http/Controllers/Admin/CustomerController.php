<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\OrderItem;
use App\Models\Order;
use App\Models\Payment;
use App\Models\FinancialEntry;
use App\Models\PosShift;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\CustomerCreditService;
use App\Services\CreditStatementService;
use App\Services\LoyaltyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Str;
use App\Support\Spa;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query()
            ->where('role', User::CUSTOMER_ROLE)
            ->withCount('orders')
            ->withSum(['orders as paid_revenue' => fn ($q) => $q->where('payment_status', 'paid')], 'final_amount')
            ->withSum('creditTransactions as credit_balance', 'amount')
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
        if ($request->filled('credit_status')) {
            $query->where('credit_status', $request->string('credit_status')->toString());
        }
        if ($request->string('credit')->toString() === 'outstanding') {
            $query->whereHas('creditTransactions')
                ->whereRaw('(select coalesce(sum(amount), 0) from customer_credit_transactions where customer_id = users.id) > 0');
        }
        if ($request->string('credit')->toString() === 'overdue') {
            $query->whereHas('orders', fn ($orders) => $orders
                ->where('credit_due_date', '<', now()->toDateString())
                ->whereIn('payment_status', ['unpaid', 'partially_paid']));
        }

        $creditStats = [
            'outstanding' => (float) \App\Models\CustomerCreditTransaction::sum('amount'),
            'overdue' => (float) Order::query()
                ->where('credit_due_date', '<', now()->toDateString())
                ->whereIn('payment_status', ['unpaid', 'partially_paid'])
                ->selectRaw('coalesce(sum(final_amount - paid_amount), 0) as total')
                ->value('total'),
            'active_accounts' => User::where('role', User::CUSTOMER_ROLE)->where('credit_status', 'active')->count(),
            'suspended_accounts' => User::where('role', User::CUSTOMER_ROLE)->where('credit_status', 'suspended')->count(),
        ];

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
                'credit_balance' => max(0, (float) ($customer->credit_balance ?? 0)),
                'credit_limit' => (float) $customer->credit_limit,
                'credit_status' => $customer->credit_status,
                'created_at' => $customer->created_at?->toDateString(),
            ]),
            'filters' => [
                'q' => $request->string('q')->toString(),
                'tier' => $request->string('tier')->toString(),
                'credit_status' => $request->string('credit_status')->toString(),
                'credit' => $request->string('credit')->toString(),
            ],
            'tiers' => array_keys(config('loyalty.tiers', [])),
            'creditStats' => $creditStats,
        ]);
    }

    public function show(User $customer, CustomerCreditService $creditService)
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

        $creditTransactions = $customer->creditTransactions()
            ->with(['order:id,order_number,receipt_number', 'creator:id,name'])
            ->latest()
            ->take(50)
            ->get();
        $creditOrders = $customer->orders()
            ->where('credit_amount', '>', 0)
            ->whereIn('payment_status', ['unpaid', 'partially_paid'])
            ->orderBy('credit_due_date')
            ->get(['id', 'order_number', 'receipt_number', 'final_amount', 'paid_amount', 'credit_due_date', 'payment_status']);
        $creditBalance = $creditService->balance($customer);
        $creditPaymentShifts = PosShift::query()
            ->where('cashier_id', request()->user()->id)
            ->where('status', 'open')
            ->with('register:id,code,name,location_id')
            ->latest('opened_at')
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
            'canManageCredit' => request()->user()->hasAdminPermission('credit.manage'),
            'creditSummary' => [
                'balance' => $creditBalance,
                'limit' => (float) $customer->credit_limit,
                'available' => max(0, (float) $customer->credit_limit - $creditBalance),
                'overdue' => (float) $creditOrders->filter(fn (Order $order) => $order->credit_due_date?->isPast())->sum(fn (Order $order) => max(0, (float) $order->final_amount - (float) $order->paid_amount)),
                'status' => $customer->credit_status,
                'terms_days' => $customer->credit_terms_days,
            ],
            'creditTransactions' => $creditTransactions,
            'creditOrders' => $creditOrders,
            'creditPaymentShifts' => $creditPaymentShifts,
        ]);
    }

    public function updateCreditSettings(Request $request, User $customer, AuditLogService $auditLogService)
    {
        abort_unless($customer->role === User::CUSTOMER_ROLE, 404);
        abort_unless($request->user()->hasAdminPermission('credit.manage'), 403);
        $validated = $request->validate([
            'credit_status' => ['required', Rule::in(['disabled', 'active', 'suspended'])],
            'credit_limit' => ['required', 'numeric', 'min:0', 'max:999999999999.99'],
            'credit_terms_days' => ['required', 'integer', 'min:1', 'max:365'],
        ]);

        $before = $customer->only(['credit_status', 'credit_limit', 'credit_terms_days']);
        $customer->update($validated);
        $auditLogService->record('customer.credit.settings_updated', $customer, [
            'before' => $before,
            'after' => $validated,
        ], $request);

        return back()->with('success', 'Customer credit settings updated.');
    }

    public function creditStatement(Request $request, User $customer, CreditStatementService $service)
    {
        abort_unless($customer->role === User::CUSTOMER_ROLE, 404);
        abort_unless($request->user()->hasAdminPermission('credit.manage'), 403);
        $dates = $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date', 'after_or_equal:from']]);
        $data = $service->data($customer, $dates['from'] ?? null, $dates['to'] ?? null);
        return response($service->pdf($data), 200, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'attachment; filename="credit-statement-'.$customer->id.'.pdf"']);
    }

    public function recordCreditPayment(
        Request $request,
        User $customer,
        CustomerCreditService $creditService,
        LoyaltyService $loyaltyService,
        AuditLogService $auditLogService
    ) {
        abort_unless($customer->role === User::CUSTOMER_ROLE, 404);
        abort_unless($request->user()->hasAdminPermission('credit.manage'), 403);
        $validated = $request->validate([
            'order_id' => ['nullable', 'integer', Rule::exists('orders', 'id')->where('user_id', $customer->id)],
            'amount' => ['required', 'numeric', 'gt:0'],
            'tender_type' => ['required', Rule::in(['cash', 'card', 'mobile', 'bank_transfer'])],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:500'],
            'shift_id' => ['nullable', 'integer', 'exists:pos_shifts,id'],
        ]);

        DB::transaction(function () use ($validated, $customer, $request, $creditService, $loyaltyService, $auditLogService) {
            $amount = round((float) $validated['amount'], 2);
            $orders = Order::query()
                ->where('user_id', $customer->id)
                ->where('credit_amount', '>', 0)
                ->where('status', '!=', 'cancelled')
                ->whereRaw('final_amount > paid_amount')
                ->when($validated['order_id'] ?? null, fn ($query, $orderId) => $query->whereKey($orderId))
                ->orderByRaw('credit_due_date is null, credit_due_date asc')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $availableOutstanding = round((float) $orders->sum(fn (Order $order) => max(0, (float) $order->final_amount - (float) $order->paid_amount)), 2);
            if ($orders->isEmpty()) {
                throw ValidationException::withMessages(['order_id' => 'This customer has no outstanding credit balance.']);
            }
            if ($amount > $availableOutstanding + 0.009) {
                throw ValidationException::withMessages(['amount' => 'Payment exceeds the selected outstanding balance.']);
            }

            $shift = null;
            if ($validated['tender_type'] === 'cash') {
                if (empty($validated['shift_id'])) {
                    throw ValidationException::withMessages(['shift_id' => 'Choose your open register shift for a cash repayment.']);
                }
                $shift = PosShift::query()->with('register')->lockForUpdate()->findOrFail($validated['shift_id']);
                if ($shift->status !== 'open' || (int) $shift->cashier_id !== (int) $request->user()->id || ! $shift->register?->is_active) {
                    throw ValidationException::withMessages(['shift_id' => 'Cash repayments require your active register shift.']);
                }
            }

            $batchReference = ($validated['reference'] ?? null) ?: 'CRPAY-'.now()->format('ymd').'-'.strtoupper(Str::random(8));

            if ($shift) {
                $shift->increment('cash_sales', $amount);
                $shift->update([
                    'expected_cash' => round((float) $shift->opening_cash + (float) $shift->cash_sales - (float) $shift->cash_refunds, 2),
                ]);
            }

            $remaining = $amount;
            $allocationCount = 0;
            foreach ($orders as $order) {
                if ($remaining <= 0.009) break;
                $outstanding = round((float) $order->final_amount - (float) $order->paid_amount, 2);
                $allocated = min($remaining, $outstanding);
                $payment = Payment::create([
                    'order_id' => $order->id,
                    'register_id' => $shift?->pos_register_id,
                    'shift_id' => $shift?->id,
                    'received_by' => $request->user()->id,
                    'transaction_id' => $batchReference.'-'.($allocationCount + 1),
                    'amount' => $allocated,
                    'amount_tendered' => $allocated,
                    'change_due' => 0,
                    'method' => $validated['tender_type'],
                    'tender_type' => $validated['tender_type'],
                    'status' => 'paid',
                    'payment_details' => ['credit_repayment' => true, 'batch_reference' => $batchReference, 'allocation_method' => ($validated['order_id'] ?? null) ? 'selected_invoice' : 'fifo', 'notes' => $validated['notes'] ?? null],
                ]);
                $paidAmount = round((float) $order->paid_amount + $allocated, 2);
                $fullyPaid = $paidAmount + 0.009 >= (float) $order->final_amount;
                $order->update(['paid_amount' => $paidAmount, 'payment_status' => $fullyPaid ? 'paid' : 'partially_paid']);
                $creditService->recordPayment($customer, $order, $payment, $request->user(), $validated['notes'] ?? null);
                if ($fullyPaid) $loyaltyService->awardForPaidOrder($order->fresh('user'));
                $remaining = round($remaining - $allocated, 2);
                $allocationCount++;
            }

            FinancialEntry::create([
                'recorded_by' => $request->user()->id,
                'type' => 'income',
                'category' => FinancialEntry::CATEGORY_POS_SALE,
                'title' => "Customer credit payment {$customer->name}",
                'amount' => $amount,
                'entry_date' => now()->toDateString(),
                'payment_method' => $validated['tender_type'],
                'reference' => $batchReference,
                'status' => 'approved',
                'notes' => $validated['notes'] ?? 'Customer credit repayment.',
            ]);
            $auditLogService->record('customer.credit.payment_recorded', $customer, [
                'customer_id' => $customer->id,
                'amount' => $amount,
                'reference' => $batchReference,
                'allocation_method' => ($validated['order_id'] ?? null) ? 'selected_invoice' : 'fifo',
                'allocations' => $allocationCount,
                'balance' => $creditService->balance($customer),
            ], $request);
        }, 3);

        return back()->with('success', 'Credit payment recorded.');
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
