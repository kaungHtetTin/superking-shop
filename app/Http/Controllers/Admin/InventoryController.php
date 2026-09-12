<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\StockAdjustment;
use App\Models\StockReceipt;
use App\Models\StockTransfer;
use App\Support\Spa;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class InventoryController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->hasAdminPermission('inventory.view'), 403);
        $locationIds = $request->user()->accessibleLocationIds();
        $locations = Location::query()->whereIn('id', $locationIds)->orderBy('name')->get(['id', 'code', 'name', 'type']);
        $filteredLocationIds = $this->filteredLocationIds($request, $locationIds);
        $aggregate = $this->isAllWarehousesFilter($request);
        $query = $this->stockOverviewQuery($filteredLocationIds, $aggregate);

        if ($request->filled('q')) {
            $term = trim($request->q);
            $query->where(fn ($scope) => $scope
                ->where('products.product_code', 'like', "%{$term}%")
                ->orWhere('products.barcode', 'like', "%{$term}%")
                ->orWhere('products.name', 'like', "%{$term}%"));
        }
        if ($request->filled('category') && $request->category !== 'all') {
            $query->where('products.category_id', (int) $request->category);
        }
        if ($request->boolean('out_of_stock')) {
            $aggregate
                ? $query->havingRaw('(SUM(COALESCE(balances.on_hand_qty, 0)) - SUM(COALESCE(balances.reserved_qty, 0))) <= 0')
                : $query->whereRaw('(COALESCE(balances.on_hand_qty, 0) - COALESCE(balances.reserved_qty, 0)) <= 0');
        }

        $paginator = $query->orderBy('products.name')->when(! $aggregate, fn ($scope) => $scope->orderBy('locations.name'))->paginate(30)->withQueryString();
        $inTransit = $this->inTransitQuantities(
            $aggregate ? $filteredLocationIds : $paginator->getCollection()->pluck('location_id')->map(fn ($id) => (int) $id)->unique()->all(),
            $paginator->getCollection()->pluck('product_id')->map(fn ($id) => (int) $id)->unique()->all(),
            $aggregate
        );
        $unitsByProduct = ProductUnit::query()
            ->whereIn('product_id', $paginator->getCollection()->pluck('product_id')->unique())
            ->where('is_active', true)
            ->orderByDesc('conversion_factor')
            ->get(['id', 'product_id', 'name', 'code', 'conversion_factor', 'is_base', 'is_default_selling', 'is_active'])
            ->groupBy('product_id');
        $paginator->getCollection()->transform(function (object $row) use ($aggregate, $inTransit, $unitsByProduct) {
            $key = $aggregate ? "all:{$row->product_id}" : "{$row->location_id}:{$row->product_id}";

            return $this->stockOverviewRow($row, (float) ($inTransit[$key] ?? 0), $unitsByProduct->get($row->product_id, collect())->values()->all());
        });

        return Spa::render('Admin/Inventory/Index', [
            'balances' => $paginator,
            'locations' => $locations,
            'categories' => Category::query()->orderBy('name')->get(['id', 'name']),
            'filters' => ['location' => $request->string('location')->toString() ?: 'all', 'category' => $request->string('category')->toString() ?: 'all', 'q' => $request->string('q')->toString(), 'out_of_stock' => $request->boolean('out_of_stock')],
            'can' => ['history' => $request->user()->hasAdminPermission('inventory.history'), 'receive' => $request->user()->hasAdminPermission('inventory.receive'), 'adjust' => $request->user()->hasAdminPermission('inventory.adjust.create'), 'transfer' => $request->user()->hasAdminPermission('inventory.transfer.create'), 'realtimeAll' => $request->user()->hasAdminPermission('locations.manage')],
            'lastUpdated' => now()->toIso8601String(),
            'pollIntervalMs' => 20000,
        ]);
    }

    public function show(Request $request, Product $product)
    {
        abort_unless($request->user()->hasAdminPermission('inventory.history'), 403);
        $locationIds = $request->user()->accessibleLocationIds();
        $product->load(['baseUnit', 'defaultSellingUnit', 'units.prices']);
        $movements = InventoryMovement::query()->where('product_id', $product->id)->whereIn('location_id', $locationIds)->with(['location:id,code,name,type', 'creator:id,name', 'unit:id,name,code']);
        if ($request->filled('location')) {
            $movements->where('location_id', (int) $request->location);
        }
        if ($request->filled('type')) {
            $movements->where('type', $request->type);
        }
        if ($request->filled('from')) {
            $movements->where('occurred_at', '>=', Carbon::parse($request->from)->startOfDay());
        }
        if ($request->filled('to')) {
            $movements->where('occurred_at', '<=', Carbon::parse($request->to)->endOfDay());
        }

        $balances = InventoryBalance::query()->where('product_id', $product->id)->whereIn('location_id', $locationIds)->with('location:id,code,name,type')->orderBy('location_id')->get();
        $balances->each(fn (InventoryBalance $balance) => $balance->setAttribute('stock_display', $product->displayQuantity($balance->available_qty)));

        return Spa::render('Admin/Inventory/ProductShow', [
            'product' => $product,
            'balances' => $balances,
            'movements' => $movements->latest('occurred_at')->paginate(30)->withQueryString()->through(fn (InventoryMovement $movement) => array_merge($movement->toArray(), ['document' => $this->movementDocument($movement)])),
            'locations' => Location::query()->whereIn('id', $locationIds)->orderBy('name')->get(['id', 'code', 'name']),
            'types' => InventoryMovement::query()->where('product_id', $product->id)->distinct()->orderBy('type')->pluck('type'),
            'filters' => $request->only(['location', 'type', 'from', 'to']),
            'realtime' => ['locationIds' => $locationIds, 'canAll' => $request->user()->hasAdminPermission('locations.manage')],
            'lastUpdated' => now()->toIso8601String(),
            'pollIntervalMs' => 20000,
        ]);
    }

    public function searchProducts(Request $request)
    {
        abort_unless($request->user()->hasAdminPermission('inventory.view') || $request->user()->hasAdminPermission('inventory.receive') || $request->user()->hasAdminPermission('inventory.adjust.create') || $request->user()->hasAdminPermission('inventory.transfer.create'), 403);
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'location_id' => ['required', 'integer', 'exists:locations,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'paginated' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
            'group_by_product' => ['nullable', 'boolean'],
        ]);
        $location = Location::findOrFail($validated['location_id']);
        abort_unless($request->user()->canAccessLocation($location), 403);
        $term = trim($validated['q'] ?? '');

        if ($request->boolean('group_by_product')) {
            $products = Product::query()
                ->where('is_active', true)
                ->whereHas('units', fn ($scope) => $scope->where('is_active', true)->where('is_base', true))
                ->with([
                    'primaryImage:id,product_id,image_path',
                    'inventoryBalances' => fn ($scope) => $scope->where('location_id', $location->id),
                    'units' => fn ($scope) => $scope->where('is_active', true)->with('prices')->orderByDesc('is_base')->orderBy('sort_order'),
                ])
                ->when($term !== '', fn ($scope) => $scope->where(fn ($inner) => $inner
                    ->where('name', 'like', "%{$term}%")
                    ->orWhere('product_code', 'like', "%{$term}%")
                    ->orWhere('sku', 'like', "%{$term}%")
                    ->orWhere('barcode', 'like', "%{$term}%")
                    ->orWhereHas('units', fn ($units) => $units->where('is_active', true)->where(fn ($unit) => $unit
                        ->where('name', 'like', "%{$term}%")
                        ->orWhere('code', 'like', "%{$term}%")))))
                ->when(! empty($validated['category_id']), fn ($scope) => $scope->where('category_id', $validated['category_id']))
                ->orderBy('name');

            $mapProduct = function (Product $product) {
                $balance = $product->inventoryBalances->first();
                $baseAvailable = (float) ($balance?->available_qty ?? 0);
                $baseOnHand = (float) ($balance?->on_hand_qty ?? 0);
                $baseUnit = $product->units->firstWhere('is_base', true);
                $buyingCost = app(\App\Services\AutomaticPricingService::class)->readCost($product);

                $unitPayload = fn (ProductUnit $unit) => [
                    'id' => $unit->id,
                    'product_unit_id' => $unit->id,
                    'product_id' => $product->id,
                    'product_code' => $product->product_code,
                    'product_sku' => $product->sku,
                    'barcode' => $product->barcode,
                    'product_name' => $product->name,
                    'unit_name' => $unit->name,
                    'unit_code' => $unit->code,
                    'name' => $unit->name,
                    'code' => $unit->code,
                    'conversion_factor' => (float) $unit->conversion_factor,
                    'is_base' => (bool) $unit->is_base,
                    'is_default_selling' => (bool) $unit->is_default_selling,
                    'image_path' => $product->primaryImage?->image_path,
                    'original_price' => (float) $product->original_price,
                    'buying_cost' => (float) $buyingCost,
                    'prices' => $unit->prices->map(fn ($price) => ['price_type' => $price->price_type, 'price' => (string) $price->price, 'is_manual' => $price->is_manual, 'calculation_status' => $price->calculation_status])->values(),
                    'on_hand_qty' => $unit->fromBaseQuantity($baseOnHand),
                    'available_base_qty' => $baseAvailable,
                    'available_qty' => $unit->fromBaseQuantity($baseAvailable),
                ];

                return array_merge($unitPayload($baseUnit), [
                    'unit_options' => $product->units->map($unitPayload)->values(),
                ]);
            };

            return $request->boolean('paginated')
                ? $products->paginate((int) ($validated['per_page'] ?? 10))->withQueryString()->through($mapProduct)
                : $products->limit(20)->get()->map($mapProduct);
        }

        $query = ProductUnit::query()
            ->where('is_active', true)
            ->with(['prices', 'product:id,name,product_code,sku,barcode,original_price,pricing_base_cost,pricing_buying_cost,category_id', 'product.primaryImage:id,product_id,image_path', 'product.inventoryBalances' => fn ($scope) => $scope->where('location_id', $location->id)])
            ->when($term !== '', fn ($scope) => $scope->where(fn ($inner) => $inner
                ->where('name', 'like', "%{$term}%")
                ->orWhere('code', 'like', "%{$term}%")
                ->orWhereHas('product', fn ($product) => $product->where('name', 'like', "%{$term}%")->orWhere('product_code', 'like', "%{$term}%")->orWhere('sku', 'like', "%{$term}%")->orWhere('barcode', 'like', "%{$term}%"))))
            ->when(! empty($validated['category_id']), fn ($scope) => $scope->whereHas('product', fn ($product) => $product->where('category_id', $validated['category_id'])))
            ->whereHas('product', fn ($scope) => $scope->where('is_active', true))
            ->orderBy(Product::select('name')->whereColumn('products.id', 'product_units.product_id'))
            ->orderBy('sort_order');

        $map = function (ProductUnit $unit) {
            $balance = $unit->product->inventoryBalances->first();
            $baseAvailable = (float) ($balance?->available_qty ?? 0);
            $buyingCost = app(\App\Services\AutomaticPricingService::class)->readCost($unit->product);

            return [
                'id' => $unit->id,
                'product_unit_id' => $unit->id,
                'product_id' => $unit->product_id,
                'product_code' => $unit->product->product_code,
                'product_sku' => $unit->product->sku,
                'barcode' => $unit->product->barcode,
                'product_name' => $unit->product->name,
                'unit_name' => $unit->name,
                'unit_code' => $unit->code,
                'conversion_factor' => (float) $unit->conversion_factor,
                'is_base' => $unit->is_base,
                'is_default_selling' => $unit->is_default_selling,
                'image_path' => $unit->product->primaryImage?->image_path,
                'original_price' => (float) $unit->product->original_price,
                'buying_cost' => (float) $buyingCost,
                'prices' => $unit->prices->map(fn ($price) => ['price_type' => $price->price_type, 'price' => (string) $price->price, 'is_manual' => $price->is_manual, 'calculation_status' => $price->calculation_status])->values(),
                'on_hand_qty' => (float) ($balance?->on_hand_qty ?? 0),
                'available_base_qty' => $baseAvailable,
                'available_qty' => $unit->fromBaseQuantity($baseAvailable),
            ];
        };

        return $request->boolean('paginated')
            ? $query->paginate((int) ($validated['per_page'] ?? 10))->withQueryString()->through($map)
            : $query->limit(20)->get()->map($map);
    }

    public function exportBalances(Request $request)
    {
        abort_unless($request->user()->hasAdminPermission('inventory.view'), 403);
        $locationIds = $request->user()->accessibleLocationIds();
        $rows = $this->stockOverviewQuery($this->filteredLocationIds($request, $locationIds), $this->isAllWarehousesFilter($request))->orderBy('products.name')->cursor();

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['warehouse_code', 'warehouse_name', 'product_code', 'barcode', 'product', 'base_unit', 'default_selling_unit', 'on_hand_base', 'reserved_base', 'available_base', 'min_quantity']);
            foreach ($rows as $row) {
                fputcsv($out, [$row->location_code, $row->location_name, $row->product_code, $row->barcode, $row->product_name, $row->base_unit_code, $row->selling_unit_code, $row->on_hand_qty, $row->reserved_qty, $row->available_qty, $row->min_quantity]);
            }
            fclose($out);
        }, 'inventory-balances-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv']);
    }

    public function exportMovements(Request $request, Product $product)
    {
        abort_unless($request->user()->hasAdminPermission('inventory.history'), 403);
        $rows = InventoryMovement::query()->where('product_id', $product->id)->whereIn('location_id', $request->user()->accessibleLocationIds())->with(['location:id,code', 'creator:id,name', 'unit:id,code'])->latest('occurred_at')->cursor();

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['occurred_at', 'location', 'type', 'unit', 'unit_quantity', 'base_quantity_delta', 'before', 'after', 'reserved_delta', 'user', 'reason', 'notes']);
            foreach ($rows as $movement) {
                fputcsv($out, [$movement->occurred_at, $movement->location->code, $movement->type, $movement->unit?->code, $movement->unit_quantity, $movement->quantity_delta, $movement->on_hand_before, $movement->on_hand_after, $movement->reserved_delta, $movement->creator?->name, $movement->reason_code, $movement->notes]);
            }
            fclose($out);
        }, "movements-{$product->product_code}-".now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv']);
    }

    private function stockOverviewQuery(array $locationIds, bool $aggregate)
    {
        $query = DB::table('products')
            ->leftJoin('product_units as base_units', fn ($join) => $join->on('base_units.product_id', '=', 'products.id')->where('base_units.is_base', true))
            ->leftJoin('product_units as selling_units', fn ($join) => $join->on('selling_units.product_id', '=', 'products.id')->where('selling_units.is_default_selling', true))
            ->leftJoin('product_images as primary_images', fn ($join) => $join->on('primary_images.product_id', '=', 'products.id')->where('primary_images.is_primary', true));

        $identity = ['products.id as product_id', 'products.product_code', 'products.barcode', 'products.name as product_name', 'products.min_quantity', 'primary_images.image_path as product_image_path', 'base_units.id as base_unit_id', 'base_units.name as base_unit_name', 'base_units.code as base_unit_code', 'selling_units.id as selling_unit_id', 'selling_units.name as selling_unit_name', 'selling_units.code as selling_unit_code', 'selling_units.conversion_factor as selling_conversion_factor'];
        if ($aggregate) {
            return $query
                ->leftJoin('inventory_balances as balances', fn ($join) => $join->on('balances.product_id', '=', 'products.id')->whereIn('balances.location_id', $locationIds))
                ->select($identity)
                ->selectRaw('NULL as balance_id, 0 as location_id, "ALL" as location_code, "All warehouses" as location_name, "warehouse" as location_type')
                ->selectRaw('SUM(COALESCE(balances.on_hand_qty, 0)) as on_hand_qty, SUM(COALESCE(balances.reserved_qty, 0)) as reserved_qty, MAX(COALESCE(balances.version, 0)) as version')
                ->selectRaw('(SUM(COALESCE(balances.on_hand_qty, 0)) - SUM(COALESCE(balances.reserved_qty, 0))) as available_qty')
                ->groupBy(['products.id', 'products.product_code', 'products.barcode', 'products.name', 'products.min_quantity', 'primary_images.image_path', 'base_units.id', 'base_units.name', 'base_units.code', 'selling_units.id', 'selling_units.name', 'selling_units.code', 'selling_units.conversion_factor']);
        }

        return $query->crossJoin('locations')
            ->leftJoin('inventory_balances as balances', fn ($join) => $join->on('balances.product_id', '=', 'products.id')->on('balances.location_id', '=', 'locations.id'))
            ->whereIn('locations.id', $locationIds)
            ->select(array_merge($identity, ['balances.id as balance_id', 'locations.id as location_id', 'locations.code as location_code', 'locations.name as location_name', 'locations.type as location_type']))
            ->selectRaw('COALESCE(balances.on_hand_qty, 0) as on_hand_qty, COALESCE(balances.reserved_qty, 0) as reserved_qty, COALESCE(balances.version, 0) as version')
            ->selectRaw('(COALESCE(balances.on_hand_qty, 0) - COALESCE(balances.reserved_qty, 0)) as available_qty');
    }

    private function stockOverviewRow(object $row, float $inTransit, array $units = []): array
    {
        $available = (float) $row->available_qty;
        $factor = max((float) ($row->selling_conversion_factor ?? 1), 0.000001);
        $useSelling = $available + 0.00005 >= $factor;

        return [
            'id' => $row->balance_id ? (int) $row->balance_id : "product-{$row->product_id}-warehouse-{$row->location_id}",
            'balance_id' => $row->balance_id ? (int) $row->balance_id : null,
            'location_id' => (int) $row->location_id,
            'product_id' => (int) $row->product_id,
            'on_hand_qty' => (float) $row->on_hand_qty,
            'reserved_qty' => (float) $row->reserved_qty,
            'available_qty' => $available,
            'min_quantity' => (float) $row->min_quantity,
            'version' => (int) $row->version,
            'in_transit_qty' => $inTransit,
            'stock_display' => ['quantity' => $useSelling ? floor(($available / $factor + 0.0000001) * 10000) / 10000 : $available, 'unit' => $useSelling ? $row->selling_unit_code : $row->base_unit_code],
            'location' => ['id' => (int) $row->location_id, 'code' => $row->location_code, 'name' => $row->location_name, 'type' => $row->location_type],
            'product' => ['id' => (int) $row->product_id, 'product_code' => $row->product_code, 'barcode' => $row->barcode, 'name' => $row->product_name, 'image_path' => $row->product_image_path, 'units' => $units, 'base_unit' => ['id' => $row->base_unit_id, 'name' => $row->base_unit_name, 'code' => $row->base_unit_code], 'default_selling_unit' => ['id' => $row->selling_unit_id, 'name' => $row->selling_unit_name, 'code' => $row->selling_unit_code, 'conversion_factor' => $factor]],
        ];
    }

    private function inTransitQuantities(array $locationIds, array $productIds, bool $aggregate): array
    {
        if (! $locationIds || ! $productIds) {
            return [];
        }
        $rows = collect();
        foreach ([['source_location_id', 1], ['destination_location_id', 1]] as [$locationColumn]) {
            $rows = $rows->concat(DB::table('stock_transfer_items')->join('stock_transfers', 'stock_transfers.id', '=', 'stock_transfer_items.stock_transfer_id')
                ->where('stock_transfers.status', 'in_transit')->whereIn("stock_transfers.{$locationColumn}", $locationIds)->whereIn('stock_transfer_items.product_id', $productIds)->whereNotNull('stock_transfer_items.shipped_quantity')
                ->selectRaw("stock_transfers.{$locationColumn} as location_id, stock_transfer_items.product_id, SUM((stock_transfer_items.shipped_quantity - COALESCE(stock_transfer_items.received_quantity, 0)) * stock_transfer_items.conversion_factor) as in_transit_qty")
                ->groupBy("stock_transfers.{$locationColumn}", 'stock_transfer_items.product_id')->get());
        }
        $map = [];
        foreach ($rows as $row) {
            $key = "{$row->location_id}:{$row->product_id}";
            $map[$key] = ($map[$key] ?? 0) + (float) $row->in_transit_qty;
        }
        if ($aggregate) {
            $result = [];
            foreach ($map as $key => $quantity) {
                [, $productId] = explode(':', $key, 2);
                $result["all:{$productId}"] = ($result["all:{$productId}"] ?? 0) + $quantity;
            }

            return $result;
        }

        return $map;
    }

    private function isAllWarehousesFilter(Request $request): bool
    {
        return ! $request->filled('location') || $request->location === 'all';
    }

    private function filteredLocationIds(Request $request, array $locationIds): array
    {
        if ($this->isAllWarehousesFilter($request)) {
            return $locationIds;
        }
        $locationId = (int) $request->location;

        return in_array($locationId, $locationIds, true) ? [$locationId] : [];
    }

    private function movementDocument(InventoryMovement $movement): ?array
    {
        if (! $movement->reference_type || ! $movement->reference_id) {
            return null;
        }

        return match ($movement->reference_type) {
            StockReceipt::class => ($model = StockReceipt::query()->find($movement->reference_id)) ? ['label' => $model->receipt_number, 'href' => route('admin.inventory.receipts.index')] : null,
            StockAdjustment::class => ($model = StockAdjustment::query()->find($movement->reference_id)) ? ['label' => $model->adjustment_number, 'href' => route('admin.inventory.adjustments.index')] : null,
            StockTransfer::class => ($model = StockTransfer::query()->find($movement->reference_id)) ? ['label' => $model->transfer_number, 'href' => route('admin.inventory.transfers.show', $model)] : null,
            default => null,
        };
    }
}
