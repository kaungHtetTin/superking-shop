<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
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

        $query = Order::query()
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
            'stats' => $orderManagementService->stats(),
            'filters' => [
                'status' => $status ?: null,
                'payment_status' => $paymentStatus ?: null,
                'q' => $search ?: null,
                'tab' => $tab ?: null,
            ],
            'canReviewPayments' => $user->hasAdminPermission('orders.review_payment'),
            'canManageOrders' => $user->hasAdminPermission('orders.manage'),
            'canCancelOrders' => $user->hasAdminPermission('orders.cancel'),
        ]);
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
            $orderManagementService->updateStatus($order, $validated['status']);
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors());
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

        $hadPaidStock = $order->payment_status === 'paid';

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

        return redirect()
            ->route('admin.orders.index')
            ->with('success', 'Order deleted. Stock and POS finance records were reversed.');
    }
}
