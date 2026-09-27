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
        $pdf = $voucherService->generatePdf($order);
        $orderNumber = preg_replace('/[^A-Za-z0-9._-]+/', '-', $order->order_number) ?: (string) $order->id;

        return response()->streamDownload(
            static function () use ($pdf): void {
                echo $pdf;
            },
            'voucher-'.$orderNumber.'.pdf',
            ['Content-Type' => 'application/pdf']
        );
    }

    public function link(Order $order, OrderVoucherService $voucherService)
    {
        $token = $voucherService->ensurePublicToken($order);

        return back()->with('success', 'Public invoice link is ready: '.route('public.invoices.show', $token));
    }
}
