<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\FlashSale;
use App\Models\FlashSaleItem;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Services\AuditLogService;
use App\Services\Inventory\StorefrontInventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use App\Support\Spa;

class FlashSaleController extends Controller
{
    public function __construct(private StorefrontInventoryService $storefrontInventory)
    {
    }

    public function index(Request $request)
    {
        $query = FlashSale::query()
            ->with(['items.unit.product'])
            ->withCount('items')
            ->latest();

        if ($request->filled('q')) {
            $query->where('name', 'like', '%'.trim($request->q).'%');
        }

        if ($request->filled('status')) {
            match ($request->status) {
                'live' => $query->activeNow(),
                'scheduled' => $query->where('is_active', true)->where('starts_at', '>', now()),
                'ended' => $query->where('is_active', true)->where('ends_at', '<', now()),
                'inactive' => $query->where('is_active', false),
                default => null,
            };
        }

        return Spa::render('Admin/FlashSales/Index', [
            'flashSales' => $query->paginate(12)->withQueryString(),
            'filters' => [
                'q' => $request->string('q')->toString(),
                'status' => $request->string('status')->toString(),
            ],
        ]);
    }

    public function create()
    {
        return Spa::render('Admin/FlashSales/Create', [
            'productOptions' => $this->productOptions(),
        ]);
    }

    public function show(FlashSale $flashSale)
    {
        $flashSale->load(['items.unit.prices', 'items.unit.product:id,name']);

        return Spa::render('Admin/FlashSales/Show', [
            'flashSale' => [
                'id' => $flashSale->id,
                'name' => $flashSale->name,
                'status' => $flashSale->status,
                'is_active' => $flashSale->is_active,
                'starts_at' => $flashSale->starts_at,
                'ends_at' => $flashSale->ends_at,
                'created_at' => $flashSale->created_at,
                'updated_at' => $flashSale->updated_at,
                'items' => $flashSale->items->map(fn (FlashSaleItem $item) => [
                    'id' => $item->id,
                    'discount_type' => $item->discount_type,
                    'discount_value' => (float) $item->discount_value,
                    'quantity_limit' => $item->quantity_limit,
                    'sold_count' => $item->sold_count,
                    'remaining_quantity' => $item->remainingQuantity(),
                    'original_price' => (float) ($item->unit->priceFor('retail')?->price ?? 0),
                    'sale_price' => $item->salePrice((float) ($item->unit->priceFor('retail')?->price ?? 0)),
                    'unit' => [
                        'id' => $item->unit->id,
                        'code' => $item->unit->code,
                        'name' => $item->unit->name,
                        'product' => [
                            'id' => $item->unit->product->id,
                            'name' => $item->unit->product->name,
                        ],
                    ],
                ])->values(),
            ],
        ]);
    }

    public function edit(FlashSale $flashSale)
    {
        $flashSale->load(['items.unit.prices', 'items.unit.product']);

        return Spa::render('Admin/FlashSales/Edit', [
            'flashSale' => $flashSale,
            'productOptions' => $this->productOptions(),
        ]);
    }

    public function store(Request $request, AuditLogService $auditLogService)
    {
        $validated = $this->validated($request);
        $this->ensureNoCatalogOverlap($validated);

        $flashSale = DB::transaction(function () use ($validated) {
            $flashSale = FlashSale::create($this->salePayload($validated));
            $this->syncItems($flashSale, $validated['items']);

            return $flashSale;
        });

        $auditLogService->record('flash_sale.created', $flashSale, ['name' => $flashSale->name], $request);

        return redirect()
            ->route('admin.flash-sales.index')
            ->with('success', 'Flash sale created.');
    }

    public function update(Request $request, FlashSale $flashSale, AuditLogService $auditLogService)
    {
        $validated = $this->validated($request);
        $this->ensureSoldItemIntegrity($flashSale, $validated['items']);
        $this->ensureNoCatalogOverlap($validated, $flashSale);

        DB::transaction(function () use ($flashSale, $validated) {
            $flashSale->update($this->salePayload($validated));
            $this->syncItems($flashSale, $validated['items']);
        });

        $auditLogService->record('flash_sale.updated', $flashSale, ['name' => $flashSale->name], $request);

        return redirect()
            ->route('admin.flash-sales.index')
            ->with('success', 'Flash sale updated.');
    }

