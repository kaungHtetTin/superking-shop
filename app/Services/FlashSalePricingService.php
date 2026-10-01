<?php

namespace App\Services;

use App\Models\FlashSale;
use App\Models\FlashSaleItem;
use App\Models\ProductUnit;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

class FlashSalePricingService
{
    public function activeSales()
    {
        return FlashSale::query()->activeNow()->with(['items.unit.product'])->orderByDesc('starts_at')->get();
    }

    public function activeSale()
    {
        return $this->activeSales()->first();
    }

    public function attachToProducts(iterable $products): void
    {
        $unitIds = collect($products)->flatMap(fn ($product) => $product->units?->pluck('id') ?? [])->filter()->unique()->values();
        if ($unitIds->isEmpty()) {
            return;
        }

        $items = $this->activeItemsForUnitIds($unitIds->all());
        foreach ($products as $product) {
            foreach ($product->units ?? [] as $unit) {
                if ($item = $items->get($unit->id)) {
                    $this->attachToUnit($unit, $item);
                }
            }
        }
    }

    public function activeItemsForUnitIds(array $unitIds, bool $lock = false): Collection
    {
        if (empty($unitIds)) {
            return collect();
        }

        $query = FlashSaleItem::query()
            ->select('flash_sale_items.*')
            ->join('flash_sales', 'flash_sales.id', '=', 'flash_sale_items.flash_sale_id')
            ->where('flash_sales.is_active', true)
            ->where('flash_sales.starts_at', '<=', now())
            ->where('flash_sales.ends_at', '>=', now())
            ->whereIn('flash_sale_items.product_unit_id', $unitIds)
            ->with('flashSale')
            ->orderByDesc('flash_sales.starts_at');
        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->get()->keyBy('product_unit_id');
    }

    public function effectivePrice(ProductUnit $unit, ?FlashSaleItem $item = null): float
    {
        $price = (float) ($unit->priceFor('retail')?->price ?? 0);

        return $item ? $item->salePrice($price) : round($price, 2);
    }

    public function posOffer(?FlashSaleItem $item, float $retailPrice): ?array
    {
        if (! $item || $retailPrice <= 0 || ($item->remainingQuantity() !== null && $item->remainingQuantity() <= 0)) {
            return null;
        }

        $salePrice = $item->salePrice($retailPrice);
        if ($salePrice >= $retailPrice) {
            return null;
        }

        return [
            'item_id' => $item->id,
            'name' => $item->flashSale?->name,
            'discount_type' => $item->discount_type,
            'discount_value' => (float) $item->discount_value,
            'original_price' => $retailPrice,
            'sale_price' => $salePrice,
            'remaining_qty' => $item->remainingQuantity(),
        ];
    }

    public function attachToUnit(ProductUnit $unit, FlashSaleItem $item): void
    {
        $originalPrice = (float) ($unit->priceFor('retail')?->price ?? 0);
        $salePrice = $item->salePrice($originalPrice);
        $unit->setAttribute('flash_sale', [
            'id' => $item->flash_sale_id,
            'item_id' => $item->id,
            'name' => $item->flashSale?->name,
            'discount_type' => $item->discount_type,
            'discount_value' => (float) $item->discount_value,
            'original_price' => $originalPrice,
            'sale_price' => $salePrice,
            'starts_at' => optional($item->flashSale?->starts_at)->toIso8601String(),
            'ends_at' => optional($item->flashSale?->ends_at)->toIso8601String(),
            'quantity_limit' => $item->quantity_limit,
            'sold_count' => $item->sold_count,
            'remaining_qty' => $item->remainingQuantity(),
        ]);
        $unit->setAttribute('effective_price', $salePrice);
    }

    public function attachToUnitCollection(EloquentCollection $units): void
    {
        $items = $this->activeItemsForUnitIds($units->pluck('id')->all());
        foreach ($units as $unit) {
            if ($item = $items->get($unit->id)) {
                $this->attachToUnit($unit, $item);
            }
        }
    }
}
