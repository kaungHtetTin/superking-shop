<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminSessionCookieTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_request_recovers_from_an_empty_admin_cookie_name(): void
    {
        config([
            'session.cookie' => 'musical_store_session',
            'session.admin_cookie' => '',
        ]);

        $response = $this->get('/admin/login');

        $response->assertOk();

        $cookieNames = collect($response->headers->getCookies())
            ->map(fn ($cookie) => $cookie->getName())
            ->all();

        $this->assertContains('musical_store_session_admin', $cookieNames);
    }
}
