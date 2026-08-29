<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\User;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use App\Support\Spa;

class LocationController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', Location::class);

        $canManage = $request->user()->hasAdminPermission('locations.manage');
        $locationQuery = Location::query();
        if (! $canManage) {
            $locationQuery->whereHas('users', fn ($query) => $query->whereKey($request->user()->id));
        }

        $locations = $locationQuery
            ->with(['users' => fn ($query) => $query->select('users.id', 'name', 'email', 'role')->with('roles:id,name,display_name,is_admin')])
            ->withCount('balances')
            ->withSum('balances as on_hand_total', 'on_hand_qty')
            ->orderBy('name')
            ->get()
            ->map(fn (Location $location) => [
                'id' => $location->id,
                'code' => $location->code,
                'name' => $location->name,
                'type' => $location->type,
                'address' => $location->address,
                'phone' => $location->phone,
                'timezone' => $location->timezone,
                'is_active' => $location->is_active,
                'is_default_fulfillment' => $location->is_default_fulfillment,
                'is_system' => $location->is_system,
                'balances_count' => $location->balances_count,
                'on_hand_total' => (int) ($location->on_hand_total ?? 0),
                'staff_ids' => $location->users->pluck('id')->all(),
                'staff' => $location->users->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'role_label' => $user->adminRoleLabel(),
                    'is_default' => (bool) $user->pivot->is_default,
                ])->values(),
            ]);

        $staff = $canManage
            ? User::adminStaff()
                ->with('roles:id,name,display_name,is_admin')
                ->where('status', 'active')
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'role'])
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role_label' => $user->adminRoleLabel(),
                ])
            : collect();

        return Spa::render('Admin/Locations/Index', [
            'locations' => $locations,
            'staff' => $staff,
            'canManage' => $canManage,
        ]);
    }

    public function store(Request $request, AuditLogService $auditLogService)
    {
        $this->authorize('create', Location::class);
        $validated = $this->validateLocation($request);

        $location = DB::transaction(function () use ($validated) {
            $this->prepareDefaultFulfillment($validated);

            $location = Location::create($this->locationPayload($validated));
            $this->syncStaff($location, $validated['staff_ids'] ?? []);

            return $location;
        });

        $auditLogService->record('location.created', $location, [
            'code' => $location->code,
            'type' => $location->type,
            'staff_ids' => $validated['staff_ids'] ?? [],
        ], $request);

        return back()->with('success', 'Warehouse created successfully.');
    }

    public function update(Request $request, Location $location, AuditLogService $auditLogService)
    {
        $this->authorize('update', $location);
        $validated = $this->validateLocation($request, $location);

        DB::transaction(function () use ($validated, $location) {
            $this->prepareDefaultFulfillment($validated, $location);
            $location->update($this->locationPayload($validated, $location));
            $this->syncStaff($location, $validated['staff_ids'] ?? []);
        });

        $auditLogService->record('location.updated', $location, [
            'code' => $location->code,
            'type' => $location->type,
            'staff_ids' => $validated['staff_ids'] ?? [],
        ], $request);

        return back()->with('success', 'Warehouse updated successfully.');
    }

    public function destroy(Request $request, Location $location, AuditLogService $auditLogService)
    {
        $this->authorize('delete', $location);

        if ($location->balances()->exists() || $location->imports()->exists()) {
            return back()->with('error', 'This warehouse has inventory history and cannot be deleted. Deactivate it instead.');
        }

        if ($location->is_default_fulfillment) {
            return back()->with('error', 'Choose another default fulfillment warehouse before deleting this one.');
        }

        $auditLogService->record('location.deleted', $location, [
            'code' => $location->code,
            'type' => $location->type,
        ], $request);
        $location->delete();

        return back()->with('success', 'Warehouse deleted.');
    }

    private function validateLocation(Request $request, ?Location $location = null): array
    {
        return $request->validate([
            'code' => ['required', 'string', 'max:50', 'regex:/^[A-Za-z0-9-]+$/', Rule::unique('locations', 'code')->ignore($location?->id)],
            'name' => ['required', 'string', 'max:255'],
            'type' => ['nullable', Rule::in(Location::TYPES)],
            'address' => ['nullable', 'string', 'max:2000'],
            'phone' => ['nullable', 'string', 'max:30'],
            'timezone' => ['required', 'timezone'],
            'is_active' => ['required', 'boolean'],
            'is_default_fulfillment' => ['required', 'boolean'],
            'staff_ids' => ['nullable', 'array'],
            'staff_ids.*' => ['integer', Rule::exists('users', 'id')],
        ]);
    }

    private function locationPayload(array $validated, ?Location $location = null): array
    {
        return [
            'code' => $location?->is_system ? $location->code : strtoupper($validated['code']),
            'name' => $validated['name'],
            'type' => 'warehouse',
            'address' => $validated['address'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'timezone' => $validated['timezone'],
            'is_active' => $validated['is_active'],
            'is_default_fulfillment' => $validated['is_default_fulfillment'],
        ];
    }

    private function prepareDefaultFulfillment(array $validated, ?Location $location = null): void
    {
        if ($validated['is_default_fulfillment'] && ! $validated['is_active']) {
            throw ValidationException::withMessages([
                'is_default_fulfillment' => 'The default fulfillment warehouse must be active.',
            ]);
        }

        if ($validated['is_default_fulfillment']) {
            Location::query()
                ->when($location, fn ($query) => $query->where('id', '!=', $location->id))
                ->update(['is_default_fulfillment' => false]);
            return;
        }

        if ($location?->is_default_fulfillment && ! Location::query()->where('id', '!=', $location->id)->where('is_default_fulfillment', true)->exists()) {
            throw ValidationException::withMessages([
                'is_default_fulfillment' => 'At least one default fulfillment warehouse is required.',
            ]);
        }
    }

    private function syncStaff(Location $location, array $staffIds): void
    {
        $validStaffIds = User::adminStaff()->whereKey($staffIds)->pluck('id')->all();
        if (count($validStaffIds) !== count(array_unique($staffIds))) {
            throw ValidationException::withMessages(['staff_ids' => 'Only staff accounts can be assigned to a warehouse.']);
        }

        $currentDefaults = $location->users()
            ->wherePivot('is_default', true)
            ->pluck('users.id')
            ->all();

        $payload = collect($validStaffIds)
            ->unique()
            ->mapWithKeys(fn ($userId) => [(int) $userId => [
                'is_default' => in_array((int) $userId, $currentDefaults, true),
            ]])
            ->all();

        $location->users()->sync($payload);
    }
}
