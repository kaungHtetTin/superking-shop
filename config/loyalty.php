<?php

return [
    'earn_points_per_currency' => 1,
    'redeem_currency_per_point' => 0.01,
    'minimum_redeem_points' => 100,
    'tiers' => [
        'Bronze' => ['threshold' => 0, 'multiplier' => 1.0],
        'Silver' => ['threshold' => 1000, 'multiplier' => 1.1],
        'Gold' => ['threshold' => 3000, 'multiplier' => 1.25],
        'Platinum' => ['threshold' => 7500, 'multiplier' => 1.5],
    ],
];
