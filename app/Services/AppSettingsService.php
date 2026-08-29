<?php

namespace App\Services;

use App\Models\Setting;
use App\Support\UploadedFileUrl;
use Illuminate\Support\Facades\Cache;

class AppSettingsService
{
    public const DEFAULTS = [
        'app_name' => 'LaLaPick',
        'currency_label' => 'MMK',
        'theme_color' => '#087f74',
        'logo_path' => null,
        'favicon_path' => null,
        'contacts' => [
            'email' => [],
            'phone' => [],
            'facebook' => [],
            'tiktok' => [],
        ],
    ];

    private const CACHE_KEY = 'app_settings.public';

    public function all(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, function () {
            $settings = Setting::query()->pluck('value', 'key')->all();

            return [
                'app_name' => $settings['app_name'] ?? self::DEFAULTS['app_name'],
                'currency_label' => $settings['currency_label'] ?? self::DEFAULTS['currency_label'],
                'theme_color' => $settings['theme_color'] ?? self::DEFAULTS['theme_color'],
                'logo_path' => $settings['logo_path'] ?? null,
                'favicon_path' => $settings['favicon_path'] ?? null,
                'contacts' => $this->normalizeContacts($this->decodeJson($settings['contacts'] ?? null)),
            ];
        });
    }

    public function publicSettings(): array
    {
        $settings = $this->all();

        return array_merge($settings, [
            'logo_url' => $this->publicUrl($settings['logo_path']),
            'favicon_url' => $this->publicUrl($settings['favicon_path']),
        ]);
    }

    public function setMany(array $values): void
    {
        foreach ($values as $key => $value) {
            Setting::updateOrCreate(
                ['key' => $key],
                [
                    'value' => is_array($value) ? json_encode($value) : $value,
                    'group' => $this->groupFor($key),
                ],
            );
        }

        Cache::forget(self::CACHE_KEY);
    }

    public function normalizeContacts(?array $contacts): array
    {
        $contacts ??= [];

        return [
            'email' => $this->cleanList($contacts['email'] ?? []),
            'phone' => $this->cleanList($contacts['phone'] ?? []),
            'facebook' => $this->cleanList($contacts['facebook'] ?? []),
            'tiktok' => $this->cleanList($contacts['tiktok'] ?? []),
        ];
    }

    private function cleanList(array $items): array
    {
        return collect($items)
            ->map(fn ($item) => trim((string) $item))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function decodeJson(?string $value): ?array
    {
        if (! $value) {
            return null;
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : null;
    }

    private function publicUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        return UploadedFileUrl::make($path);
    }

    private function groupFor(string $key): string
    {
        return match ($key) {
            'logo_path', 'favicon_path', 'theme_color' => 'theme',
            'contacts' => 'contacts',
            default => 'general',
        };
    }
}