    public function destroy(Request $request, FlashSale $flashSale, AuditLogService $auditLogService)
    {
        $query = $request->only(['q', 'status']);

        if ($flashSale->items()->where('sold_count', '>', 0)->exists()) {
            $flashSale->update(['is_active' => false]);
            $auditLogService->record('flash_sale.deactivated', $flashSale, ['name' => $flashSale->name], $request);

            return redirect()
                ->route('admin.flash-sales.index', $query, 303)
                ->with('success', 'Flash sale has sales history, so it was deactivated.');
        }

        $auditLogService->record('flash_sale.deleted', $flashSale, ['name' => $flashSale->name], $request);
        $flashSale->delete();

        return redirect()
            ->route('admin.flash-sales.index', $query, 303)
            ->with('success', 'Flash sale deleted.');
    }

    private function validated(Request $request): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'is_active' => ['required', 'boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_unit_id' => ['required', 'integer', 'exists:product_units,id'],
            'items.*.discount_type' => ['required', Rule::in([FlashSaleItem::TYPE_PERCENTAGE, FlashSaleItem::TYPE_FIXED_PRICE])],
            'items.*.discount_value' => ['required', 'numeric', 'min:0.01'],
            'items.*.quantity_limit' => ['nullable', 'numeric', 'gt:0'],
        ]);

        $unitIds = collect($validated['items'])->pluck('product_unit_id')->map(fn ($id) => (int) $id);

        if ($unitIds->duplicates()->isNotEmpty()) {
            throw ValidationException::withMessages([
                'items' => 'Each product unit can only appear once in a flash sale.',
            ]);
        }

        $units = ProductUnit::query()->with('prices')->whereIn('id', $unitIds->all())->get()->keyBy('id');

        foreach ($validated['items'] as $index => $item) {
            $unit = $units->get((int) $item['product_unit_id']);
            $value = (float) $item['discount_value'];

            if ($item['discount_type'] === FlashSaleItem::TYPE_PERCENTAGE && $value >= 100) {
                throw ValidationException::withMessages([
                    "items.{$index}.discount_value" => 'Percentage discount must be less than 100.',
                ]);
            }

            if ($item['discount_type'] === FlashSaleItem::TYPE_FIXED_PRICE && $unit && $value >= (float) ($unit->priceFor('retail')?->price ?? 0)) {
                throw ValidationException::withMessages([
                    "items.{$index}.discount_value" => 'Fixed sale price must be lower than the retail unit price.',
                ]);
            }
        }

        return $validated;
    }

    private function salePayload(array $validated): array
    {
        return [
            'name' => trim($validated['name']),
            'starts_at' => Carbon::parse($validated['starts_at'])->utc(),
            'ends_at' => Carbon::parse($validated['ends_at'])->utc(),
            'is_active' => (bool) $validated['is_active'],
        ];
    }

    private function ensureNoCatalogOverlap(array $validated, ?FlashSale $ignore = null): void
    {
        if (! (bool) $validated['is_active']) {
            return;
        }

        $items = collect($validated['items'])->values();
        $unitIds = $items
            ->pluck('product_unit_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($unitIds->isEmpty()) {
            return;
        }

        $units = ProductUnit::query()
            ->with('product:id,name')
            ->whereIn('id', $unitIds->all())
            ->get()
            ->keyBy('id');

        $productIds = $units
            ->pluck('product_id')
            ->filter()
            ->unique()
            ->values();

        if ($productIds->isEmpty()) {
            return;
        }

        $starts = Carbon::parse($validated['starts_at']);
        $ends = Carbon::parse($validated['ends_at']);

        $conflicts = FlashSaleItem::query()
            ->select('flash_sale_items.*')
            ->join('flash_sales', 'flash_sales.id', '=', 'flash_sale_items.flash_sale_id')
            ->join('product_units', 'product_units.id', '=', 'flash_sale_items.product_unit_id')
            ->where('flash_sales.is_active', true)
            ->when($ignore, fn ($query) => $query->where('flash_sales.id', '!=', $ignore->id))
            ->where('flash_sales.starts_at', '<', $ends)
            ->where('flash_sales.ends_at', '>', $starts)
            ->where(function ($query) use ($unitIds, $productIds) {
                $query
                    ->whereIn('flash_sale_items.product_unit_id', $unitIds->all())
                    ->orWhereIn('product_units.product_id', $productIds->all());
            })
            ->with(['flashSale', 'unit.product'])
            ->get();

        if ($conflicts->isEmpty()) {
            return;
        }

        $messages = [
            'items' => 'Remove highlighted product units that overlap with another active flash sale.',
        ];

        foreach ($items as $index => $item) {
            $incomingUnit = $units->get((int) $item['product_unit_id']);
            if (! $incomingUnit) {
                continue;
            }

            $conflict = $conflicts->firstWhere('product_unit_id', $incomingUnit->id)
                ?: $conflicts->first(fn (FlashSaleItem $conflict) => (int) $conflict->unit?->product_id === (int) $incomingUnit->product_id);

            if (! $conflict) {
                continue;
            }

            $saleName = $conflict->flashSale?->name ?: 'another flash sale';
            $unitCode = $incomingUnit->code ?: 'this unit';
            $productName = $incomingUnit->product?->name ?: 'this product';
            $messages["items.{$index}.product_unit_id"] = (int) $conflict->product_unit_id === (int) $incomingUnit->id
                ? "Unit {$unitCode} is already in overlapping flash sale \"{$saleName}\"."
                : "Product {$productName} is already in overlapping flash sale \"{$saleName}\".";
        }

        if (count($messages) > 1) {
            throw ValidationException::withMessages($messages);
        }
    }

    private function ensureSoldItemIntegrity(FlashSale $flashSale, array $items): void
    {
        $soldItems = $flashSale->items()
            ->where('sold_count', '>', 0)
            ->get()
            ->keyBy('product_unit_id');

        if ($soldItems->isEmpty()) {
            return;
        }

        $incoming = collect($items)
            ->values()
            ->mapWithKeys(fn (array $item, int $index) => [(int) $item['product_unit_id'] => compact('item', 'index')]);
        $messages = [];

        foreach ($soldItems as $unitId => $existing) {
            $candidate = $incoming->get((int) $unitId);

            if (! $candidate) {
                $messages['items'] = 'Product units with recorded sales cannot be removed. Deactivate the campaign to stop it.';
                continue;
            }

            $item = $candidate['item'];
            $index = $candidate['index'];

            if (
                $item['discount_type'] !== $existing->discount_type
                || abs((float) $item['discount_value'] - (float) $existing->discount_value) > 0.0001
            ) {
                $messages["items.{$index}.discount_value"] = 'Discounts with recorded sales cannot be changed.';
            }

            if ($item['quantity_limit'] !== null && (int) $item['quantity_limit'] < $existing->sold_count) {
                $messages["items.{$index}.quantity_limit"] = "Quantity limit cannot be lower than {$existing->sold_count} units already sold.";
            }
        }

        if ($messages) {
            throw ValidationException::withMessages($messages);
        }
    }

    private function syncItems(FlashSale $flashSale, array $items): void
    {
        $incomingIds = collect($items)->pluck('product_unit_id')->map(fn ($id) => (int) $id)->all();
        $existing = $flashSale->items()->get()->keyBy('product_unit_id');

        $flashSale->items()
            ->whereNotIn('product_unit_id', $incomingIds)
            ->where('sold_count', 0)
            ->delete();

        foreach ($items as $item) {
            $payload = [
                'discount_type' => $item['discount_type'],
                'discount_value' => $item['discount_value'],
                'quantity_limit' => $item['quantity_limit'] ?? null,
            ];

            $existingItem = $existing->get((int) $item['product_unit_id']);

            if ($existingItem) {
                $existingItem->update($payload);
            } else {
                $flashSale->items()->create(array_merge($payload, [
                    'product_unit_id' => (int) $item['product_unit_id'],
                    'sold_count' => 0,
                ]));
            }
        }
    }

    private function productOptions(): array
    {
        $products = Product::query()
            ->where('status', 'active')
            ->with(['category:id,name', 'units' => fn ($query) => $query->where('is_active', true)->with('prices')->orderBy('sort_order')])
            ->orderBy('name')
            ->get(['id', 'category_id', 'name']);

        $this->storefrontInventory->attachAvailableQuantities($products);

        return $products
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'category' => $product->category?->name,
                'units' => $product->units->map(fn (ProductUnit $unit) => [
                    'id' => $unit->id,
                    'code' => $unit->code,
                    'name' => $unit->name,
                    'price' => (float) ($unit->priceFor('retail')?->price ?? 0),
                    'available_qty' => $unit->available_qty,
                ])->values(),
            ])
            ->values()
            ->all();
    }
}
