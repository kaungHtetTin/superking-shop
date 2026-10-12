@php
    $appName = $settings['app_name'] ?? config('app.name', 'LaLaPick');
    $contacts = $settings['contacts'] ?? [];
    $currencyLabel = 'MMK';
    $paperSize = ($settings['receipt']['paper_size'] ?? 'A5') === '80mm' ? '80mm' : 'A5';
    $checkoutDiscount = max(0, (float) ($order->discount_amount ?? 0) - (float) ($order->admin_discount_amount ?? 0));
    $adminDiscount = (float) ($order->admin_discount_amount ?? 0);
    $formatMoney = fn ($value) => trim(rtrim(rtrim(number_format((float) $value, 2), '0'), '.').' '.$currencyLabel);
@endphp
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Invoice {{ $order->order_number }}</title>
    @if(!empty($settings['favicon_url']))
        <link rel="icon" href="{{ $settings['favicon_url'] }}">
    @endif
    <style>
        @font-face {
            font-family: 'Voucher Padauk';
            src: url('{{ asset('fonts/Padauk-Regular.ttf') }}') format('truetype');
            font-weight: 400;
        }
        @font-face {
            font-family: 'Voucher Padauk';
            src: url('{{ asset('fonts/Padauk-Bold.ttf') }}') format('truetype');
            font-weight: 700;
        }
        @page { size: {{ $paperSize === 'A5' ? 'A5' : '80mm 297mm' }}; margin: {{ $paperSize === 'A5' ? '8mm' : '0' }}; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            background: #fff;
            color: #000;
            font-family: 'Voucher Padauk', Arial, sans-serif;
            font-size: 12px;
            line-height: 1.3;
        }
        .sheet {
            width: 148mm;
            min-height: 210mm;
            margin: 14px auto;
            background: #fff;
            padding: 8mm;
            border: 0;
        }
        .top-actions {
            width: 148mm;
            margin: 14px auto 0;
            text-align: right;
        }
        .top-actions button,
        .top-actions a {
            border: 1px solid #cfd8d4;
            background: #fff;
            color: #172033;
            padding: 8px 12px;
            border-radius: 6px;
            font-weight: 700;
            text-decoration: none;
            cursor: pointer;
            display: inline-block;
            margin-left: 8px;
        }
        .top-actions .primary { background: {{ $settings['theme_color'] ?? '#087f74' }}; border-color: {{ $settings['theme_color'] ?? '#087f74' }}; color: #fff; }
        .header {
            display: table;
            width: 100%;
            table-layout: fixed;
            border-bottom: 1px solid #000;
            padding-bottom: 4px;
        }
        .brand {
            display: table-cell;
            width: 42%;
            vertical-align: top;
        }
        .shop-contacts { display: table-cell; width: 58%; vertical-align: top; overflow-wrap: anywhere; }
        .brand img {
            width: 70px;
            height: 70px;
            object-fit: contain;
            border-radius: 0;
            display: block;
            margin-bottom: 4px;
        }
        .brand-mark {
            width: 70px;
            height: 70px;
            border-radius: 0;
            background: #fff;
            border: 1px solid #000;
            color: #000;
            display: inline-block;
            vertical-align: middle;
            margin-right: 10px;
            line-height: 70px;
            text-align: center;
            font-weight: 900;
            font-size: 24px;
        }
        .brand > div:last-child { display: block; }
        h1, h2, h3, p { margin: 0; }
        h1 { font-size: 18px; font-weight: 900; }
        h2 { font-size: 18px; text-align: right; letter-spacing: .04em; text-transform: uppercase; }
        h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #000; margin-bottom: 2px; }
        .muted { color: #000; }
        .invoice-meta { width: 100%; text-align: left; display: block; }
        .invoice-meta > * { display: block; }
        .invoice-meta h2 { text-align: left; font-size: 12px; }
        .invoice-meta { margin-bottom: 2px; }
        .invoice-meta .status { padding: 0; }
        .payment-line { margin-top: 1px; display: flex; flex-wrap: wrap; column-gap: 10px; row-gap: 0; align-items: baseline; }
        .payment-line > * { margin: 0; }
        .grid {
            display: table;
            width: 100%;
            table-layout: fixed;
            margin-top: 4px;
        }
        .box {
            border: 0;
            border-radius: 0;
            padding: 3px 0;
            min-height: 0;
        }
        .grid > .box { display: table-cell; width: 50%; vertical-align: top; }
        .grid > .box:first-child { padding-right: 12px; }
        .grid > .box:last-child { padding-left: 12px; }
        .detail-row {
            display: table;
            width: 100%;
            padding: 1px 0;
        }
        .detail-row > span,
        .detail-row > strong { display: table-cell; width: 50%; }
        .detail-row > strong { text-align: right; white-space: nowrap; padding-right: 2px; }
        .items {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
        }
        .items th {
            text-align: left;
            background: #fff;
            color: #000;
            font-size: 10px;
            letter-spacing: .07em;
            text-transform: uppercase;
            border: 1px solid #000;
            padding: 2px;
        }
        .items td {
            border: 1px solid #000;
            padding: 2px;
            vertical-align: top;
        }
        .items .num { text-align: right; overflow-wrap: anywhere; font-weight: 700; }
        .totals {
            width: 55%;
            float: none;
            margin-left: auto;
            margin-top: 3px;
            border: 1px solid #000;
            border-radius: 0;
            padding: 0;
        }
        .total-final {
            margin-top: 0;
            padding-top: 0;
            border-top: 0;
            font-size: 14px;
            font-weight: 900;
        }
        .totals .detail-row { padding: 0; border-bottom: 1px solid #000; }
        .totals .detail-row:last-child { border-bottom: 0; }
        .totals .detail-row > span { width: 40%; padding: 2px; }
        .totals .detail-row > strong { width: 60%; padding: 2px; border-left: 1px solid #000; white-space: normal; overflow-wrap: anywhere; }
        .footer {
            clear: both;
            margin-top: 6px;
            width: 100%;
            border-top: 0;
            padding-top: 4px;
            overflow: hidden;
        }
        .voucher-ending { break-inside: avoid; page-break-inside: avoid; }
        .totals + .box { clear: both; }
        .footer .footer-copy { margin-right: 92px; padding-top: 0; }
        .footer .qr { width: 82px; float: right; }
        .qr {
            text-align: center;
            font-size: 12px;
            color: #000;
        }
        .qr img {
            width: 68px;
            height: 68px;
            display: block;
            margin: 0 auto 3px;
        }
        .status {
            display: inline-block;
            border-radius: 0;
            background: #fff;
            color: #000;
            padding: 2px 0;
            font-weight: 800;
            text-transform: capitalize;
        }
        @media screen and (max-width: 640px) {
            body { font-size: 16px; background: #fff; }
            .sheet,
            .top-actions { width: calc(100% - 24px); margin-left: 12px; margin-right: 12px; }
            .sheet { min-height: 0; padding: 18px; margin-top: 12px; overflow: hidden; }
            .top-actions { margin-top: 12px; }
            .top-actions button,
            .top-actions a { width: calc(50% - 6px); min-height: 44px; text-align: center; margin-left: 0; }
            .header { display: table; width: 100%; }
            .header > .brand { display: table-cell; width: 42%; }
            .header > .shop-contacts { display: table-cell; width: 58%; }
            .invoice-meta { text-align: left; }
            h2 { text-align: left; }
            .grid { display: table; width: 100%; }
            .grid > .box { display: table-cell; width: 50%; }
            .grid > .box:first-child { border-right: 0; padding-right: 5px; }
            .grid > .box:last-child { padding-left: 5px; }
            .items { font-size: 16px; }
            .items thead { display: none; }
            .items, .items tbody, .items tr, .items td { display: block; width: 100%; }
            .items tr { border-bottom: 1px solid #000; padding: 8px 0; }
            .items tr:last-child { border-bottom: 0; }
            .items td { padding: 3px 0; }
            .items td { border: 0; }
            .items .num { text-align: left; white-space: normal; }
            .items .num::before { content: attr(data-label) ': '; font-weight: 700; }
            .totals { width: 100%; float: none; }
            .footer .footer-copy { margin-right: 0; padding-top: 8px; }
            .footer .qr { width: 100%; float: none; }
            .qr { text-align: left; }
            .qr img { margin-left: 0; }
        }
        @media print {
            body { background: #fff; color: #000; font-size: 12px; line-height: 1.25; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .sheet { margin: 0; border: 0; width: auto; min-height: auto; padding: 0; }
            .sheet, .sheet * { color: #000 !important; opacity: 1 !important; text-shadow: none !important; }
            .sheet img { filter: grayscale(1) contrast(1.5); }
            .header { padding-bottom: 3px; }
            .brand img { width: 52px; height: 52px; margin-bottom: 2px; }
            .grid { margin-top: 3px; }
            .grid > .box { padding-top: 2px; padding-bottom: 2px; }
            h3 { font-size: 12px; margin-bottom: 1px; }
            .invoice-meta { margin-bottom: 2px; }
            .invoice-meta h2 { font-size: 12px; }
            .detail-row { padding: 1px 0; }
            .items { margin-top: 3px; }
            .items th { font-size: 10px; }
            .items th, .items td { padding: 2px; overflow-wrap: anywhere; }
            .items .num { white-space: normal; }
            .totals { margin-top: 3px; }
            .totals .detail-row > span, .totals .detail-row > strong { padding: 2px; }
            .total-final { font-size: 14px; }
            .header, .grid, .items tr, .totals, .footer { break-inside: avoid; }
            .no-print { display: none !important; }
        }
        @if($paperSize === '80mm')
        .sheet { width: 80mm; min-height: 0; padding: 4mm; }
        .header { display: block; text-align: center; padding-bottom: 3px; border-bottom-style: dashed; }
        .brand, .shop-contacts { display: block; width: 100%; text-align: center; }
        .brand img, .brand-mark { width: 42px; height: 42px; margin: 0 auto 2px; }
        .brand-mark { line-height: 42px; }
        .grid { margin-top: 3px; }
        .grid > .box:first-child { padding-right: 4px; }
        .grid > .box:last-child { padding-left: 4px; }
        .payment-line { gap: 0 5px; }
        .items { table-layout: fixed; }
        .items th, .items td { font-size: 9px; padding: 2px 1px; }
        .items th:nth-child(1) { width: 39%; }
        .items th:nth-child(2) { width: 10%; }
        .items th:nth-child(3) { width: 24%; }
        .items th:nth-child(4) { width: 27%; }
        .totals { width: 100%; }
        @media print {
            .sheet { width: 72mm; max-width: 72mm; padding: 0; }
            .header { display: block; border-bottom-style: dashed; }
            .brand, .shop-contacts { display: block; width: 100%; }
            .grid { display: table; }
            .grid > .box { display: table-cell; width: 50%; }
            .items th, .items td { font-size: 9px; }
            .totals { width: 100%; }
        }
        @endif
    @if(!empty($pdf))
        @font-face {
            font-family: 'Padauk';
            font-style: normal;
            font-weight: 400;
            src: url('file://{{ str_replace('\\', '/', public_path('fonts/Padauk-Regular.ttf')) }}') format('truetype');
        }
        @font-face {
            font-family: 'Padauk';
            font-style: normal;
            font-weight: 700;
            src: url('file://{{ str_replace('\\', '/', public_path('fonts/Padauk-Bold.ttf')) }}') format('truetype');
        }
        /* Dompdf does not fully support grid/flex. These table-based equivalents
           preserve the browser invoice layout in the downloaded A5 document. */
        body {
            background: #fff;
            font-family: 'Padauk', 'DejaVu Sans', sans-serif;
            font-size: 12px;
            line-height: 1.25;
        }
        .no-print { display: none !important; }
        .sheet {
            width: auto;
            min-height: auto;
            margin: 0;
            padding: 0;
            border: 0;
        }
        .header { display: table; width: 100%; padding-top: 0; padding-bottom: 3px; }
        .header > .brand { display: table-cell; width: 42%; }
        .header > .shop-contacts { display: table-cell; width: 58%; }
        .brand img { width: 70px; height: auto; max-height: 70px; border-radius: 0; }
        .brand-mark { width: 70px; height: 70px; line-height: 70px; font-size: 24px; }
        h1 { font-size: 18px; line-height: 1.3; }
        h2 { font-size: 18px; }
        h3 { font-size: 12px; margin-bottom: 1px; }
        .status { padding: 1px 6px; }
        .grid { display: table; width: 100%; }
        .grid > .box { display: table-cell; width: 50%; }
        .box { min-height: 0; padding: 2px; }
        .items { margin-top: 3px; }
        .items th, .items td { padding: 2px; }
        .items th { font-size: 10px; }
        .items .num { white-space: normal; }
        .totals { width: 55%; float: none; }
        .totals .detail-row > span, .totals .detail-row > strong { padding: 2px; }
        .total-final { font-size: 14px; }
        .footer { width: 100%; }
        .footer .footer-copy { margin-right: 92px; padding-top: 0; }
        .footer .qr { width: 82px; float: right; }
        @endif
    </style>
</head>
<body>
    @if(empty($public))
        <div class="top-actions no-print">
            <button type="button" onclick="printVoucher()">Print {{ $paperSize === 'A5' ? 'A5' : '80 mm' }}</button>
            <a class="primary" href="{{ route('admin.orders.voucher.pdf', $order) }}">Download PDF</a>
        </div>
    @endif

    <main class="sheet">
        <header class="header">
            <div class="brand">
                @if(!empty($settings['logo_url']))
                    <img src="{{ $settings['logo_url'] }}" alt="{{ $appName }}">
                @else
                    <div class="brand-mark">{{ strtoupper(substr($appName, 0, 1)) }}</div>
                @endif
                <div>
                    <h1>{{ $appName }}</h1>
                </div>
            </div>
            <div class="shop-contacts">
                <p>
                    @foreach(($contacts['phone'] ?? []) as $phone)
                        {{ $phone }}@if(!$loop->last), @endif
                    @endforeach
                </p>
                <p>
                    @foreach(($contacts['email'] ?? []) as $email)
                        {{ $email }}@if(!$loop->last), @endif
                    @endforeach
                </p>
            </div>
        </header>

        <section class="grid">
            <div class="box">
                <h3>Customer</h3>
                <strong>{{ $order->receiver_name ?: $order->user?->name }}</strong>
                <p>{{ $order->receiver_phone ?: $order->user?->phone }}</p>
                <p class="muted">{{ $order->user?->email }}</p>
                <p>{{ $order->shipping_address }}</p>
            </div>
            <div class="box">
                <div class="invoice-meta">
                    <h2>Invoice</h2>
                    <strong>{{ $order->order_number }}</strong>
                    <span>{{ optional($order->created_at)->format('M d, Y h:i A') }}</span>
                </div>
            </div>
        </section>
        <div class="payment-line">
            <strong>Payment:</strong>
                @if($paymentAccount)
                    <strong>{{ $paymentAccount['banking_service'] ?? 'Manual transfer' }}</strong>
                    @if(!empty($paymentAccount['account_name'])) <span>{{ $paymentAccount['account_name'] }}</span> @endif
                    @if(!empty($paymentAccount['account_no'])) <span>{{ $paymentAccount['account_no'] }}</span> @endif
                @else
                    <strong>{{ $order->payment_method ?: 'Manual transfer' }}</strong>
                @endif
            <span>Payment status: {{ str_replace('_', ' ', $order->payment_status) }}</span>
            <span>Order status: {{ str_replace('_', ' ', $order->status) }}</span>
        </div>

        <table class="items">
            <thead>
                <tr>
                    <th>Item</th>
                    <th class="num">Qty</th>
                    <th class="num">Unit</th>
                    <th class="num">Amount</th>
                </tr>
            </thead>
            <tbody>
                @foreach($order->items as $item)
                    <tr>
                        <td>
                            <strong>{{ $item->product?->name ?? 'Product' }}</strong>
                            <div class="muted">
                                {{ $item->unit_name ?: $item->unit?->name }}
                                @if($item->is_preorder) - Pre-order @endif
                                @if($item->foc_quantity > 0) - FOC: {{ $item->foc_quantity }} {{ $item->focUnit?->name }} @endif
                            </div>
                        </td>
                        <td class="num" data-label="Qty">{{ $item->quantity }}</td>
                        <td class="num" data-label="Unit price">{{ $formatMoney($item->unit_price) }}</td>
                        <td class="num" data-label="Amount">{{ $formatMoney($item->total_price) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        <div class="voucher-ending">
        <section class="totals">
            <div class="detail-row">
                <span>Subtotal</span>
                <strong>{{ $formatMoney($order->total_amount) }}</strong>
            </div>
            <div class="detail-row">
                <span>Tax</span>
                <strong>{{ $formatMoney($order->tax_amount ?? 0) }}</strong>
            </div>
            <div class="detail-row">
                <span>Shipping</span>
                <strong>{{ $formatMoney($order->shipping_fee) }}</strong>
            </div>
            @if($checkoutDiscount > 0)
                <div class="detail-row">
                    <span>Discount{{ $order->coupon_code ? ' ('.$order->coupon_code.')' : '' }}</span>
                    <strong>-{{ $formatMoney($checkoutDiscount) }}</strong>
                </div>
            @endif
            @if($adminDiscount > 0)
                <div class="detail-row">
                    <span>Approval discount</span>
                    <strong>-{{ $formatMoney($adminDiscount) }}</strong>
                </div>
            @endif
            <div class="detail-row total-final">
                <span>Total</span>
                <strong>{{ $formatMoney($order->final_amount) }}</strong>
            </div>
            @if($order->credit_amount > 0)
                <div class="detail-row">
                    <span>Paid</span>
                    <strong>{{ $formatMoney($order->paid_amount) }}</strong>
                </div>
                <div class="detail-row total-final">
                    <span>Credit balance</span>
                    <strong>{{ $formatMoney(max(0, $order->final_amount - $order->paid_amount)) }}</strong>
                </div>
                <div class="detail-row">
                    <span>Due date</span>
                    <strong>{{ $order->credit_due_date?->format('Y-m-d') ?: '-' }}</strong>
                </div>
            @endif
        </section>

        @if($order->order_notes)
            <section class="box" style="margin-top: 10px; min-height: 0;">
                <h3>Customer note</h3>
                <p>{{ $order->order_notes }}</p>
            </section>
        @endif

        </div>
    </main>
    <script>
        async function printVoucher() {
            if (document.fonts) {
                await Promise.all([
                    document.fonts.load('400 11px "Voucher Padauk"', 'မြန်မာစာ'),
                    document.fonts.load('700 11px "Voucher Padauk"', 'မြန်မာစာ'),
                ].map((load) => load.catch(() => {})));
            }
            await Promise.all(Array.from(document.querySelectorAll('.sheet img')).map((image) =>
                image.decode ? image.decode().catch(() => {}) : Promise.resolve()
            ));
            window.print();
        }
        @if(request()->routeIs('admin.orders.voucher.pdf'))
            window.addEventListener('load', printVoucher);
        @endif
    </script>
</body>
</html>
