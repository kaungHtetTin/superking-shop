<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Services\OrderVoucherService;

class PublicInvoiceController extends Controller
{
    public function show(string $token, OrderVoucherService $voucherService)
    {
        $order = Order::query()
            ->where('voucher_public_token', $token)
            ->firstOrFail();

        return response($voucherService->renderHtml($order, public: true));
    }
}
