<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Services\AuditLogService;
use Illuminate\Support\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use App\Support\Spa;

class CouponController extends Controller
{
    public function index(Request $request)
    {
        $query = Coupon::query()->latest();

        if ($request->filled('q')) {
            $query->where('code', 'like', '%'.strtoupper(trim($request->q)).'%');
        }

        if ($request->filled('status')) {
            match ($request->status) {
                'active' => $query
                    ->where('is_active', true)
                    ->where(fn ($query) => $query->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
                    ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>=', now()))
                    ->where(fn ($query) => $query->whereNull('usage_limit')->orWhereColumn('used_count', '<', 'usage_limit')),
                'scheduled' => $query
                    ->where('is_active', true)
                    ->where('starts_at', '>', now())
                    ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>=', now()))
                    ->where(fn ($query) => $query->whereNull('usage_limit')->orWhereColumn('used_count', '<', 'usage_limit')),
                'expired' => $query
                    ->where('is_active', true)
                    ->whereNotNull('expires_at')
                    ->where('expires_at', '<', now()),
                'exhausted' => $query
                    ->where('is_active', true)
                    ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>=', now()))
                    ->whereNotNull('usage_limit')
                    ->whereColumn('used_count', '>=', 'usage_limit'),
                'inactive' => $query->where('is_active', false),
                default => null,
            };
        }

        return Spa::render('Admin/Coupons/Index', [
            'coupons' => $query->paginate(15)->withQueryString(),
            'filters' => [
                'q' => $request->string('q')->toString(),
                'status' => $request->string('status')->toString(),
            ],
        ]);
    }

    public function store(Request $request, AuditLogService $auditLogService)
    {
        $coupon = Coupon::create($this->validated($request));
        $auditLogService->record('coupon.created', $coupon, ['code' => $coupon->code], $request);

        return back()->with('success', 'Coupon created.');
    }

    public function update(Request $request, Coupon $coupon, AuditLogService $auditLogService)
    {
        $coupon->update($this->validated($request, $coupon));
        $auditLogService->record('coupon.updated', $coupon, ['code' => $coupon->code], $request);

        return back()->with('success', 'Coupon updated.');
    }

    public function destroy(Request $request, Coupon $coupon, AuditLogService $auditLogService)
    {
        if ($coupon->used_count > 0) {
            $coupon->update(['is_active' => false]);
            $auditLogService->record('coupon.deactivated', $coupon, ['code' => $coupon->code], $request);

            return back()->with('success', 'Coupon has usage history, so it was deactivated.');
        }

        $auditLogService->record('coupon.deleted', $coupon, ['code' => $coupon->code], $request);
        $coupon->delete();

        return back()->with('success', 'Coupon deleted.');
    }

    private function validated(Request $request, ?Coupon $coupon = null): array
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:50', Rule::unique('coupons', 'code')->ignore($coupon?->id)],
            'type' => ['required', Rule::in(['percentage', 'fixed'])],
            'value' => ['required', 'numeric', 'min:0.01'],
            'min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'usage_limit' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['required', 'boolean'],
        ]);

        $validated['code'] = strtoupper(trim($validated['code']));
        $validated['min_order_amount'] = $validated['min_order_amount'] ?? 0;
        $validated['starts_at'] = $this->normalizedBoundary($validated['starts_at'] ?? null, false);
        $validated['expires_at'] = $this->normalizedBoundary($validated['expires_at'] ?? null, true);

        if ($validated['type'] === 'percentage' && (float) $validated['value'] > 100) {
            throw ValidationException::withMessages([
                'value' => 'Percentage discounts cannot exceed 100%.',
            ]);
        }

        return $validated;
    }

    private function normalizedBoundary(?string $value, bool $endOfDay): ?Carbon
    {
        if (! $value) {
            return null;
        }

        $date = Carbon::parse($value);

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            $date = $endOfDay ? $date->endOfDay() : $date->startOfDay();
        }

        return $date->utc();
    }
}
