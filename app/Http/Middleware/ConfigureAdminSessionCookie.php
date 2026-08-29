<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Use a dedicated session cookie for /admin so staff login does not replace
 * the storefront customer session (and vice versa) in the same browser.
 */
class ConfigureAdminSessionCookie
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($this->requestUsesAdminSession($request)) {
            $adminCookie = trim((string) config('session.admin_cookie'));

            if ($adminCookie === '') {
                $sessionCookie = trim((string) config('session.cookie'));
                $adminCookie = ($sessionCookie !== '' ? $sessionCookie : 'laravel_session').'_admin';
            }

            config([
                'session.cookie' => $adminCookie,
            ]);
        }

        return $next($request);
    }

    private function requestUsesAdminSession(Request $request): bool
    {
        if ($request->routeIs('admin.*')) {
            return true;
        }

        $path = '/'.trim($request->path(), '/').'/';

        return str_contains($path, '/admin/') || str_ends_with(rtrim($path, '/'), '/admin');
    }
}
