<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureAdminPermission
{
    public function handle(Request $request, Closure $next, string $permission)
    {
        $user = $request->user();

        if (
            $user
            && $user->status === 'active'
            && $user->hasAdminPermission($permission)
        ) {
            return $next($request);
        }

        if ($request->expectsJson() || $request->wantsJson()) {
            return response()->json(['message' => 'You do not have permission for this admin action.'], 403);
        }

        abort(403, 'You do not have permission for this admin action.');
    }
}
