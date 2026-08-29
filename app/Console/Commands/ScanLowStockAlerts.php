<?php

namespace App\Console\Commands;

use App\Services\Inventory\LowStockAlertService;
use Illuminate\Console\Command;

class ScanLowStockAlerts extends Command
{
    protected $signature = 'inventory:scan-low-stock';

    protected $description = 'Open, resolve, and notify inventory reorder alerts';

    public function handle(LowStockAlertService $alerts): int
    {
        $result = $alerts->scanAndNotify();
        $this->info("{$result['open']} open alert(s), {$result['resolved']} resolved, {$result['notified']} notification item(s) sent.");

        return self::SUCCESS;
    }
}
