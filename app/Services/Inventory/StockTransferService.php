<?php

namespace App\Services\Inventory;

use App\Events\StockTransferStatusChanged;
use App\Models\InventoryBalance;
use App\Models\FinancialEntry;
use App\Models\Location;
use App\Models\ProductUnit;
use App\Models\StockTransfer;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StockTransferService
{
    public function __construct(private InventoryService $inventoryService)
    {
    }

    public function createDraft(Location $source, Location $destination, array $lines, User $actor): StockTransfer
    {
        return $this->transferNow($source, $destination, $lines, $actor);
    }

    public function transferNow(Location $source, Location $destination, array $lines, User $actor, array $details = []): StockTransfer
    {
        if ($source->id === $destination->id) {
            throw ValidationException::withMessages(['destination_location_id' => 'Source and destination must be different.']);
        }
        $transfer = DB::transaction(function () use ($source, $destination, $lines, $actor, $details) {
            $now = now();
            $normalizedLines = $this->normalizeLines($source, $lines);
            $totalAmount = round(collect($normalizedLines)->sum('line_total'), 2);
            $transfer = StockTransfer::create(['transfer_number' => $this->number(), 'source_location_id' => $source->id, 'destination_location_id' => $destination->id, 'status' => 'received', 'total_amount' => $totalAmount, 'notes' => $details['notes'] ?? null, 'created_by' => $actor->id, 'shipped_by' => $actor->id, 'received_by' => $actor->id, 'shipped_at' => $now, 'received_at' => $now]);
            foreach ($normalizedLines as $line) {
                $item = $transfer->items()->create(array_merge($line, ['shipped_quantity' => $line['requested_quantity'], 'received_quantity' => $line['requested_quantity']]));
                $unit = ProductUnit::query()->with('product')->findOrFail($line['product_unit_id']);
                $out = $this->inventoryService->shipTransfer($source, $unit->product, (float) $line['requested_base_quantity'], $actor, "transfer:{$transfer->id}:out:item:{$item->id}", $transfer, null, $unit, (float) $line['requested_quantity']);
                $in = $this->inventoryService->receiveTransfer($destination, $unit->product, (float) $line['requested_base_quantity'], $actor, "transfer:{$transfer->id}:in:item:{$item->id}", $transfer, null, $unit, (float) $line['requested_quantity']);
                $item->update(['transfer_out_movement_id' => $out->id, 'transfer_in_movement_id' => $in->id]);
            }

            // Moving owned inventory is neither external revenue nor a purchase.
            // The document and its paired movements retain the transferred value.

            return $transfer->load(['items.product', 'items.unit']);
        }, 3);
        StockTransferStatusChanged::dispatch($transfer);

        return $transfer;
    }

    public function delete(StockTransfer $transfer, User $actor): void
    {
        $deletedTransfer = DB::transaction(function () use ($transfer, $actor) {
            $locked = StockTransfer::query()
                ->lockForUpdate()
                ->with([
                    'sourceLocation',
                    'destinationLocation',
                    'items.product',
                    'items.unit',
                    'items.transferOutMovement',
                    'items.transferInMovement',
                ])
                ->findOrFail($transfer->id);

            foreach ($locked->items as $item) {
                $receivedBaseQuantity = $item->transferInMovement
                    ? max(0, (float) $item->transferInMovement->quantity_delta)
                    : max(0, (float) ($item->received_quantity ?? 0) * (float) $item->conversion_factor);
                $receivedUnitQuantity = $item->transferInMovement?->unit_quantity !== null
                    ? (float) $item->transferInMovement->unit_quantity
                    : (float) ($item->received_quantity ?? 0);

                // Remove destination stock first. If it has since been sold or
                // reserved, InventoryService rejects the reversal and the whole
                // transaction rolls back without changing any transfer records.
                if ($receivedBaseQuantity > 0.00005) {
                    $this->inventoryService->adjust(
                        $locked->destinationLocation,
                        $item->product,
                        -$receivedBaseQuantity,
                        'transfer_delete',
                        $actor,
                        "transfer-delete:{$locked->id}:in:item:{$item->id}",
                        null,
                        "Reversed deleted transfer {$locked->transfer_number} (destination).",
                        $item->unit,
                        -$receivedUnitQuantity,
                    );
                }

                $shippedBaseQuantity = $item->transferOutMovement
                    ? abs(min(0, (float) $item->transferOutMovement->quantity_delta))
                    : max(0, (float) ($item->shipped_quantity ?? 0) * (float) $item->conversion_factor);
                $shippedUnitQuantity = $item->transferOutMovement?->unit_quantity !== null
                    ? (float) $item->transferOutMovement->unit_quantity
                    : (float) ($item->shipped_quantity ?? 0);

                if ($shippedBaseQuantity > 0.00005) {
                    $this->inventoryService->adjust(
                        $locked->sourceLocation,
                        $item->product,
                        $shippedBaseQuantity,
                        'transfer_delete',
                        $actor,
                        "transfer-delete:{$locked->id}:out:item:{$item->id}",
                        null,
                        "Reversed deleted transfer {$locked->transfer_number} (source).",
                        $item->unit,
                        $shippedUnitQuantity,
                    );
                }
            }

            FinancialEntry::query()
                ->where(function ($query) use ($locked) {
                    $query->where('stock_transfer_id', $locked->id)
                        ->orWhere(fn ($legacy) => $legacy->where('reference', $locked->transfer_number)
                            ->whereIn('category', [FinancialEntry::CATEGORY_INTERNAL_TRANSFER, FinancialEntry::CATEGORY_STOCK_RECEIPT]));
                })
                ->delete();

            $deleted = clone $locked;
            $deleted->status = 'deleted';
            $locked->delete();

            return $deleted;
        }, 3);

        StockTransferStatusChanged::dispatch($deletedTransfer);
    }

    private function normalizeLines(Location $source, array $lines): array
    {
        $seen = [];
        $normalized = [];
        foreach ($lines as $line) {
            $unit = ProductUnit::query()->with('product')->find((int) ($line['product_unit_id'] ?? 0));
            if (! $unit || isset($seen[$unit->product_id])) {
                throw ValidationException::withMessages(['items' => 'Transfer products must be valid and unique.']);
            }
            $seen[$unit->product_id] = true;
            $unit->setRelation('product', \App\Models\Product::query()->whereKey($unit->product_id)->lockForUpdate()->firstOrFail());
            $quantity = round((float) $line['requested_quantity'], 4);
            if ($quantity <= 0) {
                throw ValidationException::withMessages(['items' => 'Every transfer line needs a positive quantity.']);
            }
            $baseQuantity = $unit->toBaseQuantity($quantity);
            $available = (float) (InventoryBalance::query()->where('location_id', $source->id)->where('product_id', $unit->product_id)->first()?->available_qty ?? 0);
            if ($baseQuantity > $available + 0.00005) {
                throw ValidationException::withMessages(['items' => "Requested quantity for {$unit->product->product_code} exceeds available base stock ({$available})."]);
            }
            $normalized[] = ['product_id' => $unit->product_id, 'product_unit_id' => $unit->id, 'conversion_factor' => $unit->conversion_factor, 'requested_quantity' => $quantity, 'requested_base_quantity' => $baseQuantity];
            $normalized[array_key_last($normalized)]['unit_cost'] = round((float) $unit->product->original_price * (float) $unit->conversion_factor, 2);
            $normalized[array_key_last($normalized)]['line_total'] = round((float) $unit->product->original_price * $baseQuantity, 2);
        }
        if (! $normalized) {
            throw ValidationException::withMessages(['items' => 'Add at least one transfer item.']);
        }

        return $normalized;
    }

    private function number(): string
    {
        do {
            $number = 'TRF-'.now()->format('Ymd').'-'.strtoupper(Str::random(6));
        } while (StockTransfer::query()->where('transfer_number', $number)->exists());

        return $number;
    }
}
