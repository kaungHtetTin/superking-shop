<?php

namespace App\Policies;

use App\Models\Location;
use App\Models\User;

class LocationPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAdminPermission('locations.view');
    }

    public function view(User $user, Location $location): bool
    {
        return $user->hasAdminPermission('locations.view')
            && $user->canAccessLocation($location);
    }

    public function create(User $user): bool
    {
        return $user->isSuperAdmin();
    }

    public function update(User $user, Location $location): bool
    {
        return $user->hasAdminPermission('locations.manage') && $user->canAccessLocation($location);
    }

    public function delete(User $user, Location $location): bool
    {
        return $user->hasAdminPermission('locations.manage') && $user->canAccessLocation($location) && ! $location->is_system;
    }
}
