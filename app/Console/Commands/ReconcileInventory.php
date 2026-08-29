<?php

namespace App\Console\Commands;

use App\Services\OperationsHealthService;
use Illuminate\Console\Command;

class ReconcileInventory extends Command
{
    protected $signature = 'inventory:reconcile';

    protected $description = 'Compare inventory balances with the append-only movement ledger';

    public function handle(OperationsHealthService $health): int
    {
        $check = $health->runInventoryReconciliation();
        foreach ($check->details['mismatches'] ?? [] as $mismatch) {
            $this->warn(sprintf(
                'Ledger mismatch: %s / %s (balance %s/%s, ledger %s/%s)',
                $mismatch['location_code'] ?? $mismatch['location_id'],
                $mismatch['product_code'] ?? $mismatch['product_id'],
                $mismatch['balance_on_hand'] ?? 'missing',
                $mismatch['balance_reserved'] ?? 'missing',
                $mismatch['ledger_on_hand'],
                $mismatch['ledger_reserved']
            ));
        }

        $this->info($check->summary);

        return $check->status === 'healthy' ? self::SUCCESS : self::FAILURE;
    }
}
