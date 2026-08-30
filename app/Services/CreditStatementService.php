<?php

namespace App\Services;

use App\Models\CustomerCreditTransaction;
use App\Models\User;
use Carbon\Carbon;
use Dompdf\Dompdf;
use Dompdf\Options;

class CreditStatementService
{
    public function data(User $customer, ?string $from = null, ?string $to = null): array
    {
        $fromDate = Carbon::parse($from ?: now()->subMonths(3)->toDateString())->startOfDay();
        $toDate = Carbon::parse($to ?: now()->toDateString())->endOfDay();
        $opening = (float) CustomerCreditTransaction::where('customer_id', $customer->id)->where('created_at', '<', $fromDate)->sum('amount');
        $transactions = CustomerCreditTransaction::where('customer_id', $customer->id)
            ->with('order:id,order_number,receipt_number')
            ->whereBetween('created_at', [$fromDate, $toDate])
            ->oldest()
            ->get();

        return compact('customer', 'opening', 'transactions') + [
            'from' => $fromDate->toDateString(),
            'to' => $toDate->toDateString(),
            'closing' => round($opening + (float) $transactions->sum('amount'), 2),
            'purchases' => round((float) $transactions->where('amount', '>', 0)->sum('amount'), 2),
            'credits' => round(abs((float) $transactions->where('amount', '<', 0)->sum('amount')), 2),
        ];
    }

    public function pdf(array $data): string
    {
        $options = new Options();
        $options->set('isRemoteEnabled', false);
        $dompdf = new Dompdf($options);
        $dompdf->loadHtml(view('credit.statement', $data)->render());
        $dompdf->setPaper('A4');
        $dompdf->render();
        return $dompdf->output();
    }
}
