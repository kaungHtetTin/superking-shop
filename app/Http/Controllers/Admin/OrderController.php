<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Location;
use App\Services\OrderManagementService;
use App\Services\OrderPaymentService;
use App\Services\OrderVoucherService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use App\Support\Spa;

class OrderController extends Controller
{
    public function index(Request $request, OrderManagementService $orderManagementService)
    {
        $status = $request->string('status')->toString();
        $paymentStatus = $request->string('payment_status')->toString();
        $search = trim($request->string('q')->toString());
        $tab = $request->string('tab')->toString();
        $from = $request->date('from');
        $to = $request->date('to');
        $locationId = $request->integer('location_id');
        $accessibleLocationIds = array_map('intval', $request->user()->accessibleLocationIds());
        abort_if($locationId && ! in_array($locationId, $accessibleLocationIds, true), 403);

        $query = Order::query()->whereIn('location_id', $locationId ? [$locationId] : $accessibleLocationIds)
            ->with(['user:id,name,email,phone', 'items'])
            ->withCount('items');

        if ($tab === 'payments') {
            $query->where('payment_status', 'pending_review');
        } elseif ($tab === 'fulfillment') {
            $query->where('payment_status', 'paid')->whereIn('status', ['processing', 'shipped']);
        } elseif ($tab === 'completed') {
            $query->where('status', 'delivered');
        }

        $orders = $query
            ->when($status, fn ($q) => $q->where('status', $status))
            ->when($paymentStatus, fn ($q) => $q->where('payment_status', $paymentStatus))
            ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
            ->when($search, function ($q) use ($search) {
                $like = '%'.$search.'%';
                $q->where(function ($inner) use ($like) {
                    $inner->where('order_number', 'like', $like)
                        ->orWhereHas('user', function ($u) use ($like) {
                            $u->where('name', 'like', $like)
                                ->orWhere('email', 'like', $like)
                                ->orWhere('phone', 'like', $like);
                        });
                });
            })
            ->latest()
            ->paginate(15)
            ->withQueryString();

        $user = $request->user();

        return Spa::render('Admin/Orders/Index', [
            'orders' => $orders,
            'stats' => $this->orderStats($locationId ? [$locationId] : $accessibleLocationIds),
            'filters' => [
                'status' => $status ?: null,
                'payment_status' => $paymentStatus ?: null,
                'q' => $search ?: null,
                'tab' => $tab ?: null,
                'location_id' => $locationId ?: null,
                'from' => $from?->toDateString(),
                'to' => $to?->toDateString(),
            ],
            'locations' => Location::query()->whereIn('id', $accessibleLocationIds)->where('is_active', true)->orderBy('name')->get(['id', 'code', 'name']),
            'canReviewPayments' => $user->hasAdminPermission('orders.review_payment'),
            'canManageOrders' => $user->hasAdminPermission('orders.manage'),
            'canCancelOrders' => $user->hasAdminPermission('orders.cancel'),
        ]);
    }

