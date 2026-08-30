<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Models\CustomerCreditTransaction;
use App\Models\Order;
use App\Services\CustomerCreditService;
use App\Services\CreditStatementService;
use App\Support\Spa;
use Illuminate\Http\Request;

class CreditController extends Controller
{
    public function index(Request $request, CustomerCreditService $creditService)
    {
        $customer = $request->user();
        $balance = $creditService->balance($customer);

        $invoiceFilter = $request->string('invoice')->toString();
        $invoiceFilter = in_array($invoiceFilter, ['all', 'overdue'], true) ? $invoiceFilter : 'all';

        $creditOrders = Order::query()
            ->where('user_id', $customer->id)
            ->where('credit_amount', '>', 0)
            ->where('status', '!=', 'cancelled')
            ->whereRaw('final_amount > paid_amount')
            ->when($invoiceFilter === 'overdue', fn ($query) => $query->whereDate('credit_due_date', '<', now()->toDateString()))
            ->latest('credit_due_date')
            ->paginate(8, [
                'id', 'order_number', 'receipt_number', 'final_amount', 'paid_amount',
                'credit_amount', 'credit_due_date', 'payment_status', 'created_at',
            ], 'invoice_page')
            ->withQueryString()
            ->through(function (Order $order) {
                $outstanding = max(0, round((float) $order->final_amount - (float) $order->paid_amount, 2));

                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'receipt_number' => $order->receipt_number,
                    'final_amount' => (float) $order->final_amount,
                    'paid_amount' => (float) $order->paid_amount,
                    'outstanding' => $outstanding,
                    'due_date' => $order->credit_due_date?->toDateString(),
                    'is_overdue' => $order->credit_due_date?->isPast() ?? false,
                    'payment_status' => $order->payment_status,
                    'created_at' => $order->created_at?->toDateTimeString(),
                ];
            });

        $transactions = CustomerCreditTransaction::query()
            ->where('customer_id', $customer->id)
            ->with('order:id,order_number')
            ->latest()
            ->paginate(15, ['*'], 'history_page')
            ->withQueryString()
            ->through(fn (CustomerCreditTransaction $transaction) => [
                'id' => $transaction->id,
                'transaction_number' => $transaction->transaction_number,
                'type' => $transaction->type,
                'amount' => (float) $transaction->amount,
                'balance_after' => (float) $transaction->balance_after,
                'tender_type' => $transaction->tender_type,
                'reference' => $transaction->reference,
                'due_date' => $transaction->due_date?->toDateString(),
                'notes' => $transaction->notes,
                'created_at' => $transaction->created_at?->toDateTimeString(),
                'order' => $transaction->order ? [
                    'id' => $transaction->order->id,
                    'order_number' => $transaction->order->order_number,
                ] : null,
            ]);

        return Spa::render('User/Credit/Index', [
            'creditSummary' => [
                'status' => $customer->credit_status,
                'limit' => (float) $customer->credit_limit,
                'balance' => $balance,
                'available' => max(0, round((float) $customer->credit_limit - $balance, 2)),
                'terms_days' => (int) $customer->credit_terms_days,
                'overdue' => round((float) Order::where('user_id', $customer->id)
                    ->where('credit_amount', '>', 0)
                    ->where('status', '!=', 'cancelled')
                    ->whereDate('credit_due_date', '<', now()->toDateString())
                    ->selectRaw('coalesce(sum(final_amount - paid_amount), 0) as total')
                    ->value('total'), 2),
            ],
            'creditOrders' => $creditOrders,
            'creditTransactions' => $transactions,
            'filters' => ['invoice' => $invoiceFilter],
        ]);
    }

    public function statement(Request $request, CreditStatementService $service)
    {
        $dates = $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date', 'after_or_equal:from']]);
        $data = $service->data($request->user(), $dates['from'] ?? null, $dates['to'] ?? null);
        return response($service->pdf($data), 200, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'attachment; filename="credit-statement.pdf"']);
    }
}
