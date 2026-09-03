<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rules\Password;

class PasswordController extends Controller
{
    /**
     * Update the user's password.
     */
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', Password::defaults(), 'confirmed'],
            'password_confirmation' => ['required', 'string', 'same:password'],
        ]);

        $user = $request->user();
        $user->forceFill([
            'password' => Hash::make($validated['password']),
            'remember_token' => null,
        ])->saveOrFail();

        if (! Hash::check($validated['password'], $user->fresh()->password)) {
            throw ValidationException::withMessages([
                'password' => 'The password could not be updated. Please try again.',
            ]);
        }

        foreach (array_filter([$user->email, $user->phone]) as $login) {
            RateLimiter::clear(Str::transliterate(Str::lower((string) $login).'|'.$request->ip()));
        }

        if ($request->routeIs('admin.profile.password.update')) {
            return redirect()->route('admin.profile.edit', ['saved' => 'password']);
        }

        return back()->with('status', 'password-updated');
    }
}
