<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    public const ADMIN_ROLES = ['super_admin', 'manager', 'staff'];

    public const CUSTOMER_ROLE = 'customer';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'google_id',
        'auth_provider',
        'password',
        'phone',
        'avatar',
        'default_address',
        'role',
        'status',
        'permissions',
        'loyalty_points',
        'tier',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'permissions' => 'array',
    ];

    public function scopeAdminStaff(Builder $query): Builder
    {
        return $query->where(function (Builder $query) {
            $query->whereHas('roles', fn (Builder $roleQuery) => $roleQuery->where('is_admin', true))
                ->orWhereIn('role', self::ADMIN_ROLES);
        });
    }

    public function isAdminStaff(): bool
    {
        $this->loadMissing('roles');

        return $this->roles->contains('is_admin', true)
            || in_array($this->role, self::ADMIN_ROLES, true);
    }

    public function isSuperAdmin(): bool
    {
        return $this->adminRoleName() === 'super_admin';
    }

    public function hasAdminPermission(string $permission): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        return in_array($permission, $this->effectiveAdminPermissions(), true);
    }

    public function effectiveAdminPermissions(): array
    {
        if ($this->isSuperAdmin()) {
            return Permission::query()->orderBy('name')->pluck('name')->all();
        }

        $this->loadMissing('roles.permissions');

        return $this->roles
            ->flatMap(fn (Role $role) => $role->permissions->pluck('name'))
            ->filter()
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    public function adminRole(): ?Role
    {
        $this->loadMissing('roles');

        return $this->roles->firstWhere('is_admin', true);
    }

    public function adminRoleName(): ?string
    {
        return $this->adminRole()?->name ?: $this->role;
    }

    public function adminRoleLabel(): string
    {
        return $this->adminRole()?->display_name
            ?: str($this->role ?: 'staff')->replace('_', ' ')->title()->toString();
    }

    public function syncAdminRole(string $roleName): void
    {
        $role = Role::query()->admin()->where('name', $roleName)->firstOrFail();

        $this->roles()->sync([$role->id]);

        if ($this->role !== $role->name) {
            $this->forceFill(['role' => $role->name])->save();
        }
    }

    public static function adminRoleOptions(): array
    {
        return Role::query()
            ->admin()
            ->orderBy('sort_order')
            ->orderBy('display_name')
            ->get(['name', 'display_name'])
            ->map(fn (Role $role) => ['value' => $role->name, 'label' => $role->display_name])
            ->all();
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_user');
    }

    public function locations(): BelongsToMany
    {
        return $this->belongsToMany(Location::class, 'location_user')
            ->withPivot('is_default')
            ->withTimestamps();
    }

    public function canAccessLocation(Location $location): bool
    {
        return $this->hasAdminPermission('locations.manage')
            || $this->locations()->whereKey($location->id)->exists();
    }

    public function accessibleLocationIds(): array
    {
        if ($this->hasAdminPermission('locations.manage')) {
            return Location::query()->where('is_active', true)->pluck('id')->all();
        }

        return $this->locations()->where('is_active', true)->pluck('locations.id')->all();
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function servedOrders()
    {
        return $this->hasMany(Order::class, 'served_by');
    }

    public function posShifts()
    {
        return $this->hasMany(PosShift::class, 'cashier_id');
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }

    public function rewardHistories()
    {
        return $this->hasMany(RewardHistory::class);
    }

    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class);
    }
}
