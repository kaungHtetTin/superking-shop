<?php

namespace App\Policies;

use App\Models\StockAdjustment;
use App\Models\User;

class StockAdjustmentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAdminPermission('inventory.adjust.create');
    }

    public function view(User $user, StockAdjustment $adjustment): bool
    {
        return ($user->hasAdminPermission('inventory.adjust.create') || $user->hasAdminPermission('inventory.adjust.approve'))
            && $user->canAccessLocation($adjustment->location);
    }

    public function create(User $user): bool
    {
        return $user->hasAdminPermission('inventory.adjust.create');
    }

    public function approve(User $user, StockAdjustment $adjustment): bool
    {
        return $user->hasAdminPermission('inventory.adjust.approve') && $user->canAccessLocation($adjustment->location);
    }
}
