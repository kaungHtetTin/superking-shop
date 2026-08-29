<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

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

    public function renderHtml(Order $order, bool $public = false): string
    {
        return view('orders.voucher', array_merge($this->prepare($order), [
            'public' => $public,
        ]))->render();
    }

    public function generatePdf(Order $order): string
    {
        $dir = storage_path('app/vouchers');
        File::ensureDirectoryExists($dir);

        $htmlPath = $dir.DIRECTORY_SEPARATOR.'voucher-'.$order->id.'-'.Str::random(8).'.html';
        $pdfPath = $dir.DIRECTORY_SEPARATOR.'voucher-'.$order->order_number.'-'.Str::random(8).'.pdf';

        File::put($htmlPath, $this->renderHtml($order));

        $chrome = $this->chromePath();
        $process = new Process([
            $chrome,
            '--headless',
            '--disable-gpu',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--print-to-pdf='.$pdfPath,
            '--print-to-pdf-no-header',
            $this->fileUrl($htmlPath),
        ]);
        $process->setTimeout(45);
        $process->run();

        File::delete($htmlPath);

        if (! $process->isSuccessful() || ! File::exists($pdfPath)) {
            throw new \RuntimeException('Could not generate voucher PDF. '.$process->getErrorOutput());
        }

        return $pdfPath;
    }

    private function chromePath(): string
    {
        $candidates = array_filter([
            env('CHROME_PATH'),
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        ]);

        foreach ($candidates as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        throw new \RuntimeException('Chrome or Edge was not found. Set CHROME_PATH in .env to enable PDF generation.');
    }

    private function fileUrl(string $path): string
    {
        return 'file:///'.str_replace(' ', '%20', str_replace('\\', '/', $path));
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
