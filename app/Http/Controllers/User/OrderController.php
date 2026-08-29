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
        $orders = Order::query()
            ->where('user_id', $request->user()->id)
            ->with(['items.product.primaryImage', 'items.unit', 'items.focUnit'])
            ->latest()
            ->paginate(10)
            ->withQueryString();

        return Spa::render('User/Orders/Index', [
            'orders' => $orders,
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
                'paid' => 'Confirmed',
                'rejected' => 'Rejected',
            ],
        ]);
    }
}