    public function export(Request $request)
    {
        $locationId = $request->integer('location_id');
        $accessibleLocationIds = array_map('intval', $request->user()->accessibleLocationIds());
        abort_if($locationId && ! in_array($locationId, $accessibleLocationIds, true), 403);

        $query = Order::query()
            ->whereIn('location_id', $locationId ? [$locationId] : $accessibleLocationIds)
            ->with(['user:id,name,email,phone', 'location:id,code,name'])
            ->withCount('items');
        $this->applyFilters($query, $request);

        return response()->streamDownload(function () use ($query) {
            $output = fopen('php://output', 'w');
            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, ['Order number', 'Date', 'Store', 'Channel', 'Customer', 'Phone', 'Email', 'Items', 'Subtotal', 'Discount', 'Shipping', 'Total', 'Payment method', 'Payment status', 'Fulfillment status']);
            $query->orderBy('id')->chunkById(500, function ($orders) use ($output) {
                foreach ($orders as $order) {
                    fputcsv($output, [$order->order_number, $order->created_at?->format('Y-m-d H:i:s'), $order->location?->name, $order->sales_channel, $order->user?->name, $order->user?->phone, $order->user?->email, $order->items_count, $order->total_amount, $order->discount_amount, $order->shipping_fee, $order->final_amount, $order->payment_method, $order->payment_status, $order->status]);
                }
            });
            fclose($output);
        }, 'orders-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function applyFilters($query, Request $request): void
    {
        $status = $request->string('status')->toString();
        $paymentStatus = $request->string('payment_status')->toString();
        $search = trim($request->string('q')->toString());
        $tab = $request->string('tab')->toString();
        $from = $request->date('from');
        $to = $request->date('to');
        if ($tab === 'payments') $query->where('payment_status', 'pending_review');
        elseif ($tab === 'fulfillment') $query->where('payment_status', 'paid')->whereIn('status', ['processing', 'shipped']);
        elseif ($tab === 'completed') $query->where('status', 'delivered');
        $query->when($status, fn ($q) => $q->where('status', $status))
            ->when($paymentStatus, fn ($q) => $q->where('payment_status', $paymentStatus))
            ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
            ->when($search, function ($q) use ($search) {
                $like = '%'.$search.'%';
                $q->where(fn ($inner) => $inner->where('order_number', 'like', $like)->orWhereHas('user', fn ($u) => $u->where('name', 'like', $like)->orWhere('email', 'like', $like)->orWhere('phone', 'like', $like)));
            });
    }

    private function orderStats(array $locationIds): array
    {
        $orders = Order::query()->whereIn('location_id', $locationIds);
        return [
            'total' => (clone $orders)->count(),
            'pending_payment' => (clone $orders)->whereIn('payment_status', ['pending', 'pending_review'])->count(),
            'processing' => (clone $orders)->where('status', 'processing')->count(),
            'shipped' => (clone $orders)->where('status', 'shipped')->count(),
            'delivered' => (clone $orders)->where('status', 'delivered')->count(),
            'revenue_paid' => (float) (clone $orders)->where('payment_status', 'paid')->sum('final_amount'),
        ];
    }

    public function show(Request $request, Order $order, OrderVoucherService $voucherService)
    {
        $order->load([
            'user:id,name,email,phone',
            'coupon',
            'items.product',
            'items.unit',
            'items.focUnit',
            'paymentReviewer:id,name',
            'selectedPaymentMethod',
        ]);

        $user = $request->user();

        return Spa::render('Admin/Orders/Show', [
            'order' => $order,
            'voucherLinks' => [
                'print' => route('admin.orders.voucher.show', $order),
                'pdf' => route('admin.orders.voucher.pdf', $order),
                'public' => route('public.invoices.show', $voucherService->ensurePublicToken($order)),
            ],
            'canReviewPayments' => $user->hasAdminPermission('orders.review_payment'),
            'canManageOrders' => $user->hasAdminPermission('orders.manage'),
            'canCancelOrders' => $user->hasAdminPermission('orders.cancel'),
        ]);
    }

    public function confirmPayment(Request $request, Order $order, OrderPaymentService $orderPaymentService)
    {
        $validated = $request->validate([
            'discount_type' => ['nullable', 'required_with:discount_value', 'string', 'in:percent,amount'],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
        ]);

        try {
            $orderPaymentService->confirmPayment($order, $request->user(), $validated);
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        return redirect()
            ->route('admin.orders.show', $order)
            ->with('success', 'Payment confirmed. Order is now processing and stock has been deducted.');
    }

    public function rejectPayment(Request $request, Order $order, OrderPaymentService $orderPaymentService)
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $orderPaymentService->rejectPayment($order, $request->user(), $validated['reason'] ?? null);
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        return redirect()
            ->route('admin.orders.show', $order)
            ->with('success', 'Payment rejected and order cancelled. The customer will see your message on their order page.');
    }

    public function updateStatus(Request $request, Order $order, OrderManagementService $orderManagementService)
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:processing,shipped,delivered,cancelled'],
        ]);

        try {
            $updatedOrder = $orderManagementService->updateStatus($order, $validated['status']);
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        if ($request->header('X-SPA') === 'true') {
            return response()->json([
                'status' => $updatedOrder->status,
                'status_updated_at' => $updatedOrder->status_updated_at,
                'message' => 'Order status updated.',
            ]);
        }

        return back()->with('success', 'Order status updated.');
    }

    public function updateNotes(Request $request, Order $order, OrderManagementService $orderManagementService)
    {
        $validated = $request->validate([
            'admin_notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $orderManagementService->updateAdminNotes($order, $validated['admin_notes'] ?? null);

        return back()->with('success', 'Admin notes saved.');
    }

    public function cancel(Request $request, Order $order, OrderManagementService $orderManagementService)
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $hadPaidStock = $order->payment_status === 'paid' || (float) $order->credit_amount > 0;

        try {
            $orderManagementService->cancelOrder(
                $order,
                $request->user(),
                $validated['reason'] ?? null,
                restoreStock: $hadPaidStock,
            );
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        $message = 'Order cancelled.'.($hadPaidStock ? ' Stock has been restored.' : '');

        return redirect()
            ->route('admin.orders.show', $order)
            ->with('success', $message);
    }

    public function destroy(Request $request, Order $order, OrderManagementService $orderManagementService)
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $orderManagementService->deleteOrderAsReturn($order, $request->user(), $validated['reason'] ?? null);
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        if ($request->header('X-SPA') === 'true') {
            return response()->json([
                'deleted' => true,
                'redirect' => route('admin.orders.index'),
                'message' => 'Order deleted. Stock and POS finance records were reversed.',
            ]);
        }

        return redirect()
            ->route('admin.orders.index')
            ->with('success', 'Order deleted. Stock and POS finance records were reversed.');
    }
}
