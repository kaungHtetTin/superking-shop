<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureOrderStaff
{
    /**
     * Cashier, Manager, and Super Admin can manage order fulfillment.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     */
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (! $user?->hasAdminPermission('orders.manage')) {
            if ($request->expectsJson() || $request->wantsJson()) {
                return response()->json(['message' => 'You do not have permission to manage orders.'], 403);
            }

            abort(403, 'You do not have permission to manage orders.');
        }

        return $next($request);
    }
}
