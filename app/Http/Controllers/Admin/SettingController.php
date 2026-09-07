<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AppSettingsService;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use App\Support\Spa;
use Illuminate\Contracts\Auth\MustVerifyEmail;

class SettingController extends Controller
{
    public function edit(Request $request, AppSettingsService $settings)
    {
        $canManageSettings = $request->user()->hasAdminPermission('settings.manage');
        abort_unless($canManageSettings || $request->user()->hasAdminPermission('pricing.manage'), 403);
        if (! $canManageSettings && ! $request->filled('section')) {
            return redirect()->route('admin.settings.edit', ['section' => 'prices']);
        }
        abort_unless($canManageSettings || $request->query('section') === 'prices', 403);
        return Spa::render('Admin/Settings/Edit', [
            'canManageSettings' => $canManageSettings,
            'settings' => $settings->publicSettings(),
            'pricing' => app(PricingRuleController::class)->settingsData($request),
            'pricingAction' => in_array($request->query('price_action'), ['create', 'edit'], true) ? $request->query('price_action') : null,
            'pricingRule' => $request->query('section') === 'prices' && $request->query('price_action') === 'edit' ? \App\Models\PricingRule::findOrFail($request->integer('rule_id')) : null,
            'initialSection' => in_array($request->query('section'), ['general', 'branding', 'contacts', 'receipts', 'prices', 'profile', 'security', 'danger'], true)
                ? $request->query('section')
                : 'general',
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => match ($request->query('saved')) {
                'password' => 'password-updated',
                'profile' => 'profile-updated',
                default => session('status'),
            },
        ]);
    }

    public function update(Request $request, AppSettingsService $settings, AuditLogService $auditLogService)
    {
        $validated = $request->validate([
            'receipt' => ['sometimes', 'array:shop_name,address,phone,footer,paper_size,show_logo,show_customer,show_cashier,show_foc,auto_print'],
            'receipt.shop_name' => ['nullable', 'string', 'max:80'],
            'receipt.address' => ['nullable', 'string', 'max:300'],
            'receipt.phone' => ['nullable', 'string', 'max:80'],
            'receipt.footer' => ['nullable', 'string', 'max:300'],
            'receipt.paper_size' => ['required_with:receipt', 'in:58mm,80mm,A4,A5'],
            'receipt.show_logo' => ['required_with:receipt', 'boolean'],
            'receipt.show_customer' => ['required_with:receipt', 'boolean'],
            'receipt.show_cashier' => ['required_with:receipt', 'boolean'],
            'receipt.show_foc' => ['required_with:receipt', 'boolean'],
            'receipt.auto_print' => ['required_with:receipt', 'boolean'],
            'app_name' => ['required', 'string', 'max:80'],
            'currency_label' => ['required', 'string', 'max:12'],
            'theme_color' => ['required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'logo' => ['nullable', 'file', 'max:5120'],
            'favicon' => ['nullable', 'file', 'max:2048'],
            'remove_logo' => ['nullable', 'boolean'],
            'remove_favicon' => ['nullable', 'boolean'],
            'contacts' => ['nullable', 'array'],
            'contacts.email' => ['nullable', 'array'],
            'contacts.email.*' => ['nullable', 'email', 'max:120'],
            'contacts.phone' => ['nullable', 'array'],
            'contacts.phone.*' => ['nullable', 'string', 'max:50'],
            'contacts.facebook' => ['nullable', 'array'],
            'contacts.facebook.*' => ['nullable', 'string', 'max:255'],
            'contacts.tiktok' => ['nullable', 'array'],
            'contacts.tiktok.*' => ['nullable', 'string', 'max:255'],
        ]);

        $current = $settings->all();
        $this->ensureAllowedUpload($request, 'logo', ['jpg', 'jpeg', 'png', 'webp', 'svg']);
        $this->ensureAllowedUpload($request, 'favicon', ['ico', 'jpg', 'jpeg', 'png', 'webp', 'svg']);

        $payload = [
            'app_name' => trim($validated['app_name']),
            'currency_label' => trim($validated['currency_label']),
            'theme_color' => strtolower($validated['theme_color']),
            'contacts' => $settings->normalizeContacts($validated['contacts'] ?? []),
        ];

        if (isset($validated['receipt'])) {
            $receipt = array_replace(AppSettingsService::RECEIPT_DEFAULTS, $validated['receipt']);
            foreach (['shop_name', 'address', 'phone', 'footer'] as $key) {
                $receipt[$key] = trim((string) $receipt[$key]);
            }
            foreach (['show_logo', 'show_customer', 'show_cashier', 'show_foc', 'auto_print'] as $key) {
                $receipt[$key] = (bool) $receipt[$key];
            }
            $payload['receipt'] = $receipt;
        }

        $payload['logo_path'] = $this->resolveUpload(
            $request,
            'logo',
            'remove_logo',
            $current['logo_path'] ?? null,
            'logo',
        );

        $payload['favicon_path'] = $this->resolveUpload(
            $request,
            'favicon',
            'remove_favicon',
            $current['favicon_path'] ?? null,
            'favicon',
        );

        $settings->setMany($payload);

        $auditLogService->record('settings.updated', null, [
            'receipt_changed' => isset($payload['receipt']) && ($current['receipt'] ?? null) !== $payload['receipt'],
            'app_name' => $payload['app_name'],
            'currency_label' => $payload['currency_label'],
            'theme_color' => $payload['theme_color'],
            'contacts' => $payload['contacts'],
            'logo_changed' => ($current['logo_path'] ?? null) !== $payload['logo_path'],
            'favicon_changed' => ($current['favicon_path'] ?? null) !== $payload['favicon_path'],
        ], $request);

        return back()->with('success', 'Application settings updated.');
    }

    private function ensureAllowedUpload(Request $request, string $fileKey, array $extensions): void
    {
        if (! $request->hasFile($fileKey)) {
            return;
        }

        $extension = strtolower($request->file($fileKey)->getClientOriginalExtension());

        if (! in_array($extension, $extensions, true)) {
            throw ValidationException::withMessages([
                $fileKey => 'The '.$fileKey.' must be a '.implode(', ', $extensions).' file.',
            ]);
        }
    }

    private function resolveUpload(Request $request, string $fileKey, string $removeKey, ?string $currentPath, string $name): ?string
    {
        if ($request->boolean($removeKey)) {
            $this->deletePublicFile($currentPath);

            return null;
        }

        if (! $request->hasFile($fileKey)) {
            return $currentPath;
        }

        $this->deletePublicFile($currentPath);

        $file = $request->file($fileKey);
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension());

        return $file->storeAs('settings', $name.'-'.time().'.'.$extension, 'public');
    }

    private function deletePublicFile(?string $path): void
    {
        if (! $path || str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return;
        }

        Storage::disk('public')->delete($path);
    }
}
