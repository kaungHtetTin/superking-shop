<?php

return [
    'default_opening_location' => env('INVENTORY_OPENING_LOCATION', 'MAIN-WH'),
    'allow_negative_stock' => env('INVENTORY_ALLOW_NEGATIVE_STOCK', false),
    'adjustment_approval_quantity' => (int) env('INVENTORY_ADJUSTMENT_APPROVAL_QUANTITY', 10),
    'adjustment_approval_value' => (float) env('INVENTORY_ADJUSTMENT_APPROVAL_VALUE', 500),
    'inventory_v2_enabled' => env('INVENTORY_V2_ENABLED', true),
    'pos_enabled' => env('POS_ENABLED', true),
    'online_reservation_timeout_minutes' => (int) env('ONLINE_RESERVATION_TIMEOUT_MINUTES', 120),
    'default_fulfillment_location_code' => env('DEFAULT_FULFILLMENT_LOCATION', 'MAIN-WH'),
    'low_stock_digest_time' => env('INVENTORY_LOW_STOCK_DIGEST_TIME', '08:00'),
    'transfer_stale_days' => (int) env('INVENTORY_TRANSFER_STALE_DAYS', 3),
    'backup_path' => env('OPERATIONS_BACKUP_PATH'),
    'backup_stale_hours' => (int) env('OPERATIONS_BACKUP_STALE_HOURS', 48),
];
