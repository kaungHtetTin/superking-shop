<?php

namespace App\Services\Inventory;

use App\Models\InventoryBalance;
use App\Models\InventoryMovement;

class InventoryReconciliationService
{
    /**
     * @return array{mismatch_count:int, checked_balances:int, mismatches:array<int,array<string,mixed>>}
     */
    public function run(): array
    {
        $ledger = InventoryMovement::query()
            ->selectRaw('location_id, product_id, SUM(quantity_delta) as on_hand_qty, SUM(reserved_delta) as reserved_qty')
            ->groupBy('location_id', 'product_id')
            ->get()
            ->keyBy(fn ($row) => $row->location_id.':'.$row->product_id);

        $balances = InventoryBalance::query()
            ->with(['location:id,code', 'product:id,product_code'])
            ->get();
        $mismatches = [];

        foreach ($balances as $balance) {
            $key = $balance->location_id.':'.$balance->product_id;
            $ledgerRow = $ledger->pull($key);
            $ledgerOnHand = (float) ($ledgerRow->on_hand_qty ?? 0);
            $ledgerReserved = (float) ($ledgerRow->reserved_qty ?? 0);

            if (abs($ledgerOnHand - (float) $balance->on_hand_qty) > 0.00005 || abs($ledgerReserved - (float) $balance->reserved_qty) > 0.00005) {
                $mismatches[] = [
                    'location_id' => $balance->location_id,
                    'location_code' => $balance->location?->code,
                    'product_id' => $balance->product_id,
                    'product_code' => $balance->product?->product_code,
                    'balance_on_hand' => $balance->on_hand_qty,
                    'ledger_on_hand' => $ledgerOnHand,
                    'balance_reserved' => $balance->reserved_qty,
                    'ledger_reserved' => $ledgerReserved,
                ];
            }
        }

        foreach ($ledger as $row) {
            if (abs((float) $row->on_hand_qty) < 0.00005 && abs((float) $row->reserved_qty) < 0.00005) {
                continue;
            }
            $mismatches[] = [
                'location_id' => (int) $row->location_id,
                'product_id' => (int) $row->product_id,
                'balance_on_hand' => null,
                'ledger_on_hand' => (float) $row->on_hand_qty,
                'balance_reserved' => null,
                'ledger_reserved' => (float) $row->reserved_qty,
            ];
        }

        return [
            'mismatch_count' => count($mismatches),
            'checked_balances' => $balances->count(),
            'mismatches' => array_slice($mismatches, 0, 100),
        ];
    }
}
