<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use Illuminate\Foundation\Application;
use App\Support\Spa;

use App\Models\Product;
use App\Models\BlogPost;
use App\Models\Category;
use App\Models\OrderItem;
use App\Models\PaymentMethod;
use App\Models\StorefrontBlock;
use App\Services\FlashSalePricingService;
use App\Services\Inventory\StorefrontInventoryService;
use Illuminate\Support\Facades\DB;

class HomeController extends Controller
{
    public function index(
        FlashSalePricingService $flashSalePricing,
        StorefrontInventoryService $storefrontInventory
    )
    {
        $productRelations = [
            'category',
            'primaryImage',
            'units.prices',
            'baseUnit',
            'defaultSellingUnit',
        ];

        $latestProducts = Product::with($productRelations)
            ->active()
            ->inActiveCategory()
            ->availableAnywhere()
            ->latest()
            ->take(12)
            ->get();

        $bestSellerIds = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.payment_status', 'paid')
            ->groupBy('order_items.product_id')
            ->orderByDesc(DB::raw('SUM(order_items.quantity)'))
            ->limit(12)
            ->pluck('order_items.product_id')
            ->all();

        $products = $latestProducts;
        $productSection = [
            'source' => $latestProducts->isNotEmpty() ? 'new_arrivals' : 'empty',
            'title' => $latestProducts->isNotEmpty() ? 'New arrivals on the wall' : 'Ready for your first products',
            'subtitle' => $latestProducts->isNotEmpty()
                ? 'No paid sales history yet, so we are featuring the newest instruments and gear in stock.'
                : 'Add instruments, accessories, and stock from the admin panel to start filling this section.',
            'empty_title' => 'No products are ready for the storefront yet',
            'empty_subtitle' => 'Create active products with available stock to show a polished customer-facing selection here.',
        ];

        if (! empty($bestSellerIds)) {
            $bestSellerProducts = Product::with($productRelations)
                ->whereIn('id', $bestSellerIds)
                ->active()
                ->inActiveCategory()
                ->availableAnywhere()
                ->orderByRaw('FIELD(id, '.implode(',', array_map('intval', $bestSellerIds)).')')
                ->get();

            if ($bestSellerProducts->isNotEmpty()) {
                $products = $bestSellerProducts;
                $productSection = [
                    'source' => 'best_sellers',
                    'title' => 'Stage-tested favorites',
                    'subtitle' => 'Reliable picks customers keep coming back for.',
                    'empty_title' => 'No best sellers yet',
                    'empty_subtitle' => 'Paid orders will automatically shape this section over time.',
                ];
            }
        }

        $activeFlashSales = $flashSalePricing->activeSales();
        $flashSaleEvents = $activeFlashSales
            ->map(function ($sale) use ($productRelations, $flashSalePricing, $storefrontInventory) {
                $flashSaleProductIds = $sale->items
                    ->pluck('unit.product_id')
                    ->filter()
                    ->unique()
                    ->values()
                    ->all();

                $flashSaleProducts = collect();
                if (! empty($flashSaleProductIds)) {
                    $productOrder = array_flip($flashSaleProductIds);
                    $flashSaleProducts = Product::with($productRelations)
                        ->whereIn('id', $flashSaleProductIds)
                        ->active()
                        ->inActiveCategory()
                        ->availableAnywhere()
                        ->get()
                        ->sortBy(fn (Product $product) => $productOrder[$product->id] ?? PHP_INT_MAX)
                        ->take(8)
                        ->values();

                    $flashSalePricing->attachToProducts($flashSaleProducts);
                    $storefrontInventory->attachAvailableQuantitiesAcrossLocations($flashSaleProducts);
                }

                return [
                    'id' => $sale->id,
                    'name' => $sale->name,
                    'starts_at' => $sale->starts_at,
                    'ends_at' => $sale->ends_at,
                    'products' => $flashSaleProducts,
                ];
            })
            ->filter(fn (array $event) => $event['products']->isNotEmpty())
            ->values();

        $activeFlashSale = $flashSaleEvents->first();
        $flashSaleProducts = $flashSaleEvents
            ->flatMap(fn (array $event) => $event['products'])
            ->unique('id')
            ->values();

        $flashSalePricing->attachToProducts($products);
        $storefrontInventory->attachAvailableQuantitiesAcrossLocations($products);

        $categories = Category::where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->filter(fn ($category) => ($category->metadata['homepage_featured'] ?? true) === true)
            ->values();

        $hero = StorefrontBlock::where('type', StorefrontBlock::TYPE_HERO)
            ->orderBy('sort_order')
            ->first();
        $promos = StorefrontBlock::where('type', StorefrontBlock::TYPE_PROMO)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
        $sections = StorefrontBlock::where('type', StorefrontBlock::TYPE_SECTION)
            ->where('key', '!=', 'newsletter')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->keyBy('key')
            ->map(fn ($section) => [
                'key' => $section->key,
                'title' => $section->title,
                'subtitle' => $section->subtitle,
                'sort_order' => $section->sort_order,
                'is_active' => $section->is_active,
            ])
            ->all();

        $latestBlogs = BlogPost::query()
            ->published()
            ->with(['category', 'tags', 'author:id,name'])
            ->latest('published_at')
            ->take(3)
            ->get();

        $paymentMethods = PaymentMethod::active()
            ->ordered()
            ->take(6)
            ->get();

        return Spa::render('User/Welcome', [
            'products' => $products,
            'productSection' => $productSection,
            'flashSaleProducts' => $flashSaleProducts,
            'activeFlashSale' => $activeFlashSale ? [
                'id' => $activeFlashSale['id'],
                'name' => $activeFlashSale['name'],
                'starts_at' => $activeFlashSale['starts_at'],
                'ends_at' => $activeFlashSale['ends_at'],
            ] : null,
            'flashSaleEvents' => $flashSaleEvents,
            'categories' => $categories,
            'storefront' => [
                'hero' => $hero,
                'promos' => $promos,
                'sections' => $sections,
            ],
            'latestBlogs' => $latestBlogs,
            'paymentMethods' => $paymentMethods,
            'canLogin' => true,
            'canRegister' => true,
            'laravelVersion' => Application::VERSION,
            'phpVersion' => PHP_VERSION,
        ]);
    }
}
