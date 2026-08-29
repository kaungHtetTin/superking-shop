<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureSuperAdmin
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if ($user && $user->isSuperAdmin() && $user->status === 'active') {
            return $next($request);
        }

        if ($request->expectsJson() || $request->wantsJson()) {
            return response()->json(['message' => 'Super Admin access required.'], 403);
        }

        return redirect()->route('admin.dashboard')->with('error', 'Super Admin access required.');
    }
}
