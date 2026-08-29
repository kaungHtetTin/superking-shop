<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AuditLogService;
use App\Services\LoyaltySettingsService;
use App\Support\Spa;
use Illuminate\Http\Request;

class PointConfigurationController extends Controller
{
    public function edit(LoyaltySettingsService $loyaltySettings)
    {
        return Spa::render('Admin/Marketing/PointConfiguration', [
            'settings' => $loyaltySettings->all(),
        ]);
    }

    public function update(Request $request, LoyaltySettingsService $loyaltySettings, AuditLogService $auditLogService)
    {
        $validated = $request->validate([
            'is_enabled' => ['required', 'boolean'],
            'earn_points_per_currency' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'redeem_currency_per_point' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'minimum_redeem_points' => ['required', 'integer', 'min:0', 'max:100000000'],
        ]);

        $before = $loyaltySettings->all();
        $loyaltySettings->setMany($validated);

        $auditLogService->record('loyalty.point_configuration_updated', null, [
            'before' => $before,
            'after' => $loyaltySettings->all(),
        ], $request);

        return back()->with('success', 'Point configuration updated.');
    }
}
