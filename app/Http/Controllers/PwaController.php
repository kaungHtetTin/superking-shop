<?php

namespace App\Http\Controllers;

use App\Services\AppSettingsService;
use Illuminate\Http\JsonResponse;

class PwaController extends Controller
{
    public function manifest(AppSettingsService $settingsService): JsonResponse
    {
        $settings = $settingsService->publicSettings();
        $appName = $settings['app_name'] ?: config('app.name', 'Harmony House');
        $themeColor = $settings['theme_color'] ?: '#9c3f2c';
        $iconUrl = $settings['logo_url'] ?: $settings['favicon_url'] ?: url('/pwa-icon.svg');
        $fallbackIconUrl = url('/pwa-icon.svg');

        return response()
            ->json([
                'name' => $appName,
                'short_name' => $this->shortName($appName),
                'description' => "{$appName} musical instrument store app",
                'id' => url('/'),
                'start_url' => url('/?source=pwa'),
                'scope' => url('/'),
                'display' => 'standalone',
                'display_override' => ['window-controls-overlay', 'standalone', 'minimal-ui'],
                'orientation' => 'portrait',
                'background_color' => '#fffdf8',
                'theme_color' => $themeColor,
                'categories' => ['shopping', 'music', 'entertainment'],
                'prefer_related_applications' => false,
                'launch_handler' => [
                    'client_mode' => ['navigate-existing', 'auto'],
                ],
                'icons' => [
                    [
                        'src' => $iconUrl,
                        'sizes' => '192x192',
                        'type' => $this->iconType($iconUrl),
                        'purpose' => 'any',
                    ],
                    [
                        'src' => $iconUrl,
                        'sizes' => '512x512',
                        'type' => $this->iconType($iconUrl),
                        'purpose' => 'any maskable',
                    ],
                    [
                        'src' => $fallbackIconUrl,
                        'sizes' => '512x512',
                        'type' => 'image/svg+xml',
                        'purpose' => 'any maskable',
                    ],
                ],
                'shortcuts' => [
                    [
                        'name' => 'Shop instruments',
                        'short_name' => 'Shop',
                        'description' => 'Browse instruments and gear',
                        'url' => url('/products?source=pwa-shortcut'),
                        'icons' => [['src' => $fallbackIconUrl, 'sizes' => '192x192', 'type' => 'image/svg+xml']],
                    ],
                    [
                        'name' => 'Categories',
                        'short_name' => 'Categories',
                        'description' => 'Shop by instrument department',
                        'url' => url('/categories?source=pwa-shortcut'),
                        'icons' => [['src' => $fallbackIconUrl, 'sizes' => '192x192', 'type' => 'image/svg+xml']],
                    ],
                    [
                        'name' => 'Cart',
                        'short_name' => 'Cart',
                        'description' => 'Open your shopping cart',
                        'url' => url('/cart?source=pwa-shortcut'),
                        'icons' => [['src' => $fallbackIconUrl, 'sizes' => '192x192', 'type' => 'image/svg+xml']],
                    ],
                ],
            ])
            ->header('Content-Type', 'application/manifest+json')
            ->header('Cache-Control', 'no-cache, must-revalidate');
    }

    private function shortName(string $name): string
    {
        return mb_substr(trim($name), 0, 12) ?: 'Shop';
    }

    private function iconType(string $url): string
    {
        $extension = strtolower(pathinfo(parse_url($url, PHP_URL_PATH) ?: '', PATHINFO_EXTENSION));

        return match ($extension) {
            'svg' => 'image/svg+xml',
            'webp' => 'image/webp',
            'jpg', 'jpeg' => 'image/jpeg',
            'ico' => 'image/x-icon',
            default => 'image/png',
        };
    }
}
