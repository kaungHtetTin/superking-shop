<?php

namespace App\Console\Commands;

use App\Services\OperationsHealthService;
use Illuminate\Console\Command;

class CheckOperationsHealth extends Command
{
    protected $signature = 'operations:health-check';

    protected $description = 'Record queue, broadcasting, workflow, backup, and logging health';

    public function handle(OperationsHealthService $health): int
    {
        $checks = $health->runSystemChecks();
        foreach ($checks as $check) {
            $this->line(strtoupper($check->status)." {$check->check_name}: {$check->summary}");
        }

        return collect($checks)->contains(fn ($check) => $check->status === 'failed')
            ? self::FAILURE
            : self::SUCCESS;
    }
}
