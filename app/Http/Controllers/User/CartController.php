<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\FlashSalePricingService;
use App\Services\Inventory\StorefrontInventoryService;
use App\Support\Spa;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function index()
    {
        return Spa::render('User/Cart/Index');
    }

    public function sellingUnits(
        Request $request,
        FlashSalePricingService $flashSalePricing,
        StorefrontInventoryService $storefrontInventory
    ) {
        $validated = $request->validate([
            'product_ids' => ['required', 'array', 'min:1', 'max:100'],
            'product_ids.*' => ['required', 'integer', 'distinct'],
        ]);

        $products = Product::query()
            ->whereIn('id', $validated['product_ids'])
            ->active()
            ->inActiveCategory()
            ->with(['units' => fn ($query) => $query
                ->where('is_active', true)
                ->with('prices')
                ->orderByDesc('is_default_selling')
                ->orderBy('sort_order')])
            ->get();

        $storefrontInventory->attachAvailableQuantitiesAcrossLocations($products);
        $flashSalePricing->attachToProducts($products);

        return response()->json([
            'products' => $products->mapWithKeys(fn (Product $product) => [
                $product->id => $product->units->values(),
            ]),
        ]);
    }
}
