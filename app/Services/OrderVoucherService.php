<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Str;
use Dompdf\Dompdf;
use Dompdf\Options;

class OrderVoucherService
{
    public function ensurePublicToken(Order $order): string
    {
        if ($order->voucher_public_token) {
            return $order->voucher_public_token;
        }

        do {
            $token = Str::random(48);
        } while (Order::where('voucher_public_token', $token)->exists());

        $order->forceFill(['voucher_public_token' => $token])->save();

        return $token;
    }

    public function prepare(Order $order): array
    {
        $order->loadMissing([
            'user:id,name,email,phone',
            'coupon',
            'items.product',
            'items.unit',
            'items.focUnit',
            'selectedPaymentMethod',
        ]);

        $token = $this->ensurePublicToken($order);
        $publicUrl = route('public.invoices.show', $token);
        $settings = app(AppSettingsService::class)->publicSettings();
        $settings['logo_url'] = $this->absoluteUrl($settings['logo_url'] ?? null);
        $settings['favicon_url'] = $this->absoluteUrl($settings['favicon_url'] ?? null);

        return [
            'order' => $order,
            'settings' => $settings,
            'publicUrl' => $publicUrl,
            'qrUrl' => 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=8&data='.rawurlencode($publicUrl),
            'paymentAccount' => $order->payment_method_snapshot
                ?: $order->selectedPaymentMethod?->snapshot()
                ?: ($order->payment_method ? ['banking_service' => $order->payment_method] : null),
        ];
    }

    public function renderHtml(Order $order, bool $public = false, bool $pdf = false): string
    {
        return view('orders.voucher', array_merge($this->prepare($order), [
            'public' => $public,
            'pdf' => $pdf,
        ]))->render();
    }

    public function generatePdf(Order $order): string
    {
        $options = new Options;
        $options->set('isRemoteEnabled', true);
        $options->set('isHtml5ParserEnabled', true);
        $options->set('chroot', public_path());
        $options->set('defaultFont', 'Padauk');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($this->renderHtml($order, pdf: true), 'UTF-8');
        $dompdf->setPaper('A5', 'portrait');
        $dompdf->render();

        return $dompdf->output();
    }

    private function absoluteUrl(?string $url): ?string
    {
        if (! $url) {
            return null;
        }

        if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) {
            return $url;
        }

        return url($url);
    }
}
