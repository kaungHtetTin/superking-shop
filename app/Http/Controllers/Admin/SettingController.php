<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AppSettingsService;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use App\Support\Spa;

class SettingController extends Controller
{
    public function edit(AppSettingsService $settings)
    {
        return Spa::render('Admin/Settings/Edit', [
            'settings' => $settings->publicSettings(),
        ]);
    }

    public function update(Request $request, AppSettingsService $settings, AuditLogService $auditLogService)
    {
        $validated = $request->validate([
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
