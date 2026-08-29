<?php

namespace App\Services\Inventory;

use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\Product;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class StorefrontInventoryService
{
    public function fulfillmentLocation(): Location
    {
        $configuredCode = strtoupper((string) config('inventory.default_fulfillment_location_code'));
        $location = Location::query()
            ->where('is_active', true)
            ->where(fn ($query) => $query->where('is_default_fulfillment', true)->orWhere('code', $configuredCode))
            ->orderByDesc('is_default_fulfillment')
            ->first();

        if (! $location) {
            throw ValidationException::withMessages(['inventory' => 'No active online fulfillment location is configured.']);
        }

        return $location;
    }

    public function attachAvailableQuantities(iterable $products, ?Location $location = null): void
    {
        $location ??= $this->fulfillmentLocation();
        $products = $products instanceof Collection ? $products : collect($products);
        $this->ensureUnitsLoaded($products);
        $balances = InventoryBalance::query()
            ->where('location_id', $location->id)
            ->whereIn('product_id', $products->pluck('id'))
            ->get()
            ->keyBy('product_id');

        foreach ($products as $product) {
            $this->attachToProduct($product, (float) ($balances->get($product->id)?->available_qty ?? 0));
        }
    }

    public function attachAvailableQuantitiesAcrossLocations(iterable $products): void
    {
        $products = $products instanceof Collection ? $products : collect($products);
        $this->ensureUnitsLoaded($products);
        $available = InventoryBalance::query()
            ->whereIn('product_id', $products->pluck('id'))
            ->whereHas('location', fn ($location) => $location->where('is_active', true))
            ->get()
            ->groupBy('product_id')
            ->map(fn (Collection $balances) => $balances->sum(fn (InventoryBalance $balance) => max(0, $balance->available_qty)));

        foreach ($products as $product) {
            $this->attachToProduct($product, (float) ($available->get($product->id) ?? 0));
        }
    }

    private function ensureUnitsLoaded(Collection $products): void
    {
        $products->each(fn (Product $product) => $product->loadMissing(['units.prices', 'baseUnit', 'defaultSellingUnit']));
    }

    private function attachToProduct(Product $product, float $baseAvailable): void
    {
        $product->setAttribute('available_base_qty', round($baseAvailable, 4));
        $product->setAttribute('available_qty', round($baseAvailable, 4));
        $product->setAttribute('stock_display', $product->displayQuantity($baseAvailable));

        foreach ($product->units as $unit) {
            $factor = max((float) $unit->conversion_factor, 0.000001);
            $unit->setAttribute('available_qty', floor((($baseAvailable / $factor) + 0.0000001) * 10000) / 10000);
            $unit->setAttribute('can_sell', $baseAvailable + 0.00005 >= $factor);
        }
    }
}
