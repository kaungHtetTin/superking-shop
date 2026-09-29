<?php

namespace App\Services\POS;

use App\Models\Location;
use App\Models\Payment;
use App\Models\PosRegister;
use App\Models\PosShift;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PosShiftService
{
    public function active(User $cashier, Location $location): ?PosShift
    {
        return PosShift::query()
            ->with(['register:id,location_id,code,name', 'location:id,code,name'])
            ->where('cashier_id', $cashier->id)
            ->where('location_id', $location->id)
            ->where('status', 'open')
            ->whereNull('closed_at')
            ->first();
    }

    public function open(User $cashier, Location $location, PosRegister $register, float $openingCash, ?string $notes = null): PosShift
    {
        if ((int) $register->location_id !== (int) $location->id || ! $register->is_active) {
            throw ValidationException::withMessages(['register_id' => 'Choose an active register at this warehouse.']);
        }

        try {
            return DB::transaction(function () use ($cashier, $location, $register, $openingCash, $notes) {
                $existing = PosShift::query()->where('cashier_id', $cashier->id)
                    ->where('status', 'open')->whereNull('closed_at')->lockForUpdate()->first();
                if ($existing) {
                    throw ValidationException::withMessages(['shift' => 'Close your active cash shift before opening one at another warehouse.']);
                }

                return PosShift::create([
                    'pos_register_id' => $register->id,
                    'location_id' => $location->id,
                    'cashier_id' => $cashier->id,
                    'status' => 'open',
                    'open_slot' => 1,
                    'opening_cash' => round($openingCash, 2),
                    'expected_cash' => round($openingCash, 2),
                    'opened_at' => now(),
                    'opening_notes' => $notes,
                ])->load(['register:id,location_id,code,name', 'location:id,code,name']);
            }, 3);
        } catch (QueryException $exception) {
            if (in_array((string) $exception->getCode(), ['23000', '23505'], true)) {
                throw ValidationException::withMessages(['shift' => 'A shift was already opened for this cashier and warehouse.']);
            }
            throw $exception;
        }
    }

    public function lockForSale(int $shiftId, User $cashier, Location $location): PosShift
    {
        $shift = PosShift::query()->whereKey($shiftId)->lockForUpdate()->first();
        if (! $shift || (int) $shift->cashier_id !== (int) $cashier->id || (int) $shift->location_id !== (int) $location->id
            || $shift->status !== 'open' || $shift->closed_at !== null) {
            throw ValidationException::withMessages(['shift_id' => 'This cash shift is closed or unavailable. Refresh POS and open a shift before making another sale.']);
        }

        return $shift;
    }

    public function close(PosShift $shift, User $cashier, float $countedCash, ?string $notes = null): PosShift
    {
        return DB::transaction(function () use ($shift, $cashier, $countedCash, $notes) {
            $locked = PosShift::query()->whereKey($shift->id)->lockForUpdate()->firstOrFail();
            if ((int) $locked->cashier_id !== (int) $cashier->id || $locked->status !== 'open' || $locked->closed_at !== null) {
                throw ValidationException::withMessages(['shift' => 'This shift has already been closed or does not belong to you.']);
            }

            $totals = $this->totals($locked);
            $expected = round((float) $locked->opening_cash + $totals['net_cash_sales'], 2);
            $counted = round($countedCash, 2);
            $locked->update(array_merge($totals, [
                'cash_sales' => $totals['net_cash_sales'],
                'expected_cash' => $expected,
                'counted_cash' => $counted,
                'variance' => round($counted - $expected, 2),
                'closing_notes' => $notes,
                'closed_by_user_id' => $cashier->id,
                'closed_at' => now(),
                'status' => 'closed',
                'open_slot' => null,
            ]));

            return $locked->fresh(['register:id,location_id,code,name', 'location:id,code,name']);
        }, 3);
    }

    public function summary(PosShift $shift): array
    {
        $totals = $this->totals($shift);
        return array_merge($shift->toArray(), $totals, [
            'expected_cash' => round((float) $shift->opening_cash + $totals['net_cash_sales'], 2),
        ]);
    }

    private function totals(PosShift $shift): array
    {
        $payments = Payment::query()->where('shift_id', $shift->id)->where('payments.status', 'paid')
            ->whereHas('order', fn ($query) => $query->whereNotIn('status', ['cancelled', 'void']))->get();
        $cash = $payments->where('tender_type', 'cash');

        return [
            'cash_received_total' => round((float) $cash->sum(fn ($payment) => (float) ($payment->amount_tendered ?? $payment->amount)), 2),
            'change_given_total' => round((float) $cash->sum('change_due'), 2),
            'net_cash_sales' => round((float) $cash->sum(fn ($payment) => (float) ($payment->amount_tendered ?? $payment->amount) - (float) $payment->change_due), 2),
            'card_sales_total' => round((float) $payments->where('tender_type', 'card')->sum('amount'), 2),
            'mobile_sales_total' => round((float) $payments->where('tender_type', 'mobile')->sum('amount'), 2),
            'mmqr_sales_total' => round((float) $payments->where('tender_type', 'mmqr')->sum('amount'), 2),
            'sale_count' => $payments->pluck('order_id')->unique()->count(),
        ];
    }
}
