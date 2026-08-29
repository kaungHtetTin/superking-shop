<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Providers\RouteServiceProvider;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use App\Support\Spa;
use Symfony\Component\HttpFoundation\Response;

class RegisteredUserController extends Controller
{
    /**
     * Display the registration view.
     */
    public function create(): Response
    {
        return Spa::render('Auth/Register', [
            'error' => session('error'),
            'googleAuthAvailable' => filled(config('services.google.client_id')) && filled(config('services.google.client_secret')),
        ]);
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->merge([
            'contact' => trim((string) $request->input('contact')),
        ]);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact' => [
                'required',
                'string',
                'max:255',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    $contact = (string) $value;

                    if (str_contains($contact, '@')) {
                        if (! filter_var($contact, FILTER_VALIDATE_EMAIL)) {
                            $fail('Please enter a valid email address.');

                            return;
                        }

                        if (User::where('email', strtolower($contact))->exists()) {
                            $fail('This email is already registered.');
                        }

                        return;
                    }

                    if (strlen($contact) > 30) {
                        $fail('The phone number must not be greater than 30 characters.');

                        return;
                    }

                    if (User::where('phone', $contact)->exists()) {
                        $fail('This phone number is already registered.');
                    }
                },
            ],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $contact = $validated['contact'];
        $isEmail = str_contains($contact, '@');

        $user = User::create([
            'name' => $validated['name'],
            'email' => $isEmail ? strtolower($contact) : null,
            'phone' => $isEmail ? null : $contact,
            'password' => Hash::make($validated['password']),
            'role' => User::CUSTOMER_ROLE,
            'status' => 'active',
            'auth_provider' => $isEmail ? 'email' : 'phone',
        ]);

        event(new Registered($user));

        Auth::login($user);

        return redirect(RouteServiceProvider::HOME);
    }
}
