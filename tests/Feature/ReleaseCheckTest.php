<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReleaseCheckTest extends TestCase
{
    use RefreshDatabase;

    public function test_release_check_rejects_development_configuration(): void
    {
        config(['app.debug' => true, 'app.url' => 'http://localhost', 'session.secure' => false]);

        $this->artisan('release:check')
            ->expectsOutput('FAIL  Production environment')
            ->expectsOutput('FAIL  Debug disabled')
            ->expectsOutput('FAIL  HTTPS application URL')
            ->expectsOutput('FAIL  Secure session cookies')
            ->expectsOutput('PASS  Database reachable')
            ->expectsOutput('PASS  All migrations applied')
            ->assertExitCode(1);
    }
}
