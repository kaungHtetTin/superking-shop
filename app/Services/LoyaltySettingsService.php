<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

class LoyaltySettingsService
{
    private const CACHE_KEY = 'loyalty.settings';

    public function all(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, function () {
            $settings = Setting::query()
                ->where('group', 'loyalty')
                ->pluck('value', 'key')
                ->all();

            return [
                'is_enabled' => filter_var($settings['loyalty_is_enabled'] ?? true, FILTER_VALIDATE_BOOLEAN),
                'earn_points_per_currency' => (float) ($settings['loyalty_earn_points_per_currency'] ?? config('loyalty.earn_points_per_currency', 1)),
                'redeem_currency_per_point' => (float) ($settings['loyalty_redeem_currency_per_point'] ?? config('loyalty.redeem_currency_per_point', 0.01)),
                'minimum_redeem_points' => (int) ($settings['loyalty_minimum_redeem_points'] ?? config('loyalty.minimum_redeem_points', 100)),
            ];
        });
    }

    public function isEnabled(): bool
    {
        return (bool) $this->all()['is_enabled'];
    }

    public function earnPointsPerCurrency(): float
    {
        return max(0, (float) $this->all()['earn_points_per_currency']);
    }

    public function redeemCurrencyPerPoint(): float
    {
        return max(0, (float) $this->all()['redeem_currency_per_point']);
    }

    public function minimumRedeemPoints(): int
    {
        return max(0, (int) $this->all()['minimum_redeem_points']);
    }

    public function setMany(array $values): void
    {
        $current = $this->all();

        $payload = [
            'loyalty_is_enabled' => (array_key_exists('is_enabled', $values) ? (bool) $values['is_enabled'] : (bool) $current['is_enabled']) ? '1' : '0',
            'loyalty_earn_points_per_currency' => max(0, (float) ($values['earn_points_per_currency'] ?? $current['earn_points_per_currency'])),
            'loyalty_redeem_currency_per_point' => max(0, (float) ($values['redeem_currency_per_point'] ?? $current['redeem_currency_per_point'])),
            'loyalty_minimum_redeem_points' => max(0, (int) ($values['minimum_redeem_points'] ?? $current['minimum_redeem_points'])),
        ];

        foreach ($payload as $key => $value) {
            Setting::updateOrCreate(
                ['key' => $key],
                ['value' => (string) $value, 'group' => 'loyalty'],
            );
        }

        Cache::forget(self::CACHE_KEY);
    }
}
