<?php

namespace App\Services\Inventory;

use App\Models\{CycleCount, InventoryBalance, Location, Product, User};
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CycleCountService
{
    public function __construct(private InventoryService $inventory, private StockAdjustmentService $adjustments) {}

    public function create(Location $location, array $productIds, User $actor, ?string $notes): CycleCount
    {
        return DB::transaction(function () use ($location, $productIds, $actor, $notes) {
            $count = CycleCount::create(['count_number' => 'CC-'.now()->format('Ymd').'-'.Str::upper(Str::random(8)),
                'location_id' => $location->id, 'created_by' => $actor->id, 'notes' => $notes, 'snapshot_at' => now()]);
            foreach (collect($productIds)->map(fn ($id) => (int) $id)->unique()->sort()->values() as $id) {
                $product = Product::query()->whereKey($id)->lockForUpdate()->firstOrFail();
                $unit = $product->units()->where('is_base', true)->where('is_active', true)->first();
                if (! $unit || (float) $unit->conversion_factor !== 1.0) {
                    throw ValidationException::withMessages(['product_ids' => "{$product->name} needs an active base unit with conversion factor 1."]);
                }
                $balance = $this->balance($location, $product);
                $count->items()->create(['product_id' => $id, 'product_unit_id' => $unit->id, 'product_name' => $product->name,
                    'product_code' => $product->product_code, 'unit_name' => $unit->name, 'system_quantity' => $balance->on_hand_qty,
                    'balance_version' => $balance->version, 'base_cost' => $product->original_price]);
            }
            return $count;
        }, 3);
    }

    public function save(CycleCount $count, array $data): void
    {
        DB::transaction(function () use ($count, $data) {
            $count = $this->draft($count, $data['revision']);
            $items = $count->items()->get()->keyBy('id');
            if (count($data['items']) !== $items->count() || collect($data['items'])->pluck('id')->unique()->count() !== $items->count()) {
                throw ValidationException::withMessages(['items' => 'Save all count lines exactly once.']);
            }
            foreach ($data['items'] as $line) {
                $item = $items->get($line['id']);
                if (! $item) {
                    throw ValidationException::withMessages(['items' => 'A count line does not belong to this session.']);
                }
                $item->update(['counted_quantity' => $line['counted_quantity'], 'notes' => $line['notes'] ?? null]);
            }
            $count->update(['notes' => $data['notes'] ?? null, 'revision' => $count->revision + 1]);
        }, 3);
    }

    public function refresh(CycleCount $count, int $revision): void
    {
        DB::transaction(function () use ($count, $revision) {
            $count = $this->draft($count, $revision);
            foreach ($count->items()->orderBy('product_id')->get() as $item) {
                $product = Product::query()->whereKey($item->product_id)->lockForUpdate()->firstOrFail();
                $balance = $this->balance($count->location, $product);
                $item->update(['system_quantity' => $balance->on_hand_qty, 'balance_version' => $balance->version,
                    'base_cost' => $product->original_price, 'counted_quantity' => null]);
            }
            $count->update(['snapshot_at' => now(), 'revision' => $count->revision + 1]);
        }, 3);
    }

    public function post(CycleCount $count, int $revision, User $actor): void
    {
        DB::transaction(function () use ($count, $revision, $actor) {
            $count = $this->draft($count, $revision);
            if (! $count->location->is_active) {
                throw ValidationException::withMessages(['count' => 'This warehouse is inactive.']);
            }
            $lines = [];
            foreach ($count->items()->with('unit')->orderBy('product_id')->get() as $item) {
                $product = Product::query()->whereKey($item->product_id)->lockForUpdate()->firstOrFail();
                $balance = $this->balance($count->location, $product);
                if ($item->counted_quantity === null) {
                    throw ValidationException::withMessages(['count' => 'Enter a physical count for every selected product. Zero must be entered explicitly.']);
                }
                if ($balance->version !== $item->balance_version || bccomp((string) $balance->on_hand_qty, (string) $item->system_quantity, 4) !== 0
                    || bccomp((string) $product->original_price, (string) $item->base_cost, 6) !== 0) {
                    throw ValidationException::withMessages(['snapshot' => "Stock or cost changed for {$item->product_name}. Refresh the snapshot and recount before posting."]);
                }
                if (! $item->unit || ! $item->unit->is_base || ! $item->unit->is_active || (float) $item->unit->conversion_factor !== 1.0) {
                    throw ValidationException::withMessages(['snapshot' => 'A base unit changed. Cancel this session and start a new count.']);
                }
                if (bccomp((string) $item->counted_quantity, (string) $balance->reserved_qty, 4) < 0) {
                    throw ValidationException::withMessages(['count' => "{$item->product_name}: physical count is below reserved stock. Resolve reservations before posting."]);
                }
                if (bccomp((string) $item->counted_quantity, (string) $item->system_quantity, 4) !== 0) {
                    $lines[] = ['product_unit_id' => $item->product_unit_id, 'counted_quantity' => $item->counted_quantity,
                        'notes' => trim($count->count_number.' '.($item->notes ?: $count->notes))];
                }
            }
            $adjustment = $lines ? $this->adjustments->createPosted($count->location, $lines, 'physical_count', $actor, $count->count_number.' '.$count->notes) : null;
            $count->update(['status' => 'posted', 'posted_by' => $actor->id, 'posted_at' => now(),
                'stock_adjustment_id' => $adjustment?->id, 'revision' => $count->revision + 1]);
        }, 3);
    }

    public function saveAndPost(CycleCount $count, array $data, User $actor): void
    {
        DB::transaction(function () use ($count, $data, $actor) {
            $this->save($count, $data);
            $this->post($count, (int) $data['revision'] + 1, $actor);
        }, 3);
    }

    public function cancel(CycleCount $count, int $revision): void
    {
        DB::transaction(function () use ($count, $revision) {
            $count = $this->draft($count, $revision);
            $count->update(['status' => 'cancelled', 'revision' => $count->revision + 1]);
        });
    }

    private function draft(CycleCount $count, int $revision): CycleCount
    {
        $count = CycleCount::query()->whereKey($count->id)->lockForUpdate()->firstOrFail();
        if ($count->status !== 'draft' || $count->revision !== $revision) {
            throw ValidationException::withMessages(['count' => 'This count has changed or is already closed. Reload before continuing.']);
        }
        return $count;
    }

    private function balance(Location $location, Product $product): InventoryBalance
    {
        $this->inventory->ensureBalance($location, $product);
        return InventoryBalance::query()->where('location_id', $location->id)->where('product_id', $product->id)->lockForUpdate()->firstOrFail();
    }
}
