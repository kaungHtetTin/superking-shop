<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\FinancialEntry;
use App\Models\Order;
use App\Models\Location;
use App\Models\OrderItem;
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
        $location = $this->selectedLocation($request);
        $accessibleLocationIds = array_map('intval', $request->user()->accessibleLocationIds());
        $entryLocationScope = function ($query) use ($location, $accessibleLocationIds, $request) {
            if ($location) {
                $query->where('location_id', $location->id);
            } else {
                $query->where(function ($locations) use ($accessibleLocationIds, $request) {
                    $locations->whereIn('location_id', $accessibleLocationIds);
                    if ($request->user()->isSuperAdmin()) {
                        $locations->orWhereNull('location_id');
                    }
                });
            }
        };

        $paidOrders = Order::query()
            ->where('payment_status', 'paid')
            ->where($entryLocationScope)
            ->whereBetween('created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()]);

        $approvedEntries = FinancialEntry::query()
            ->where('status', 'approved')
            ->where($entryLocationScope)
            ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()]);

        $approvedManualIncome = (clone $approvedEntries)
            ->where('type', 'income')
            ->where('category', '!=', FinancialEntry::CATEGORY_POS_SALE)
            ->sum('amount');
        $approvedExpenses = (clone $approvedEntries)->where('type', 'expense')->where('category', '!=', FinancialEntry::CATEGORY_STOCK_RECEIPT)->sum('amount');
        $stockPurchases = (clone $approvedEntries)->where('type', 'expense')->where('category', FinancialEntry::CATEGORY_STOCK_RECEIPT)->sum('amount');
        $paidRevenue = (clone $paidOrders)->sum('final_amount');
        $costOfGoods = (float) OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.payment_status', 'paid')
            ->where(function ($query) use ($location, $accessibleLocationIds, $request) {
                $query->whereIn('orders.location_id', $location ? [$location->id] : $accessibleLocationIds);
                if (! $location && $request->user()->isSuperAdmin()) {
                    $query->orWhereNull('orders.location_id');
                }
            })
            ->whereBetween('orders.created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->selectRaw('COALESCE(SUM((order_items.cost_price * order_items.quantity) + order_items.foc_cost_price), 0) as total_cost')
            ->value('total_cost');

        $summary = [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'paid_orders' => (clone $paidOrders)->count(),
            'gross_sales' => (float) (clone $paidOrders)->sum('total_amount'),
            'discounts' => (float) (clone $paidOrders)->sum('discount_amount'),
            'shipping_collected' => (float) (clone $paidOrders)->sum('shipping_fee'),
            'order_revenue' => (float) $paidRevenue,
            'cost_of_goods' => $costOfGoods,
            'manual_income' => (float) $approvedManualIncome,
            'expenses' => (float) $approvedExpenses,
            'stock_purchases' => (float) $stockPurchases,
            'net_profit' => round((float) $paidRevenue + (float) $approvedManualIncome - $costOfGoods - (float) $approvedExpenses, 2),
            'pending_income' => (float) FinancialEntry::query()
                ->where('type', 'income')
                ->where('category', '!=', FinancialEntry::CATEGORY_POS_SALE)
                ->where('status', 'pending')
                ->where($entryLocationScope)
                ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()])
                ->sum('amount'),
            'pending_expenses' => (float) FinancialEntry::query()
                ->where('type', 'expense')
                ->where('status', 'pending')
                ->where($entryLocationScope)
                ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()])
                ->sum('amount'),
        ];

        $entryQuery = FinancialEntry::query()->with(['recorder:id,name', 'location:id,code,name'])
            ->where($entryLocationScope)
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
            ->where($entryLocationScope)
            ->whereBetween('created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->selectRaw('DATE(created_at) as day, SUM(final_amount) as amount')
            ->groupBy('day')
            ->pluck('amount', 'day');

        $dailyEntries = FinancialEntry::query()
            ->where('status', 'approved')
            ->where('category', '!=', FinancialEntry::CATEGORY_POS_SALE)
            ->where('category', '!=', FinancialEntry::CATEGORY_STOCK_RECEIPT)
            ->where($entryLocationScope)
            ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()])
            ->selectRaw('entry_date as day, type, SUM(amount) as amount')
            ->groupBy('entry_date', 'type')
            ->get();

        $dailyCosts = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.payment_status', 'paid')
            ->where(function ($query) use ($location, $accessibleLocationIds, $request) {
                $query->whereIn('orders.location_id', $location ? [$location->id] : $accessibleLocationIds);
                if (! $location && $request->user()->isSuperAdmin()) {
                    $query->orWhereNull('orders.location_id');
                }
            })
            ->whereBetween('orders.created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->selectRaw('DATE(orders.created_at) as day, COALESCE(SUM((order_items.cost_price * order_items.quantity) + order_items.foc_cost_price), 0) as amount')
            ->groupBy('day')
            ->pluck('amount', 'day');

        $trend = $this->makeTrend($from, $to, $dailyOrders, $dailyEntries, $dailyCosts);

        return Spa::render('Admin/Finance/Index', [
            'entries' => $entryQuery->paginate(15)
                ->withQueryString()
                ->through(fn (FinancialEntry $entry) => array_merge($entry->toArray(), [
                    'is_stock_receipt_entry' => $entry->isStockReceiptEntry(),
                    'is_system_managed' => $entry->isSystemManaged(),
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
                'location_id' => $location?->id,
            ],
            'options' => [
                'categories' => FinancialEntry::categoryOptions(),
                'statuses' => FinancialEntry::STATUSES,
                'types' => FinancialEntry::TYPES,
                'locations' => Location::query()->whereIn('id', $request->user()->accessibleLocationIds())->where('is_active', true)->orderBy('name')->get(['id', 'code', 'name']),
            ],
        ]);
    }

    public function store(Request $request, AuditLogService $auditLogService)
    {
        $payload = $this->validated($request);
        $this->authorizeLocation($request, (int) $payload['location_id']);
        $payload['recorded_by'] = $request->user()->id;

        $entry = FinancialEntry::create($payload);

        $auditLogService->record('finance.entry.created', $entry, [
            'type' => $entry->type,
            'amount' => $entry->amount,
            'title' => $entry->title,
        ], $request);

        if ($request->header('X-SPA') === 'true') {
            return response()->json([
                'success' => true,
                'message' => 'Financial entry created.',
                'entry_id' => $entry->id,
            ]);
        }

        return back()->with('success', 'Financial entry created.');
    }

    public function export(Request $request)
    {
        [$from, $to] = $this->dateRange($request);
        $location = $this->selectedLocation($request);
        $accessibleIds = array_map('intval', $request->user()->accessibleLocationIds());
        $query = FinancialEntry::query()->with(['location:id,code,name', 'recorder:id,name'])
            ->where(function ($locations) use ($location, $accessibleIds, $request) {
                if ($location) return $locations->where('location_id', $location->id);
                $locations->whereIn('location_id', $accessibleIds);
                if ($request->user()->isSuperAdmin()) $locations->orWhereNull('location_id');
            })
            ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()])
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('category'), fn ($q) => $q->where('category', $request->string('category')))
            ->when($request->filled('q'), function ($q) use ($request) {
                $term = trim($request->string('q')->toString());
                $q->where(fn ($inner) => $inner->where('title', 'like', "%{$term}%")->orWhere('reference', 'like', "%{$term}%")->orWhere('notes', 'like', "%{$term}%"));
            });

        return response()->streamDownload(function () use ($query) {
            $output = fopen('php://output', 'w');
            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, ['Date', 'Store', 'Type', 'Category', 'Title', 'Amount', 'Payment method', 'Reference', 'Status', 'Recorded by', 'Notes']);
            $query->orderBy('id')->chunkById(500, function ($entries) use ($output) {
                foreach ($entries as $entry) fputcsv($output, [$entry->entry_date?->format('Y-m-d'), $entry->location?->name ?: 'Overall', $entry->type, $entry->category, $entry->title, $entry->amount, $entry->payment_method, $entry->reference, $entry->status, $entry->recorder?->name, $entry->notes]);
            });
            fclose($output);
        }, 'finance-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function update(Request $request, FinancialEntry $entry, AuditLogService $auditLogService)
    {
        $this->authorizeEntryLocation($request, $entry);
        if ($entry->isSystemManaged()) {
            return back()->with('error', 'This ledger entry is managed from its inventory document.');
        }

        $payload = $this->validated($request);
        $this->authorizeLocation($request, (int) $payload['location_id']);
        $entry->update($payload);

        $auditLogService->record('finance.entry.updated', $entry, [
            'type' => $entry->type,
            'amount' => $entry->amount,
            'title' => $entry->title,
        ], $request);

        if ($request->header('X-SPA') === 'true') {
            return response()->json([
                'success' => true,
                'message' => 'Financial entry updated.',
                'entry_id' => $entry->id,
            ]);
        }

        return back()->with('success', 'Financial entry updated.');
    }

    public function destroy(Request $request, FinancialEntry $entry, AuditLogService $auditLogService)
    {
        $this->authorizeEntryLocation($request, $entry);
        if ($entry->isSystemManaged()) {
            return back()->with('error', 'This ledger entry is managed from its inventory document.');
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
            'location_id' => ['required', 'integer', 'exists:locations,id'],
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

    private function selectedLocation(Request $request): ?Location
    {
        if (! $request->filled('location_id')) {
            return null;
        }

        $location = Location::findOrFail((int) $request->input('location_id'));
        $this->authorizeLocation($request, $location->id);

        return $location;
    }

    private function authorizeLocation(Request $request, int $locationId): void
    {
        abort_unless(in_array($locationId, array_map('intval', $request->user()->accessibleLocationIds()), true), 403);
    }

    private function authorizeEntryLocation(Request $request, FinancialEntry $entry): void
    {
        if ($entry->location_id === null) {
            abort_unless($request->user()->isSuperAdmin(), 403);

            return;
        }

        $this->authorizeLocation($request, (int) $entry->location_id);
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

    private function makeTrend(Carbon $from, Carbon $to, $dailyOrders, $dailyEntries, $dailyCosts): array
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
            $costOfGoods = (float) ($dailyCosts[$day] ?? 0);

            $days[] = [
                'day' => $day,
                'income' => round($income, 2),
                'expenses' => round($expenses, 2),
                'net' => round($income - $costOfGoods - $expenses, 2),
            ];

            $cursor->addDay();
        }

        return $days;
    }
}
