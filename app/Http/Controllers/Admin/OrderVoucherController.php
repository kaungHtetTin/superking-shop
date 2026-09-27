<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\OrderVoucherService;

class OrderVoucherController extends Controller
{
    public function show(Order $order, OrderVoucherService $voucherService)
    {
        return response($voucherService->renderHtml($order));
    }

    public function pdf(Order $order, OrderVoucherService $voucherService)
    {
        // Use the browser's print engine for both actions. Server-side PDF
        // renderers use different font and CSS metrics, so their output cannot
        // exactly match the voucher shown in the browser.
        return response($voucherService->renderHtml($order));
    }

    public function link(Order $order, OrderVoucherService $voucherService)
    {
        $token = $voucherService->ensurePublicToken($order);

        return back()->with('success', 'Public invoice link is ready: '.route('public.invoices.show', $token));
    }
}
