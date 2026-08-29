<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Socialite\Contracts\User as SocialiteUser;
use Laravel\Socialite\Facades\Socialite;
use Throwable;

class GoogleAuthController extends Controller
{
    public function redirect(Request $request): RedirectResponse
    {
        if (! $this->isConfigured()) {
            return redirect()->route('login')->with('error', 'Google login is not configured yet.');
        }

        return Socialite::driver('google')
            ->scopes(['openid', 'profile', 'email'])
            ->with(['prompt' => 'select_account'])
            ->redirect();
    }

    public function callback(Request $request): RedirectResponse
    {
        if ($request->filled('error')) {
            return redirect()->route('login')->with('error', 'Google login was cancelled.');
        }

        try {
            $profile = Socialite::driver('google')->user();
        } catch (Throwable $exception) {
            report($exception);
            return redirect()->route('login')->with('error', 'Google login failed. Please try again.');
        }

        if (! $profile->getEmail()) {
            return redirect()->route('login')->with('error', 'Google did not return a usable account profile.');
        }

        $user = $this->findOrCreateCustomerFromGoogle($profile);
        if (! $user) {
            return redirect()->route('admin.login')->with('error', 'Staff accounts must use the admin login.');
        }

        if ($user->status !== 'active') {
            return redirect()->route('login')->with('error', 'Your account has been suspended.');
        }

        Auth::login($user, true);
        $request->session()->regenerate();

        return redirect()->intended('/');
    }

    private function findOrCreateCustomerFromGoogle(SocialiteUser $profile): ?User
    {
        $googleId = (string) $profile->getId();
        $email = strtolower((string) $profile->getEmail());

        $user = User::where('google_id', $googleId)->first() ?: User::where('email', $email)->first();

        if ($user && $user->isAdminStaff()) {
            return null;
        }

        if ($user) {
            $user->forceFill([
                'google_id' => $googleId,
                'auth_provider' => 'google',
                'email_verified_at' => $user->email_verified_at ?: now(),
                'avatar' => $user->avatar ?: $profile->getAvatar(),
            ])->save();

            return $user;
        }

        return User::create([
            'name' => $profile->getName() ?: Str::before($email, '@'),
            'email' => $email,
            'google_id' => $googleId,
            'auth_provider' => 'google',
            'avatar' => $profile->getAvatar(),
            'password' => Hash::make(Str::random(48)),
            'role' => User::CUSTOMER_ROLE,
            'status' => 'active',
            'email_verified_at' => now(),
        ]);
    }

    private function isConfigured(): bool
    {
        return filled(config('services.google.client_id'))
            && filled(config('services.google.client_secret'))
            && filled(config('services.google.redirect'));
    }
}
