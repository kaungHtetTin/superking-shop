<?php

namespace App\Http\Middleware;

use App\Providers\RouteServiceProvider;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class RedirectIfAuthenticated
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @param  string|null  ...$guards
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next, ...$guards)
    {
        $guards = empty($guards) ? [null] : $guards;

        foreach ($guards as $guard) {
            if (Auth::guard($guard)->check()) {
                $user = Auth::guard($guard)->user();
                $isAdminRoute = $request->routeIs('admin.*') || $request->is('admin/*');

                if ($isAdminRoute) {
                    if ($user && $user->isAdminStaff() && $user->status === 'active') {
                        return redirect('/admin/dashboard');
                    }

                    Auth::guard($guard)->logout();
                    $request->session()->regenerateToken();

                    return $next($request);
                }

                if ($user && $user->isAdminStaff()) {
                    Auth::guard($guard)->logout();
                    $request->session()->regenerateToken();

                    return redirect('/admin/login');
                }

                return redirect(RouteServiceProvider::HOME);
            }
        }

        return $next($request);
    }
}
