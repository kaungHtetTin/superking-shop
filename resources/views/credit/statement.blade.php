<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:DejaVu Sans,sans-serif;color:#172033;font-size:12px;margin:28px}h1{margin:0 0 4px;font-size:22px}.muted{color:#667085}.summary{display:table;width:100%;margin:20px 0}.card{display:table-cell;border:1px solid #dfe4ea;padding:10px}.card strong{display:block;font-size:15px;margin-top:4px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #e6e9ee;padding:8px 6px;text-align:left}th{background:#f4f6f8;font-size:10px;text-transform:uppercase}td.num,th.num{text-align:right}.debit{color:#b54708}.credit{color:#067647}.footer{margin-top:24px;border-top:1px solid #ddd;padding-top:10px}
@if(($paperSize ?? 'A5') === '80mm')
body{font-size:9px;margin:10px}h1{font-size:14px}.summary{margin:8px 0}.card{display:block;padding:3px;border:0;border-bottom:1px solid #ddd}.card strong{display:inline;font-size:10px;margin-left:4px}th,td{padding:3px 2px;font-size:8px;word-break:break-word}.footer{margin-top:8px;padding-top:4px}
@else
body{font-size:10px;margin:18px}h1{font-size:18px}.summary{margin:10px 0}.card{padding:5px}.card strong{font-size:12px}th,td{padding:4px 3px}
@endif
</style></head><body>
<h1>Customer Credit Statement</h1><div class="muted">{{ $from }} to {{ $to }}</div>
<p><strong>{{ $customer->name }}</strong><br>{{ $customer->phone ?: $customer->email }}</p>
<div class="summary"><div class="card">Opening<strong>{{ number_format($opening,2) }} MMK</strong></div><div class="card">Purchases<strong>{{ number_format($purchases,2) }} MMK</strong></div><div class="card">Payments / credits<strong>{{ number_format($credits,2) }} MMK</strong></div><div class="card">Closing balance<strong>{{ number_format($closing,2) }} MMK</strong></div></div>
@if(($paperSize ?? 'A5') === '80mm')
@forelse($transactions as $entry)
<div style="border-bottom:1px dashed #333;padding:4px 0;page-break-inside:avoid">
<strong>{{ $entry->created_at?->format('Y-m-d H:i') }} · {{ $entry->reference ?: $entry->transaction_number }}</strong><br>
{{ ucfirst($entry->type) }}@if($entry->order) · {{ $entry->order->order_number }} @endif<br>
{{ $entry->amount > 0 ? 'Debit' : 'Credit' }}: {{ number_format(abs($entry->amount),2) }} MMK · Balance: {{ number_format($entry->balance_after,2) }} MMK
</div>
@empty <p>No transactions in this period.</p> @endforelse
@else
<table><thead><tr><th>Date</th><th>Reference</th><th>Type</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead><tbody>
@forelse($transactions as $entry)<tr><td>{{ $entry->created_at?->format('Y-m-d H:i') }}</td><td>{{ $entry->reference ?: $entry->transaction_number }}<br><span class="muted">{{ $entry->order?->order_number }}</span></td><td>{{ ucfirst($entry->type) }}</td><td class="num debit">{{ $entry->amount > 0 ? number_format($entry->amount,2) : '-' }}</td><td class="num credit">{{ $entry->amount < 0 ? number_format(abs($entry->amount),2) : '-' }}</td><td class="num">{{ number_format($entry->balance_after,2) }}</td></tr>@empty<tr><td colspan="6">No transactions in this period.</td></tr>@endforelse
</tbody></table>
@endif
<div class="footer muted">Store credit purchases and repayments are processed by authorized store staff. Please contact the store if a record is incorrect.</div>
</body></html>
