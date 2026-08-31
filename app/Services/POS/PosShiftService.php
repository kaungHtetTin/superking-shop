<?php

namespace App\Services\POS;

use App\Models\PosShift;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PosShiftService
{
    public function close(PosShift $shift, User $cashier, float $countedCash, ?string $notes = null): PosShift
    {
        return DB::transaction(function () use ($shift, $cashier, $countedCash, $notes) {
            $locked = PosShift::query()->lockForUpdate()->findOrFail($shift->id);

            if ($locked->status !== 'open') {
                throw ValidationException::withMessages(['shift' => 'Only an open shift can be closed.']);
            }

            if ((int) $locked->cashier_id !== (int) $cashier->id && ! $cashier->hasAdminPermission('pos.void')) {
                throw ValidationException::withMessages(['shift' => 'Only the shift cashier or a manager can close this shift.']);
            }

            $expected = round((float) $locked->opening_cash + (float) $locked->cash_sales - (float) $locked->cash_refunds, 2);
            $locked->update([
                'status' => 'closed',
                'expected_cash' => $expected,
                'counted_cash' => round($countedCash, 2),
                'variance' => round($countedCash - $expected, 2),
                'closed_at' => now(),
                'closing_notes' => $notes,
            ]);

            return $locked->fresh(['register.location', 'cashier:id,name']);
        });
    }
}
