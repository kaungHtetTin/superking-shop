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
        $path = $voucherService->generatePdf($order);

        return response()->download($path, 'voucher-'.$order->order_number.'.pdf')->deleteFileAfterSend(true);
    }

    public function link(Order $order, OrderVoucherService $voucherService)
    {
        $token = $voucherService->ensurePublicToken($order);

        return back()->with('success', 'Public invoice link is ready: '.route('public.invoices.show', $token));
    }
}
