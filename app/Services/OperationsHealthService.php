<?php

namespace App\Services;

use App\Models\InventoryReservation;
use App\Models\OperationsHealthCheck;
use App\Services\Inventory\InventoryReconciliationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

class OperationsHealthService
{
    public function __construct(private InventoryReconciliationService $reconciliation)
    {
    }

    public function runInventoryReconciliation(): OperationsHealthCheck
    {
        $result = $this->reconciliation->run();

        return $this->record(
            'inventory_reconciliation',
            $result['mismatch_count'] === 0 ? 'healthy' : 'failed',
            $result['mismatch_count'] === 0
                ? "{$result['checked_balances']} balances match the ledger."
                : "{$result['mismatch_count']} inventory ledger mismatch(es) found.",
            $result
        );
    }

    /** @return array<int, OperationsHealthCheck> */
    public function runSystemChecks(): array
    {
        return [
            $this->checkQueue(),
            $this->checkBroadcasting(),
            $this->checkWorkflows(),
            $this->checkBackup(),
            $this->checkStorage(),
        ];
    }

    public function record(string $name, string $status, string $summary, array $details = []): OperationsHealthCheck
    {
        return OperationsHealthCheck::create([
            'check_name' => $name,
            'status' => $status,
            'summary' => $summary,
            'details' => $details,
            'checked_at' => now(),
        ]);
    }

    private function checkQueue(): OperationsHealthCheck
    {
        $pending = Schema::hasTable('jobs') ? DB::table('jobs')->count() : 0;
        $failed = Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->count() : 0;
        $driver = (string) config('queue.default');
        $status = $failed > 0 ? 'failed' : ($driver === 'sync' ? 'warning' : 'healthy');

        return $this->record('queue', $status, match ($status) {
            'failed' => "{$failed} failed queue job(s) require attention.",
            'warning' => 'Queue is using the synchronous driver.',
            default => "Queue is active with {$pending} pending job(s).",
        }, compact('driver', 'pending', 'failed'));
    }

    private function checkBroadcasting(): OperationsHealthCheck
    {
        $driver = (string) config('broadcasting.default');
        $healthy = ! in_array($driver, ['null', 'log'], true);

        return $this->record(
            'broadcasting',
            $healthy ? 'healthy' : 'warning',
            $healthy ? "Broadcasting uses {$driver}." : "Broadcasting uses {$driver}; clients will rely on polling.",
            ['driver' => $driver]
        );
    }

    private function checkWorkflows(): OperationsHealthCheck
    {
        $expiredReservations = InventoryReservation::query()
            ->where('status', InventoryReservation::STATUS_ACTIVE)
            ->where('expires_at', '<=', now())
            ->count();
        $issues = $expiredReservations;

        return $this->record(
            'workflows',
            $issues > 0 ? 'warning' : 'healthy',
            $issues > 0 ? "{$issues} stale operational workflow(s) require review." : 'Inventory workflows are current.',
            compact('expiredReservations')
        );
    }

    private function checkBackup(): OperationsHealthCheck
    {
        $path = config('inventory.backup_path');
        if (! $path) {
            return $this->record('backup', 'warning', 'Database backup path is not configured.');
        }

        $files = File::isDirectory($path) ? File::allFiles($path) : (File::exists($path) ? [new \SplFileInfo($path)] : []);
        $latest = collect($files)->max(fn ($file) => $file->getMTime());
        if (! $latest) {
            return $this->record('backup', 'failed', 'No backup file was found.', ['path' => $path]);
        }

        $ageHours = round((time() - $latest) / 3600, 1);
        $staleAfter = (int) config('inventory.backup_stale_hours', 48);

        return $this->record(
            'backup',
            $ageHours <= $staleAfter ? 'healthy' : 'failed',
            $ageHours <= $staleAfter ? "Latest backup is {$ageHours} hour(s) old." : "Latest backup is stale at {$ageHours} hour(s).",
            ['path' => $path, 'age_hours' => $ageHours, 'stale_after_hours' => $staleAfter]
        );
    }

    private function checkStorage(): OperationsHealthCheck
    {
        $logDirectory = storage_path('logs');
        $healthy = File::isDirectory($logDirectory) && is_writable($logDirectory);

        return $this->record(
            'error_logging',
            $healthy ? 'healthy' : 'failed',
            $healthy ? 'Application log storage is writable.' : 'Application log storage is not writable.',
            ['path' => $logDirectory]
        );
    }
}
