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
                ->with(['location:id,code,name,type'])
                ->withCount(['shifts', 'shifts as open_shifts_count' => fn ($query) => $query->where('status', 'open')])
                ->orderBy('code')
                ->get(),
            'locations' => Location::query()
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

        return back()->with('success', 'Register created.');
    }

    public function update(Request $request, PosRegister $register, AuditLogService $audit): \Illuminate\Http\RedirectResponse
    {
        abort_unless($request->user()->hasAdminPermission('registers.manage'), 403);
        $validated = $this->validated($request, $register);

        $register->update($validated);
        $audit->record('pos.register.updated', $register, ['code' => $register->code], $request);

        return back()->with('success', 'Register updated.');
    }

    private function validated(Request $request, ?PosRegister $register = null): array
    {
        return $request->validate([
            'location_id' => ['required', 'integer', Rule::exists('locations', 'id')->where('is_active', true)],
            'code' => ['required', 'string', 'max:50', 'regex:/^[A-Za-z0-9-]+$/', Rule::unique('pos_registers', 'code')->ignore($register?->id)],
            'name' => ['required', 'string', 'max:255'],
            'is_active' => ['required', 'boolean'],
        ]);
    }
}
