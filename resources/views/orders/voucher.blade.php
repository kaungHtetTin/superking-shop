@php
    $appName = $settings['app_name'] ?? config('app.name', 'LaLaPick');
    $contacts = $settings['contacts'] ?? [];
    $currencyLabel = trim($settings['currency_label'] ?? 'MMK');
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
        @page { size: A5; margin: 8mm; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            background: #eef3f1;
            color: #172033;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10.5px;
            line-height: 1.35;
        }
        .sheet {
            width: 148mm;
            min-height: 210mm;
            margin: 14px auto;
            background: #fff;
            padding: 8mm;
            border: 1px solid #d7dfdc;
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
            border-bottom: 2px solid {{ $settings['theme_color'] ?? '#087f74' }};
            padding-bottom: 10px;
        }
        .brand {
            display: table-cell;
            vertical-align: top;
        }
        .brand img {
            width: 38px;
            height: 38px;
            object-fit: contain;
            border-radius: 6px;
            display: inline-block;
            vertical-align: middle;
            margin-right: 10px;
        }
        .brand-mark {
            width: 38px;
            height: 38px;
            border-radius: 6px;
            background: {{ $settings['theme_color'] ?? '#087f74' }};
            color: #fff;
            display: inline-block;
            vertical-align: middle;
            margin-right: 10px;
            line-height: 38px;
            text-align: center;
            font-weight: 900;
            font-size: 16px;
        }
        .brand > div:last-child { display: inline-block; vertical-align: middle; }
        h1, h2, h3, p { margin: 0; }
        h1 { font-size: 18px; font-weight: 900; }
        h2 { font-size: 16px; text-align: right; letter-spacing: .08em; text-transform: uppercase; }
        h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: {{ $settings['theme_color'] ?? '#087f74' }}; margin-bottom: 5px; }
        .muted { color: #667286; }
        .invoice-meta { width: 42%; text-align: right; display: table-cell; vertical-align: top; }
        .invoice-meta > * { display: block; }
        .grid {
            display: table;
            width: 100%;
            table-layout: fixed;
            margin-top: 12px;
        }
        .box {
            border: 1px solid #dfe6e3;
            border-radius: 6px;
            padding: 8px;
            min-height: 58px;
        }
        .grid > .box { display: table-cell; width: 50%; vertical-align: top; }
        .grid > .box:first-child { border-right: 5px solid #fff; }
        .detail-row {
            display: table;
            width: 100%;
            padding: 2px 0;
        }
        .detail-row > span,
        .detail-row > strong { display: table-cell; width: 50%; }
        .detail-row > strong { text-align: right; white-space: nowrap; padding-right: 2px; }
        .items {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
        }
        .items th {
            text-align: left;
            background: #f1f5f3;
            color: #667286;
            font-size: 9px;
            letter-spacing: .07em;
            text-transform: uppercase;
            border-top: 1px solid #dfe6e3;
            border-bottom: 1px solid #dfe6e3;
            padding: 6px;
        }
        .items td {
            border-bottom: 1px solid #edf1ef;
            padding: 6px;
            vertical-align: top;
        }
        .items .num { text-align: right; white-space: nowrap; }
        .totals {
            width: 58%;
            float: right;
            margin-left: auto;
            margin-top: 10px;
            border: 1px solid #dfe6e3;
            border-radius: 6px;
            padding: 7px 8px;
        }
        .total-final {
            margin-top: 5px;
            padding-top: 6px;
            border-top: 1px solid #dfe6e3;
            font-size: 12px;
            font-weight: 900;
        }
        .footer {
            clear: both;
            margin-top: 12px;
            width: 100%;
            border-top: 1px solid #dfe6e3;
            padding-top: 9px;
            overflow: hidden;
        }
        .totals + .box { clear: both; }
        .footer .footer-copy { margin-right: 92px; padding-top: 34px; }
        .footer .qr { width: 82px; float: right; }
        .qr {
            text-align: center;
            font-size: 8px;
            color: #667286;
        }
        .qr img {
            width: 68px;
            height: 68px;
            display: block;
            margin: 0 auto 3px;
        }
        .status {
            display: inline-block;
            border-radius: 999px;
            background: #e7f4ef;
            color: {{ $settings['theme_color'] ?? '#087f74' }};
            padding: 2px 7px;
            font-weight: 800;
            text-transform: capitalize;
        }
        @media screen and (max-width: 640px) {
            body { font-size: 12px; background: #f6f3ed; }
            .sheet,
            .top-actions { width: calc(100% - 24px); margin-left: 12px; margin-right: 12px; }
            .sheet { min-height: 0; padding: 18px; margin-top: 12px; overflow: hidden; }
            .top-actions { margin-top: 12px; }
            .top-actions button,
            .top-actions a { width: calc(50% - 6px); min-height: 44px; text-align: center; margin-left: 0; }
            .header,
            .header > .brand,
            .header > .invoice-meta { display: block; width: 100%; }
            .invoice-meta { text-align: left; }
            h2 { text-align: left; }
            .grid,
            .grid > .box { display: block; width: 100%; }
            .grid > .box:first-child { border-right: 1px solid #dfe6e3; margin-bottom: 10px; }
            .items { font-size: 10px; }
            .items th,
            .items td { padding: 5px 3px; }
            .totals { width: 100%; float: none; }
            .footer .footer-copy { margin-right: 0; padding-top: 8px; }
            .footer .qr { width: 100%; float: none; }
            .qr { text-align: left; }
            .qr img { margin-left: 0; }
        }
        @media print {
            body { background: #fff; }
            .sheet { margin: 0; border: 0; width: auto; min-height: auto; }
            .no-print { display: none !important; }
        }
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
            font-size: 9px;
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
        .header { display: table; width: 100%; padding-top: 0; padding-bottom: 8px; }
        .header > .brand { display: table-cell; width: 62%; }
        .header > .invoice-meta { display: table-cell; width: 38%; }
        .brand img { width: 38px; height: auto; max-height: 30px; border-radius: 0; }
        .brand-mark { width: 30px; height: 30px; line-height: 30px; font-size: 13px; }
        h1 { font-size: 14px; line-height: 1.3; }
        h2 { font-size: 14px; }
        h3 { font-size: 9.5px; }
        .status { padding: 1px 6px; }
        .grid { display: table; width: 100%; }
        .grid > .box { display: table-cell; width: 50%; }
        .box { min-height: 48px; padding: 7px; }
        .items { margin-top: 10px; }
        .items th, .items td { padding: 5px; }
        .totals { width: 58%; float: right; }
        .footer { width: 100%; }
        .footer .footer-copy { margin-right: 92px; padding-top: 34px; }
        .footer .qr { width: 82px; float: right; }
        @endif
    </style>
</head>
<body>
    @if(empty($public))
        <div class="top-actions no-print">
            <button type="button" onclick="window.print()">Print A5</button>
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
                    <p class="muted">
                        @foreach(($contacts['phone'] ?? []) as $phone)
                            {{ $phone }}@if(!$loop->last), @endif
                        @endforeach
                    </p>
                    <p class="muted">
                        @foreach(($contacts['email'] ?? []) as $email)
                            {{ $email }}@if(!$loop->last), @endif
                        @endforeach
                    </p>
                </div>
            </div>
            <div class="invoice-meta">
                <h2>Invoice</h2>
                <strong>{{ $order->order_number }}</strong>
                <span>{{ optional($order->created_at)->format('M d, Y h:i A') }}</span>
                <span class="status">{{ str_replace('_', ' ', $order->payment_status) }}</span>
            </div>
        </header>

        <section class="grid">
            <div class="box">
                <h3>Customer</h3>
                <strong>{{ $order->receiver_name ?: $order->user?->name }}</strong>
                <p>{{ $order->receiver_phone ?: $order->user?->phone }}</p>
                <p class="muted">{{ $order->user?->email }}</p>
                <p style="margin-top: 4px;">{{ $order->shipping_address }}</p>
            </div>
            <div class="box">
                <h3>Payment</h3>
                @if($paymentAccount)
                    <strong>{{ $paymentAccount['banking_service'] ?? 'Manual transfer' }}</strong>
                    <p>{{ $paymentAccount['account_name'] ?? '' }}</p>
                    <p>{{ $paymentAccount['account_no'] ?? '' }}</p>
                @else
                    <strong>{{ $order->payment_method ?: 'Manual transfer' }}</strong>
                @endif
                <p class="muted" style="margin-top: 4px;">Order status: {{ str_replace('_', ' ', $order->status) }}</p>
            </div>
        </section>

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
                        <td class="num">{{ $item->quantity }}</td>
                        <td class="num">{{ $formatMoney($item->unit_price) }}</td>
                        <td class="num">{{ $formatMoney($item->total_price) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>

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

        <footer class="footer">
            <div class="qr">
                <img src="{{ $qrUrl }}" alt="Invoice QR code">
                Invoice link
            </div>
            <div class="footer-copy">
                <h3>Thank you</h3>
                <p class="muted">Scan the QR code to open the public invoice link.</p>
                <p style="word-break: break-all; font-size: 8.5px;">{{ $publicUrl }}</p>
            </div>
        </footer>
    </main>
    @if(request()->routeIs('admin.orders.voucher.pdf'))
        <script>
            window.addEventListener('load', function () {
                window.setTimeout(function () {
                    window.print();
                }, 150);
            });
        </script>
    @endif
</body>
</html>
