<?php

namespace Tests\Unit;

use App\Models\Order;
use App\Services\OrderVoucherService;
use Tests\TestCase;

class OrderVoucherServiceTest extends TestCase
{
    public function test_it_generates_a_pdf_without_an_external_browser(): void
    {
        $service = new class extends OrderVoucherService
        {
            public function renderHtml(Order $order, bool $public = false, bool $pdf = false): string
            {
                return '<!doctype html><html><body><h1>Voucher PDF</h1></body></html>';
            }
        };

        $pdf = $service->generatePdf(new Order);

        $this->assertStringStartsWith('%PDF-', $pdf);
        $this->assertGreaterThan(1000, strlen($pdf));
    }
}
