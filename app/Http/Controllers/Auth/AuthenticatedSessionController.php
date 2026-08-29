<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use App\Support\Spa;
use Symfony\Component\HttpFoundation\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Display the login view.
     */
    public function create(Request $request): Response
    {
        return Spa::render('Auth/Login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => session('status'),
            'error' => session('error'),
            'isAdminLogin' => $request->routeIs('admin.login'),
            'googleAuthAvailable' => filled(config('services.google.client_id')) && filled(config('services.google.client_secret')),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $request->session()->regenerate();

        $user = $request->user();
        $isAdminLogin = $request->routeIs('admin.*') || $request->is('admin/*');

        if ($isAdminLogin) {
            if (! $user->isAdminStaff()) {
                Auth::guard('web')->logout();
                $request->session()->regenerateToken();

                throw ValidationException::withMessages([
                    'email' => 'These credentials do not have access to the admin area.',
                ]);
            }

            if ($user->status !== 'active') {
                Auth::guard('web')->logout();
                $request->session()->regenerateToken();

                throw ValidationException::withMessages([
                    'email' => 'Your account has been suspended.',
                ]);
            }

            return $this->redirectAfterLogin($request, true);
        }

        if ($user->isAdminStaff()) {
            Auth::guard('web')->logout();
            $request->session()->regenerateToken();

            throw ValidationException::withMessages([
                'email' => 'Staff accounts must use the admin login.',
            ]);
        }

        if ($user->status !== 'active') {
            Auth::guard('web')->logout();
            $request->session()->regenerateToken();

            throw ValidationException::withMessages([
                'email' => 'Your account has been suspended.',
            ]);
        }

        return $this->redirectAfterLogin($request, false);
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $isAdminLogout = $request->routeIs('admin.*') || $request->is('admin/*');

        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return redirect($isAdminLogout ? '/admin/login' : '/');
    }

    private function redirectAfterLogin(Request $request, bool $isAdminLogin): RedirectResponse
    {
        $fallback = $isAdminLogin ? '/admin/dashboard' : '/';
        $intended = (string) $request->session()->pull('url.intended', $fallback);
        $target = $this->safeIntendedUrl($request, $intended, $fallback, $isAdminLogin);

        return redirect()->to($target);
    }

    private function safeIntendedUrl(Request $request, string $url, string $fallback, bool $isAdminLogin): string
    {
        $url = trim($url);

        if ($url === '') {
            return $fallback;
        }

        $parts = parse_url($url);

        if ($parts === false) {
            return $fallback;
        }

        $host = $parts['host'] ?? null;

        if ($host !== null && strcasecmp($host, $request->getHost()) !== 0) {
            return $fallback;
        }

        $path = $this->appRelativePath($parts['path'] ?? '/');
        $normalizedPath = '/'.trim($path, '/');
        $isAdminPath = $normalizedPath === '/admin' || str_contains($normalizedPath.'/', '/admin/');
        $isLoginPath = in_array($normalizedPath, ['/login', '/admin/login'], true);

        if ($isLoginPath || $isAdminLogin !== $isAdminPath) {
            return $fallback;
        }

        $query = isset($parts['query']) ? '?'.$parts['query'] : '';
        $fragment = isset($parts['fragment']) ? '#'.$parts['fragment'] : '';

        return $path.$query.$fragment;
    }

    private function appRelativePath(string $path): string
    {
        $normalizedPath = '/'.trim($path, '/');
        $basePath = parse_url(config('app.url'), PHP_URL_PATH) ?: '';
        $normalizedBase = '/'.trim($basePath, '/');

        if ($normalizedBase !== '/' && $normalizedBase !== '') {
            if ($normalizedPath === $normalizedBase) {
                return '/';
            }

            if (str_starts_with($normalizedPath.'/', rtrim($normalizedBase, '/').'/')) {
                $withoutBase = substr($normalizedPath, strlen(rtrim($normalizedBase, '/')));

                return $withoutBase === '' ? '/' : $withoutBase;
            }
        }

        return $normalizedPath;
    }
}
