<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Notifications\StaffWelcomeNotification;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use App\Support\Spa;

class AdminUserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::adminStaff()->with('roles:id,name,display_name,is_admin')->latest();

        if ($request->filled('q')) {
            $term = '%'.$request->string('q')->trim().'%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)->orWhere('email', 'like', $term);
            });
        }

        if ($request->filled('role') && Role::query()->admin()->where('name', $request->role)->exists()) {
            $query->where(function ($query) use ($request) {
                $query->whereHas('roles', fn ($roleQuery) => $roleQuery->where('name', $request->role))
                    ->orWhere('role', $request->role);
            });
        }

        if ($request->filled('status') && in_array($request->status, ['active', 'suspended'], true)) {
            $query->where('status', $request->status);
        }

        $roles = collect(User::adminRoleOptions());
        if (! $request->user()->isSuperAdmin()) {
            $roles = $roles->reject(fn (array $role) => $role['value'] === 'super_admin')->values();
        }

        return Spa::render('Admin/Users/Index', [
            'users' => $query
                ->get(['id', 'name', 'email', 'phone', 'role', 'status', 'created_at', 'updated_at'])
                ->map(function (User $user) {
                    $user->setAttribute('role', $user->adminRoleName());
                    $user->setAttribute('role_label', $user->adminRoleLabel());

                    return $user;
                }),
            'filters' => [
                'q' => $request->string('q')->toString(),
                'role' => $request->string('role')->toString(),
                'status' => $request->string('status')->toString(),
            ],
            'roles' => $roles,
        ]);
    }

    public function store(Request $request, AuditLogService $auditLogService)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'role' => ['required', Rule::exists('roles', 'name')->where(fn ($query) => $query->where('is_admin', true))],
            'status' => ['required', Rule::in(['active', 'suspended'])],
        ]);

        $plainPassword = $validated['password'];
        $this->ensureRoleAssignmentAllowed($request->user(), $validated['role']);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'password' => Hash::make($plainPassword),
            'role' => $validated['role'],
            'status' => $validated['status'],
            'permissions' => [],
            'email_verified_at' => now(),
        ]);
        $user->syncAdminRole($validated['role']);

        try {
            $user->notify(new StaffWelcomeNotification($plainPassword));
        } catch (\Throwable $e) {
            report($e);
        }
        $auditLogService->record('staff.created', $user, [
            'role' => $user->role,
        ], $request);

        return redirect()->back()->with('success', 'Staff account created successfully.');
    }

    public function update(Request $request, User $user, AuditLogService $auditLogService)
    {
        $this->ensureStaffUser($user);
        $actor = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['nullable', 'confirmed', Password::min(8)],
            'role' => ['required', Rule::exists('roles', 'name')->where(fn ($query) => $query->where('is_admin', true))],
            'status' => ['required', Rule::in(['active', 'suspended'])],
        ]);

        $this->ensureRoleAssignmentAllowed($actor, $validated['role'], $user);

        if ($user->id === $actor->id) {
            if ($validated['role'] !== $user->adminRoleName()) {
                return redirect()->back()->withErrors(['role' => 'You cannot change your own role.']);
            }
            if ($validated['status'] !== 'active') {
                return redirect()->back()->withErrors(['status' => 'You cannot suspend your own account.']);
            }
        }

        if ($user->isSuperAdmin() && $validated['role'] !== 'super_admin') {
            $otherSuperAdmins = $this->superAdminQuery()
                ->where('id', '!=', $user->id)
                ->count();

            if ($otherSuperAdmins === 0) {
                return redirect()->back()->withErrors(['role' => 'At least one Super Admin must remain.']);
            }
        }

        $payload = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'role' => $validated['role'],
            'status' => $validated['status'],
            'permissions' => [],
        ];

        if (! empty($validated['password'])) {
            $payload['password'] = Hash::make($validated['password']);
        }

        $user->update($payload);
        $user->syncAdminRole($validated['role']);
        $auditLogService->record('staff.updated', $user, [
            'role' => $user->role,
            'status' => $user->status,
        ], $request);

        return redirect()->back()->with('success', 'Staff account updated successfully.');
    }

    public function toggleStatus(Request $request, User $user, AuditLogService $auditLogService)
    {
        $this->ensureStaffUser($user);
        $actor = $request->user();
        $this->ensureRoleAssignmentAllowed($actor, $user->adminRoleName(), $user);

        if ($user->id === $actor->id) {
            return redirect()->back()->with('error', 'You cannot change your own account status.');
        }

        if ($user->isSuperAdmin() && $user->status === 'active') {
            $otherActiveSuperAdmins = $this->superAdminQuery()
                ->where('status', 'active')
                ->where('id', '!=', $user->id)
                ->count();

            if ($otherActiveSuperAdmins === 0) {
                return redirect()->back()->with('error', 'At least one active Super Admin must remain.');
            }
        }

        $user->update([
            'status' => $user->status === 'active' ? 'suspended' : 'active',
        ]);

        $auditLogService->record('staff.status_toggled', $user, [
            'status' => $user->status,
        ], $request);

        return redirect()->back()->with('success', 'Account status updated.');
    }

    public function destroy(Request $request, User $user, AuditLogService $auditLogService)
    {
        $this->ensureStaffUser($user);
        $actor = $request->user();
        $this->ensureRoleAssignmentAllowed($actor, $user->adminRoleName(), $user);

        if ($user->id === $actor->id) {
            return redirect()->back()->with('error', 'You cannot delete your own account.');
        }

        if ($user->isSuperAdmin()) {
            $otherSuperAdmins = $this->superAdminQuery()
                ->where('id', '!=', $user->id)
                ->count();

            if ($otherSuperAdmins === 0) {
                return redirect()->back()->with('error', 'At least one Super Admin must remain.');
            }
        }

        $auditLogService->record('staff.deleted', $user, [
            'role' => $user->role,
            'email' => $user->email,
        ], $request);
        $user->delete();

        return redirect()->back()->with('success', 'Staff account removed.');
    }

    private function ensureStaffUser(User $user): void
    {
        abort_unless($user->isAdminStaff(), 404);
    }

    private function superAdminQuery()
    {
        return User::adminStaff()->where(function ($query) {
            $query->whereHas('roles', fn ($roleQuery) => $roleQuery->where('name', 'super_admin'))
                ->orWhere('role', 'super_admin');
        });
    }

    private function ensureRoleAssignmentAllowed(User $actor, string $roleName, ?User $target = null): void
    {
        if (! $actor->isSuperAdmin() && ($roleName === 'super_admin' || $target?->isSuperAdmin())) {
            abort(403, 'Only an Admin can manage the protected Admin role.');
        }
    }
}
