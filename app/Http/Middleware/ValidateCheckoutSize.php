<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\Request;

class ValidateCheckoutSize
{
    public function handle(Request $request, Closure $next)
    {
        // Allow a 10 MiB proof plus multipart/form fields, independently of PHP's limit.
        if ($request->isMethod('POST') && $request->is('checkout')
            && (int) $request->server('CONTENT_LENGTH', 0) > 12 * 1024 * 1024) {
            throw new PostTooLargeException;
        }

        return $next($request);
    }
}
