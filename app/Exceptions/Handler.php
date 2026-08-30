<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * A list of the exception types that are not reported.
     *
     * @var array<int, class-string<Throwable>>
     */
    protected $dontReport = [
        //
    ];

    /**
     * A list of the inputs that are never flashed for validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     *
     * @return void
     */
    public function register()
    {
        $this->renderable(function (PostTooLargeException $exception, $request) {
            $isCheckout = $request->is('checkout');
            $field = $isCheckout ? 'payment_proof' : 'file';
            $message = $isCheckout
                ? 'The payment screenshot is too large. Please upload an image no larger than 10 MB.'
                : 'The uploaded file is too large.';

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => $message,
                    'errors' => [$field => [$message]],
                ], 413);
            }

            return back()->withErrors([$field => $message]);
        });

        $this->reportable(function (Throwable $e) {
            //
        });
    }
}
