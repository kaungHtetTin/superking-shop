<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

class ReleaseCheck extends Command
{
    protected $signature = 'release:check';

    protected $description = 'Read-only production configuration and artifact checks (does not deploy)';

    public function handle(): int
    {
        $checks = [
            'Production environment' => app()->environment('production'),
            'Debug disabled' => ! config('app.debug'),
            'Application key configured' => filled(config('app.key')),
            'HTTPS application URL' => str_starts_with((string) config('app.url'), 'https://'),
            'Secure session cookies' => (bool) config('session.secure'),
            'No Vite development marker' => ! file_exists(public_path('hot')),
            'BCMath installed' => extension_loaded('bcmath'),
            'PDF dependency installed' => class_exists(\Dompdf\Options::class),
            'Storage writable' => is_writable(storage_path()),
            'Bootstrap cache writable' => is_writable(base_path('bootstrap/cache')),
        ];

        $manifestPath = public_path('build/manifest.json');
        $manifest = is_file($manifestPath) ? json_decode(file_get_contents($manifestPath), true) : null;
        $checks['Production assets complete'] = is_array($manifest)
            && isset($manifest['resources/js/app.jsx'])
            && collect($manifest)->every(function ($entry) {
                return collect(array_merge([$entry['file'] ?? ''], $entry['css'] ?? []))
                    ->every(fn ($file) => $file !== '' && is_file(public_path('build/'.$file)));
            });

        try {
            DB::connection()->getPdo();
            $checks['Database reachable'] = true;
            $migrator = app('migrator');
            $checks['All migrations applied'] = $migrator->repositoryExists()
                && count(array_diff(array_keys($migrator->getMigrationFiles(database_path('migrations'))),
                    $migrator->getRepository()->getRan())) === 0;
        } catch (Throwable $exception) {
            // Do not print database credentials or connection details.
            $checks['Database reachable / migrations applied'] = false;
        }

        foreach ($checks as $label => $passed) {
            $this->line(($passed ? 'PASS' : 'FAIL').'  '.$label);
        }

        $this->warn('Also verify HTTPS, backups/restore, scheduler, mail, workers, permissions and browser checkout on staging.');

        return in_array(false, $checks, true) ? self::FAILURE : self::SUCCESS;
    }
}
