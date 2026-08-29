<?php

namespace App\Policies;

use App\Models\StockReceipt;
use App\Models\User;

class StockReceiptPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasAdminPermission('inventory.receive');
    }

    public function view(User $user, StockReceipt $receipt): bool
    {
        return $user->hasAdminPermission('inventory.receive') && $user->canAccessLocation($receipt->location);
    }

    public function create(User $user): bool
    {
        return $user->hasAdminPermission('inventory.receive');
    }

    public function update(User $user, StockReceipt $receipt): bool
    {
        return $this->view($user, $receipt) && $receipt->status === 'draft';
    }

    public function delete(User $user, StockReceipt $receipt): bool
    {
        return $this->view($user, $receipt) && in_array($receipt->status, ['draft', 'posted'], true);
    }
}
