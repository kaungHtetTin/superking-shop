<?php

namespace App\Policies;

use App\Models\StockTransfer;
use App\Models\User;

class StockTransferPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAdminPermission('inventory.transfer.create');
    }

    public function view(User $user, StockTransfer $transfer): bool
    {
        if (! $this->viewAny($user)) {
            return false;
        }

        return $user->canAccessLocation($transfer->sourceLocation)
            || $user->canAccessLocation($transfer->destinationLocation);
    }

    public function create(User $user): bool
    {
        return $user->hasAdminPermission('inventory.transfer.create');
    }

    public function update(User $user, StockTransfer $transfer): bool
    {
        return false;
    }

    public function approve(User $user, StockTransfer $transfer): bool
    {
        return false;
    }

    public function ship(User $user, StockTransfer $transfer): bool
    {
        return false;
    }

    public function receive(User $user, StockTransfer $transfer): bool
    {
        return false;
    }

    public function cancel(User $user, StockTransfer $transfer): bool
    {
        return false;
    }
}
