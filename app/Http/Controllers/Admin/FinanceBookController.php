<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\FinancialEntry;
use App\Models\Location;
use App\Services\AuditLogService;
use App\Support\Spa;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class FinanceBookController extends Controller
{
    public function index(Request $request)
    {
        $ids = $request->user()->accessibleLocationIds();
        $filters = $request->validate(['location_id' => ['nullable', 'integer', Rule::in($ids)], 'date' => ['nullable', 'date_format:Y-m-d']]);
        $date = $filters['date'] ?? now('Asia/Bangkok')->toDateString();
        $filters['date'] = $date;
        $locations = Location::whereIn('id', $ids)->orderBy('name')->get(['id', 'name', 'code']);
        if (! empty($filters['location_id'])) $ids = [(int) $filters['location_id']];
        $counts = DB::table('finance_book_counts')->whereIn('location_id', $ids)->whereDate('entry_date', $date)->get()->keyBy('location_id');
        $funds = DB::table('finance_book_funds')->whereIn('location_id', $ids)
            ->whereDate('entry_date', $date)
            ->selectRaw('location_id, SUM(amount) total')->groupBy('location_id')->pluck('total', 'location_id');
        $expenses = FinancialEntry::query()->external()->whereIn('location_id', $ids)
            ->whereDate('entry_date', $date)
            ->where('type', 'expense')->where('status', 'approved')
            ->whereNotIn('category', [FinancialEntry::CATEGORY_REFUND_PAYABLE, FinancialEntry::CATEGORY_STOCK_ADJUSTMENT])
            ->selectRaw('location_id, SUM(amount) total')->groupBy('location_id')->pluck('total', 'location_id');

        return Spa::render('Admin/FinanceBook/Index', [
            'locations' => $locations,
            'filters' => $filters,
            'books' => Location::whereIn('id', $ids)->orderBy('name')->paginate(12)->withQueryString()->through(function ($location) use ($funds, $expenses, $counts) {
                $capital = (float) ($funds[$location->id] ?? 0);
                $spent = (float) ($expenses[$location->id] ?? 0);
                return ['id' => $location->id, 'name' => $location->name, 'code' => $location->code,
                    'capital' => $capital, 'expenses' => $spent, 'balance' => round($capital - $spent, 2),
                    'actual_balance' => isset($counts[$location->id]) ? (float) $counts[$location->id]->actual_balance : null,
                    'count_notes' => $counts[$location->id]->notes ?? ''];
            }),
            'funds' => DB::table('finance_book_funds')->join('locations', 'locations.id', '=', 'finance_book_funds.location_id')
                ->whereIn('location_id', $ids)->whereDate('entry_date', $date)->orderByDesc('finance_book_funds.id')
                ->select('finance_book_funds.*', 'locations.name as branch_name')->paginate(20, ['*'], 'funds_page')->withQueryString(),
        ]);
    }

    public function store(Request $request, AuditLogService $audit)
    {
        $data = $request->validate([
            'location_id' => ['required', 'integer', Rule::in($request->user()->accessibleLocationIds())],
            'entry_date' => ['required', 'date_format:Y-m-d'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:9999999999999999.99', 'decimal:0,2'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
        DB::transaction(function () use ($data, $request, $audit) {
            DB::table('finance_book_funds')->insert($data + ['recorded_by' => $request->user()->id, 'created_at' => now(), 'updated_at' => now()]);
            $audit->record('finance.book.funded', Location::findOrFail($data['location_id']), ['amount' => $data['amount'], 'notes' => $data['notes'] ?? null], $request);
        });
        return back()->with('success', 'Expense fund added.');
    }

    public function saveCount(Request $request, AuditLogService $audit)
    {
        $data = $request->validate([
            'location_id' => ['required', 'integer', Rule::in($request->user()->accessibleLocationIds())],
            'entry_date' => ['required', 'date_format:Y-m-d'],
            'actual_balance' => ['required', 'numeric', 'min:0', 'max:999999999999999.99', 'decimal:0,2'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
        DB::transaction(function () use ($data, $request, $audit) {
            DB::table('finance_book_counts')->upsert([$data + ['recorded_by' => $request->user()->id, 'created_at' => now(), 'updated_at' => now()]], ['location_id', 'entry_date'], ['actual_balance', 'notes', 'recorded_by', 'updated_at']);
            $audit->record('finance.book.counted', Location::findOrFail($data['location_id']), $data, $request);
        });
        return back()->with('success', 'Actual cash balance saved.');
    }

    public function destroyFund(Request $request, int $fund, AuditLogService $audit)
    {
        $fundRecord = DB::table('finance_book_funds')->where('id', $fund)->first();
        abort_unless($fundRecord, 404);
        $location = Location::findOrFail($fundRecord->location_id);
        abort_unless($request->user()->canAccessLocation($location), 403);

        $hasApprovedExpenses = FinancialEntry::query()->external()
            ->where('location_id', $location->id)
            ->whereDate('entry_date', $fundRecord->entry_date)
            ->where('type', 'expense')
            ->where('status', 'approved')
            ->whereNotIn('category', [FinancialEntry::CATEGORY_REFUND_PAYABLE, FinancialEntry::CATEGORY_STOCK_ADJUSTMENT])
            ->exists();

        if ($hasApprovedExpenses) {
            if ($request->header('X-SPA') === 'true') {
                return response()->json([
                    'errors' => ['fund' => 'Delete this branch\'s approved expenses for the selected date first.'],
                ], 409);
            }

            return back()->with('error', 'Delete this branch\'s approved expenses for the selected date first.');
        }

        DB::transaction(function () use ($fundRecord, $location, $request, $audit) {
            DB::table('finance_book_funds')->where('id', $fundRecord->id)->delete();
            $audit->record('finance.book.deleted', $location, [
                'entry_date' => $fundRecord->entry_date,
                'fund_id' => $fundRecord->id,
                'amount' => $fundRecord->amount,
            ], $request);
        });

        if ($request->header('X-SPA') === 'true') {
            return response()->json([
                'success' => true,
                'message' => 'Funding record deleted.',
                'fund_id' => $fundRecord->id,
            ]);
        }

        return back()->with('success', 'Funding record deleted.');
    }
}
