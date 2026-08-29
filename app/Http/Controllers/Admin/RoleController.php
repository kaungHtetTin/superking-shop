<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use App\Services\AuditLogService;
use App\Support\Spa;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    public function index()
    {
        $roles = Role::query()
            ->admin()
            ->with('permissions:id,name,display_name,group')
            ->withCount('users')
            ->orderBy('sort_order')
            ->orderBy('display_name')
            ->get()
            ->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'display_name' => $role->display_name,
                'description' => $role->description,
                'is_system' => $role->is_system,
                'is_locked' => $role->is_system,
                'users_count' => $role->users_count,
                'permissions' => $role->permissions->pluck('name')->sort()->values()->all(),
            ]);

        $permissions = Permission::query()
            ->orderBy('group')
            ->orderBy('display_name')
            ->get(['id', 'name', 'display_name', 'group'])
            ->groupBy('group')
            ->map(fn ($items, string $group) => [
                'group' => $group,
                'items' => $items->map(fn (Permission $permission) => [
                    'value' => $permission->name,
                    'label' => $permission->display_name,
                ])->values()->all(),
            ])
            ->values();

        return Spa::render('Admin/Roles/Index', [
            'roles' => $roles,
            'permissionGroups' => $permissions,
        ]);
    }

    public function store(Request $request, AuditLogService $auditLogService)
    {
        $validated = $this->validateRole($request, true);

        $role = Role::create([
            'name' => $validated['name'],
            'display_name' => $validated['display_name'],
            'description' => $validated['description'] ?? null,
            'is_admin' => true,
            'is_system' => false,
            'sort_order' => (Role::query()->admin()->max('sort_order') ?? 30) + 10,
        ]);

        $role->permissions()->sync($this->permissionIds($validated['permissions'] ?? []));

        $auditLogService->record('role.created', $role, [
            'name' => $role->name,
            'permissions' => $validated['permissions'] ?? [],
        ], $request);

        return back()->with('success', 'Role created successfully.');
    }

    public function update(Request $request, Role $role, AuditLogService $auditLogService)
    {
        abort_unless($role->is_admin, 404);

        if ($role->is_system) {
            return back()->with('error', 'System roles are fixed. Create a custom role when you need different permissions.');
        }

        $validated = $this->validateRole($request, false);

        $role->update([
            'display_name' => $validated['display_name'],
            'description' => $validated['description'] ?? null,
        ]);
        $role->permissions()->sync($this->permissionIds($validated['permissions'] ?? []));

        $auditLogService->record('role.updated', $role, [
            'permissions' => $validated['permissions'] ?? [],
        ], $request);

        return back()->with('success', 'Role permissions updated.');
    }

    public function destroy(Request $request, Role $role, AuditLogService $auditLogService)
    {
        abort_unless($role->is_admin, 404);

        if ($role->is_system) {
            return back()->with('error', 'System roles cannot be deleted.');
        }

        if ($role->users()->exists()) {
            return back()->with('error', 'Move staff to another role before deleting this role.');
        }

        $auditLogService->record('role.deleted', $role, [
            'name' => $role->name,
        ], $request);
        $role->delete();

        return back()->with('success', 'Role deleted.');
    }

    private function validateRole(Request $request, bool $creating): array
    {
        $rules = [
            'display_name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:500'],
            'permissions' => ['array'],
            'permissions.*' => ['string', Rule::exists('permissions', 'name')],
        ];

        if ($creating) {
            $rules['name'] = [
                'required',
                'string',
                'max:80',
                'regex:/^[a-z][a-z0-9_]*$/',
                Rule::notIn(['customer', 'super_admin', 'manager', 'staff']),
                Rule::unique('roles', 'name'),
            ];
        }

        return $request->validate($rules);
    }

    private function permissionIds(array $permissionNames): array
    {
        return Permission::query()->whereIn('name', $permissionNames)->pluck('id')->all();
    }
}
