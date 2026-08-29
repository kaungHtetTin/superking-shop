<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use App\Support\Spa;

class PaymentMethodController extends Controller
{
    public function index(Request $request)
    {
        $search = trim($request->string('q')->toString());
        $status = $request->string('status')->toString();

        $methods = PaymentMethod::query()
            ->when($search, function ($query) use ($search) {
                $like = '%'.$search.'%';
                $query->where(function ($inner) use ($like) {
                    $inner->where('banking_service', 'like', $like)
                        ->orWhere('account_name', 'like', $like)
                        ->orWhere('account_no', 'like', $like);
                });
            })
            ->when($status === 'active', fn ($query) => $query->where('is_active', true))
            ->when($status === 'inactive', fn ($query) => $query->where('is_active', false))
            ->ordered()
            ->paginate(12)
            ->withQueryString();

        return Spa::render('Admin/PaymentMethods/Index', [
            'methods' => $methods,
            'activeCount' => PaymentMethod::active()->count(),
            'filters' => [
                'q' => $search ?: null,
                'status' => $status ?: null,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePaymentMethod($request);
        $payload = $this->payload($validated, $request);

        if ($request->hasFile('icon')) {
            $payload['icon_path'] = $request->file('icon')->store('payment-methods', 'public');
        }

        PaymentMethod::create($payload);

        return back()->with('success', 'Payment method created.');
    }

    public function update(Request $request, PaymentMethod $paymentMethod)
    {
        $validated = $this->validatePaymentMethod($request);
        $payload = $this->payload($validated, $request);

        if ($request->boolean('remove_icon') && $paymentMethod->icon_path) {
            Storage::disk('public')->delete($paymentMethod->icon_path);
            $payload['icon_path'] = null;
        }

        if ($request->hasFile('icon')) {
            if ($paymentMethod->icon_path) {
                Storage::disk('public')->delete($paymentMethod->icon_path);
            }

            $payload['icon_path'] = $request->file('icon')->store('payment-methods', 'public');
        }

        $paymentMethod->update($payload);

        return back()->with('success', 'Payment method updated.');
    }

    public function destroy(PaymentMethod $paymentMethod)
    {
        if ($paymentMethod->orders()->exists()) {
            $paymentMethod->update(['is_active' => false]);

            return back()->with('success', 'Payment method is used by orders, so it was deactivated.');
        }

        if ($paymentMethod->icon_path) {
            Storage::disk('public')->delete($paymentMethod->icon_path);
        }

        $paymentMethod->delete();

        return back()->with('success', 'Payment method deleted.');
    }

    private function validatePaymentMethod(Request $request): array
    {
        return $request->validate([
            'banking_service' => ['required', 'string', 'max:255'],
            'account_name' => ['required', 'string', 'max:255'],
            'account_no' => ['required', 'string', 'max:255'],
            'icon' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,svg', 'max:4096'],
            'remove_icon' => ['nullable'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:999999'],
            'is_active' => ['nullable'],
        ]);
    }

    private function payload(array $validated, Request $request): array
    {
        unset($validated['icon'], $validated['remove_icon']);

        $validated['sort_order'] = (int) ($validated['sort_order'] ?? 0);
        $validated['is_active'] = $request->boolean('is_active');

        return $validated;
    }
}
