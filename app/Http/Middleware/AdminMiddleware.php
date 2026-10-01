<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class AdminMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if ($user && $user->isAdminStaff()) {
            if ($user->status !== 'active') {
                auth()->logout();
                if ($request->expectsJson() || $request->wantsJson()) {
                    return response()->json(['message' => 'Your account has been suspended.'], 403);
                }

                return redirect('/admin/login')->with('error', 'Your account has been suspended.');
            }

            if (! $user->isSuperAdmin()) {
                $allowed = array_map('intval', $user->accessibleLocationIds());
                if ($request->filled('location_id')) {
                    abort_unless(in_array((int) $request->input('location_id'), $allowed, true), 403);
                }
                foreach ($request->route()?->parameters() ?? [] as $model) {
                    if ($model instanceof \App\Models\Location) {
                        abort_unless($user->canAccessLocation($model), 403);
                    } elseif ($model instanceof \Illuminate\Database\Eloquent\Model && array_key_exists('location_id', $model->getAttributes())) {
                        abort_unless(in_array((int) $model->getAttribute('location_id'), $allowed, true), 403);
                    }
                }
            }

            return $next($request);
        }

        if ($request->expectsJson() || $request->wantsJson()) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        return redirect('/admin/login')->with('error', 'You do not have admin access.');
    }
}
