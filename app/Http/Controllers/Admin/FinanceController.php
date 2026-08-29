<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\FinancialEntry;
use App\Models\Order;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use App\Support\Spa;

class FinanceController extends Controller
{
    public function index(Request $request)
    {
        [$from, $to] = $this->dateRange($request);

        $paidOrders = Order::query()
            ->where('payment_status', 'paid')
            ->whereBetween('created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()]);

        $approvedEntries = FinancialEntry::query()
            ->where('status', 'approved')
            ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()]);

        $approvedManualIncome = (clone $approvedEntries)
            ->where('type', 'income')
            ->where('category', '!=', FinancialEntry::CATEGORY_POS_SALE)
            ->sum('amount');
        $approvedExpenses = (clone $approvedEntries)->where('type', 'expense')->sum('amount');
        $paidRevenue = (clone $paidOrders)->sum('final_amount');

        $summary = [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'paid_orders' => (clone $paidOrders)->count(),
            'gross_sales' => (float) (clone $paidOrders)->sum('total_amount'),
            'discounts' => (float) (clone $paidOrders)->sum('discount_amount'),
            'shipping_collected' => (float) (clone $paidOrders)->sum('shipping_fee'),
            'order_revenue' => (float) $paidRevenue,
            'manual_income' => (float) $approvedManualIncome,
            'expenses' => (float) $approvedExpenses,
            'net_profit' => round((float) $paidRevenue + (float) $approvedManualIncome - (float) $approvedExpenses, 2),
            'pending_income' => (float) FinancialEntry::query()
                ->where('type', 'income')
                ->where('category', '!=', FinancialEntry::CATEGORY_POS_SALE)
                ->where('status', 'pending')
                ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()])
                ->sum('amount'),
            'pending_expenses' => (float) FinancialEntry::query()
                ->where('type', 'expense')
                ->where('status', 'pending')
                ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()])
                ->sum('amount'),
        ];

        $entryQuery = FinancialEntry::query()->with('recorder:id,name')
            ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()])
            ->latest('entry_date')
            ->latest();

        if ($request->filled('type')) {
            $entryQuery->where('type', $request->type);
        }

        if ($request->filled('status')) {
            $entryQuery->where('status', $request->status);
        }

        if ($request->filled('category')) {
            $entryQuery->where('category', $request->category);
        }

        if ($request->filled('q')) {
            $term = trim($request->q);
            $entryQuery->where(function ($query) use ($term) {
                $query->where('title', 'like', "%{$term}%")
                    ->orWhere('reference', 'like', "%{$term}%")
                    ->orWhere('notes', 'like', "%{$term}%");
            });
        }

        $dailyOrders = Order::query()
            ->where('payment_status', 'paid')
            ->whereBetween('created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->selectRaw('DATE(created_at) as day, SUM(final_amount) as amount')
            ->groupBy('day')
            ->pluck('amount', 'day');

        $dailyEntries = FinancialEntry::query()
            ->where('status', 'approved')
            ->where('category', '!=', FinancialEntry::CATEGORY_POS_SALE)
            ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()])
            ->selectRaw('entry_date as day, type, SUM(amount) as amount')
            ->groupBy('entry_date', 'type')
            ->get();

        $trend = $this->makeTrend($from, $to, $dailyOrders, $dailyEntries);

        return Spa::render('Admin/Finance/Index', [
            'entries' => $entryQuery->paginate(15)
                ->withQueryString()
                ->through(fn (FinancialEntry $entry) => array_merge($entry->toArray(), [
                    'is_stock_receipt_entry' => $entry->isStockReceiptEntry(),
                ])),
            'summary' => $summary,
            'trend' => $trend,
            'filters' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'type' => $request->string('type')->toString(),
                'status' => $request->string('status')->toString(),
                'category' => $request->string('category')->toString(),
                'q' => $request->string('q')->toString(),
            ],
            'options' => [
                'categories' => FinancialEntry::categoryOptions(),
                'statuses' => FinancialEntry::STATUSES,
                'types' => FinancialEntry::TYPES,
            ],
        ]);
    }

    public function store(Request $request, AuditLogService $auditLogService)
    {
        $payload = $this->validated($request);
        $payload['recorded_by'] = $request->user()->id;

        $entry = FinancialEntry::create($payload);

        $auditLogService->record('finance.entry.created', $entry, [
            'type' => $entry->type,
            'amount' => $entry->amount,
            'title' => $entry->title,
        ], $request);

        return back()->with('success', 'Financial entry created.');
    }

    public function update(Request $request, FinancialEntry $entry, AuditLogService $auditLogService)
    {
        if ($entry->isStockReceiptEntry()) {
            return back()->with('error', 'Stock receipt ledger entries are managed from the stock receipt record.');
        }

        $entry->update($this->validated($request));

        $auditLogService->record('finance.entry.updated', $entry, [
            'type' => $entry->type,
            'amount' => $entry->amount,
            'title' => $entry->title,
        ], $request);

        return back()->with('success', 'Financial entry updated.');
    }

    public function destroy(Request $request, FinancialEntry $entry, AuditLogService $auditLogService)
    {
        if ($entry->isStockReceiptEntry()) {
            return back()->with('error', 'Delete the stock receipt record to remove this ledger entry.');
        }

        $auditLogService->record('finance.entry.deleted', $entry, [
            'type' => $entry->type,
            'amount' => $entry->amount,
            'title' => $entry->title,
        ], $request);

        $entry->delete();

        return back()->with('success', 'Financial entry deleted.');
    }

    private function validated(Request $request): array
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(FinancialEntry::TYPES)],
            'category' => ['required', 'string', 'max:80'],
            'title' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:999999999.99'],
            'entry_date' => ['required', 'date'],
            'payment_method' => ['nullable', 'string', 'max:80'],
            'reference' => ['nullable', 'string', 'max:120'],
            'status' => ['required', Rule::in(FinancialEntry::STATUSES)],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        validator($validated, [
            'category' => [Rule::in(FinancialEntry::categoryValuesFor($validated['type']))],
        ])->validate();

        return $validated;
    }

    private function dateRange(Request $request): array
    {
        $from = $request->filled('from')
            ? Carbon::parse($request->from)
            : now()->startOfMonth();

        $to = $request->filled('to')
            ? Carbon::parse($request->to)
            : now()->endOfMonth();

        if ($from->gt($to)) {
            [$from, $to] = [$to, $from];
        }

        return [$from->startOfDay(), $to->endOfDay()];
    }

    private function makeTrend(Carbon $from, Carbon $to, $dailyOrders, $dailyEntries): array
    {
        $entryMap = [];
        foreach ($dailyEntries as $row) {
            $day = Carbon::parse($row->day)->toDateString();
            $entryMap[$day][$row->type] = (float) $row->amount;
        }

        $days = [];
        $cursor = $from->copy();
        while ($cursor->lte($to) && count($days) < 45) {
            $day = $cursor->toDateString();
            $income = (float) ($dailyOrders[$day] ?? 0) + (float) ($entryMap[$day]['income'] ?? 0);
            $expenses = (float) ($entryMap[$day]['expense'] ?? 0);

            $days[] = [
                'day' => $day,
                'income' => round($income, 2),
                'expenses' => round($expenses, 2),
                'net' => round($income - $expenses, 2),
            ];

            $cursor->addDay();
        }

        return $days;
    }
}
