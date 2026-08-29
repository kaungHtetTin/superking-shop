<?php

namespace App\Services;

use App\Models\Order;
use App\Models\RewardHistory;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LoyaltyService
{
    public function __construct(private LoyaltySettingsService $settings)
    {
    }

    public function redemptionValue(User $user, int $points): float
    {
        if ($points <= 0) {
            return 0.0;
        }

        if (! $this->settings->isEnabled()) {
            throw ValidationException::withMessages([
                'redeem_points' => 'Loyalty points are currently disabled.',
            ]);
        }

        $minimum = $this->settings->minimumRedeemPoints();
        if ($points < $minimum) {
            throw ValidationException::withMessages([
                'redeem_points' => "Redeem at least {$minimum} points.",
            ]);
        }

        if ($points > (int) $user->loyalty_points) {
            throw ValidationException::withMessages([
                'redeem_points' => 'You do not have enough points for this redemption.',
            ]);
        }

        return round($points * $this->settings->redeemCurrencyPerPoint(), 2);
    }

    public function redeemForOrder(User $user, Order $order, int $points): void
    {
        if ($points <= 0) {
            return;
        }

        if (! $this->settings->isEnabled()) {
            throw ValidationException::withMessages([
                'redeem_points' => 'Loyalty points are currently disabled.',
            ]);
        }

        $user->decrement('loyalty_points', $points);

        RewardHistory::create([
            'user_id' => $user->id,
            'order_id' => $order->id,
            'points' => -$points,
            'type' => 'redeem',
            'description' => "Redeemed on order {$order->order_number}",
        ]);

        $this->refreshTier($user->fresh());
    }

    public function restoreRedeemedPoints(Order $order, string $description = 'Order cancelled'): void
    {
        if ($order->redeemed_points <= 0 || $order->points_restored_at) {
            return;
        }

        $user = $order->user;
        if (! $user) {
            return;
        }

        $user->increment('loyalty_points', (int) $order->redeemed_points);

        RewardHistory::create([
            'user_id' => $user->id,
            'order_id' => $order->id,
            'points' => (int) $order->redeemed_points,
            'type' => 'restore',
            'description' => "{$description}: {$order->order_number}",
        ]);

        $order->forceFill(['points_restored_at' => now()])->save();
        $this->refreshTier($user->fresh());
    }

    public function awardForPaidOrder(Order $order): void
    {
        if (! $this->settings->isEnabled() || $order->loyalty_awarded_at || ! $order->user) {
            return;
        }

        $user = $order->user;
        $tier = config('loyalty.tiers.'.$user->tier, config('loyalty.tiers.Bronze'));
        $baseRate = $this->settings->earnPointsPerCurrency();
        $multiplier = (float) ($tier['multiplier'] ?? 1);
        $points = (int) floor((float) $order->final_amount * $baseRate * $multiplier);

        if ($points <= 0) {
            return;
        }

        $user->increment('loyalty_points', $points);

        RewardHistory::create([
            'user_id' => $user->id,
            'order_id' => $order->id,
            'points' => $points,
            'type' => 'earn',
            'description' => "Earned from order {$order->order_number}",
        ]);

        $order->forceFill([
            'earned_points' => $points,
            'loyalty_awarded_at' => now(),
        ])->save();

        $this->refreshTier($user->fresh());
    }

    public function adjustPoints(User $user, int $points, string $description, ?User $actor = null): void
    {
        if ($points === 0) {
            return;
        }

        DB::transaction(function () use ($user, $points, $description, $actor) {
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $current = (int) $locked->loyalty_points;
            if ($points < 0 && abs($points) > $current) {
                throw ValidationException::withMessages([
                    'points' => 'Cannot subtract more points than the customer has.',
                ]);
            }

            $locked->increment('loyalty_points', $points);

            RewardHistory::create([
                'user_id' => $locked->id,
                'points' => $points,
                'type' => 'manual_adjustment',
                'description' => trim(($actor ? "Adjusted by {$actor->name}: " : '').$description),
            ]);

            $this->refreshTier($locked->fresh());
        });
    }

    public function refreshTier(User $user): void
    {
        $points = (int) $user->loyalty_points;
        $tierName = 'Bronze';

        foreach (config('loyalty.tiers', []) as $name => $tier) {
            if ($points >= (int) ($tier['threshold'] ?? 0)) {
                $tierName = $name;
            }
        }

        if ($user->tier !== $tierName) {
            $user->forceFill(['tier' => $tierName])->save();
        }
    }
}
