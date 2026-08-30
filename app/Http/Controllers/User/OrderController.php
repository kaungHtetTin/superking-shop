<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
use App\Support\Spa;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:all,pending,processing,shipped,delivered,cancelled'],
            'payment' => ['nullable', 'in:all,unpaid,partially_paid,pending_review,paid,rejected'],
        ]);
        $customerId = $request->user()->id;

        $orders = Order::query()
            ->where('user_id', $customerId)
            ->when($filters['search'] ?? null, function ($query, $search) {
                $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim($search)).'%';
                $query->where(fn ($nested) => $nested
                    ->where('order_number', 'like', $term)
                    ->orWhere('receipt_number', 'like', $term));
            })
            ->when(($filters['status'] ?? 'all') !== 'all', fn ($query) => $query->where('status', $filters['status']))
            ->when(($filters['payment'] ?? 'all') !== 'all', fn ($query) => $query->where('payment_status', $filters['payment']))
            ->with(['items.product.primaryImage', 'items.unit', 'items.focUnit'])
            ->withCount('items')
            ->latest()
            ->paginate(12)
            ->withQueryString();

        return Spa::render('User/Orders/Index', [
            'orders' => $orders,
            'filters' => [
                'search' => $filters['search'] ?? '',
                'status' => $filters['status'] ?? 'all',
                'payment' => $filters['payment'] ?? 'all',
            ],
            'orderStats' => [
                'all' => Order::where('user_id', $customerId)->count(),
                'active' => Order::where('user_id', $customerId)->whereIn('status', ['pending', 'processing', 'shipped'])->count(),
                'delivered' => Order::where('user_id', $customerId)->where('status', 'delivered')->count(),
                'credit' => Order::where('user_id', $customerId)->where('credit_amount', '>', 0)->whereRaw('final_amount > paid_amount')->where('status', '!=', 'cancelled')->count(),
            ],
        ]);
    }

    public function show(Request $request, Order $order)
    {
        if ($order->user_id !== $request->user()->id) {
            abort(403);
        }

        $order->load(['items.product.primaryImage', 'items.unit', 'items.focUnit']);

        return Spa::render('User/Orders/Show', [
            'order' => $order,
            'paymentStatusLabels' => [
                'pending_review' => 'Awaiting verification',
                'unpaid' => 'Unpaid',
                'partially_paid' => 'Partially paid',
                'paid' => 'Confirmed',
                'rejected' => 'Rejected',
            ],
        ]);
    }
}
