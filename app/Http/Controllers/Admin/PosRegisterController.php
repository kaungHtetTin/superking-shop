<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\PosRegister;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Support\Spa;

class PosRegisterController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->hasAdminPermission('registers.manage'), 403);

        return Spa::render('Admin/Registers/Index', [
            'registers' => PosRegister::query()
                ->whereIn('location_id', $request->user()->accessibleLocationIds())
                ->with(['location:id,code,name,type'])
                ->orderBy('code')
                ->get(),
            'locations' => Location::query()
                ->whereIn('id', $request->user()->accessibleLocationIds())
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'code', 'name', 'type']),
        ]);
    }

    public function store(Request $request, AuditLogService $audit): \Illuminate\Http\RedirectResponse
    {
        abort_unless($request->user()->hasAdminPermission('registers.manage'), 403);
        $validated = $this->validated($request);

        $register = PosRegister::create($validated);
        $audit->record('pos.register.created', $register, ['code' => $register->code], $request);

        $this->clearPreviousErrors($request);

        return redirect()->route('admin.registers.index', [], 303)->with('success', 'Register created.');
    }

    public function update(Request $request, PosRegister $register, AuditLogService $audit): \Illuminate\Http\RedirectResponse
    {
        abort_unless($request->user()->hasAdminPermission('registers.manage'), 403);
        $validated = $this->validated($request, $register);
        abort_unless(in_array((int) $register->location_id, array_map('intval', $request->user()->accessibleLocationIds()), true), 403);

        $register->update($validated);
        $audit->record('pos.register.updated', $register, ['code' => $register->code], $request);

        $this->clearPreviousErrors($request);

        return redirect()->route('admin.registers.index', [], 303)->with('success', 'Register updated.');
    }

    private function validated(Request $request, ?PosRegister $register = null): array
    {
        return $request->validate([
            'location_id' => ['required', 'integer', Rule::in($request->user()->accessibleLocationIds()), Rule::exists('locations', 'id')->where('is_active', true)],
            'code' => ['required', 'string', 'max:50', 'regex:/^[A-Za-z0-9-]+$/', Rule::unique('pos_registers', 'code')->ignore($register?->id)],
            'name' => ['required', 'string', 'max:255'],
            'is_active' => ['required', 'boolean'],
        ]);
    }

    private function clearPreviousErrors(Request $request): void
    {
        $request->session()->forget(['error', 'errors']);
    }
}
