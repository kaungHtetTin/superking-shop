<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CustomerCreditTransaction;
use App\Models\Order;
use App\Support\Spa;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class CreditReportController extends Controller
{
    public function index(Request $request)
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'bucket' => ['nullable', 'in:all,current,1_30,31_60,61_90,90_plus'],
        ]);
        $bucket = $filters['bucket'] ?? 'all';
        $base = $this->openOrders();
        $filtered = $this->applyBucket(clone $base, $bucket);

        $customers = $filtered
            ->join('users', 'users.id', '=', 'orders.user_id')
            ->when($filters['q'] ?? null, function ($query, $search) {
                $term = '%'.trim($search).'%';
                $query->where(fn ($nested) => $nested->where('users.name', 'like', $term)->orWhere('users.email', 'like', $term)->orWhere('users.phone', 'like', $term));
            })
            ->groupBy('users.id', 'users.name', 'users.email', 'users.phone', 'users.credit_limit', 'users.credit_status')
            ->orderByDesc('outstanding')
            ->selectRaw('users.id, users.name, users.email, users.phone, users.credit_limit, users.credit_status, SUM(orders.final_amount - orders.paid_amount) outstanding, SUM(CASE WHEN orders.credit_due_date < CURRENT_DATE THEN orders.final_amount - orders.paid_amount ELSE 0 END) overdue, MIN(orders.credit_due_date) oldest_due_date, COUNT(*) invoice_count')
            ->paginate(20)
            ->withQueryString();

        $aging = [
            'current' => $this->bucketTotal('current'),
            'days_1_30' => $this->bucketTotal('1_30'),
            'days_31_60' => $this->bucketTotal('31_60'),
            'days_61_90' => $this->bucketTotal('61_90'),
            'days_90_plus' => $this->bucketTotal('90_plus'),
        ];

        return Spa::render('Admin/Credit/Index', [
            'customers' => $customers,
            'filters' => ['q' => $filters['q'] ?? '', 'bucket' => $bucket],
            'aging' => $aging + ['total' => array_sum($aging)],
            'collections' => CustomerCreditTransaction::query()->when(! $request->user()->isSuperAdmin(), fn ($query) => $query->whereHas('order', fn ($orders) => $orders->whereIn('location_id', $request->user()->accessibleLocationIds())))->where('type', 'payment')->where('created_at', '>=', now()->subDays(30))->selectRaw('DATE(created_at) day, ABS(SUM(amount)) amount, COUNT(*) payments')->groupBy('day')->orderBy('day')->get(),
        ]);
    }

    public function export(Request $request)
    {
        $bucket = $request->string('bucket')->toString() ?: 'all';
        abort_unless(in_array($bucket, ['all', 'current', '1_30', '31_60', '61_90', '90_plus'], true), 422);
        $rows = $this->applyBucket($this->openOrders(), $bucket)
            ->join('users', 'users.id', '=', 'orders.user_id')
            ->groupBy('users.id', 'users.name', 'users.email', 'users.phone', 'users.credit_limit', 'users.credit_status')
            ->orderByDesc('outstanding')
            ->selectRaw('users.name, users.email, users.phone, users.credit_limit, users.credit_status, SUM(orders.final_amount - orders.paid_amount) outstanding, SUM(CASE WHEN orders.credit_due_date < CURRENT_DATE THEN orders.final_amount - orders.paid_amount ELSE 0 END) overdue, MIN(orders.credit_due_date) oldest_due_date, COUNT(*) invoice_count')->cursor();

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Customer', 'Email', 'Phone', 'Status', 'Credit limit', 'Outstanding', 'Overdue', 'Oldest due', 'Invoices']);
            foreach ($rows as $row) fputcsv($out, [$row->name, $row->email, $row->phone, $row->credit_status, $row->credit_limit, $row->outstanding, $row->overdue, $row->oldest_due_date, $row->invoice_count]);
            fclose($out);
        }, 'credit-aging-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv']);
    }

    private function openOrders(): Builder
    {
        return Order::query()->whereIn('orders.location_id', request()->user()->accessibleLocationIds())->where('orders.credit_amount', '>', 0)->where('orders.status', '!=', 'cancelled')->whereRaw('orders.final_amount > orders.paid_amount');
    }

    private function applyBucket(Builder $query, string $bucket): Builder
    {
        return match ($bucket) {
            'current' => $query->where(fn ($q) => $q->whereNull('credit_due_date')->orWhereDate('credit_due_date', '>=', now()->toDateString())),
            '1_30' => $query->whereRaw('DATEDIFF(CURRENT_DATE, credit_due_date) BETWEEN 1 AND 30'),
            '31_60' => $query->whereRaw('DATEDIFF(CURRENT_DATE, credit_due_date) BETWEEN 31 AND 60'),
            '61_90' => $query->whereRaw('DATEDIFF(CURRENT_DATE, credit_due_date) BETWEEN 61 AND 90'),
            '90_plus' => $query->whereRaw('DATEDIFF(CURRENT_DATE, credit_due_date) > 90'),
            default => $query,
        };
    }

    private function bucketTotal(string $bucket): float
    {
        return round((float) $this->applyBucket($this->openOrders(), $bucket)->selectRaw('COALESCE(SUM(final_amount - paid_amount), 0) total')->value('total'), 2);
    }
}
