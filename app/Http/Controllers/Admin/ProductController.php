<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductUnit;
use App\Services\Inventory\InventoryService;
use App\Support\Spa;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'draft'])],
        ]);

        $products = Product::query()
            ->with(['category', 'primaryImage', 'baseUnit', 'defaultSellingUnit.prices'])
            ->withExists(['inventoryMovements as has_inventory_history', 'orderItems as has_sales_history'])
            ->withSum('inventoryBalances as total_on_hand', 'on_hand_qty')
            ->when($filters['q'] ?? null, function ($query, $search) {
                $query->where(fn ($scope) => $scope
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('product_code', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%"));
            })
            ->when($filters['category_id'] ?? null, fn ($query, $categoryId) => $query->where('category_id', $categoryId))
            ->when($filters['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->latest()
            ->paginate(15)
            ->through(function (Product $product) {
                $product->setAttribute('stock_display', $product->displayQuantity((float) ($product->total_on_hand ?? 0)));

                return $product;
            })
            ->withQueryString();

        return Spa::render('Admin/Products/Index', [
            'products' => $products,
            'categories' => Category::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'filters' => $filters,
        ]);
    }

    public function create()
    {
        return Spa::render('Admin/Products/Create', [
            'categories' => Category::where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function generateBarcode(Request $request)
    {
        $request->validate(['reserved' => ['nullable', 'array'], 'reserved.*' => ['nullable', 'string', 'max:128']]);

        return response()->json(['barcode' => $this->generateUniqueBarcode($request->input('reserved', []))]);
    }

    public function barcodes(Request $request)
    {
        $this->ensureProductBarcodes();
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'per_page' => ['nullable', 'integer', Rule::in([10, 25, 50, 100])],
        ]);
        $perPage = $filters['per_page'] ?? 25;

        $products = Product::query()
            ->with(['category', 'defaultSellingUnit.retailPrice'])
            ->when($filters['q'] ?? null, function ($query, $search) {
                $query->where(fn ($scope) => $scope
                    ->where('product_code', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%"));
            })
            ->when($filters['category_id'] ?? null, fn ($query, $categoryId) => $query->where('category_id', $categoryId))
            ->orderBy('name')
            ->paginate($perPage)
            ->withQueryString();

        return Spa::render('Admin/Products/Barcodes', [
            'products' => $products,
            'categories' => Category::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'filters' => [
                'q' => $filters['q'] ?? '',
                'category_id' => $filters['category_id'] ?? '',
                'per_page' => $perPage,
            ],
        ]);
    }

    public function store(Request $request, InventoryService $inventoryService)
    {
        $validated = $this->validateProduct($request);
        $validated['barcode'] = trim((string) ($validated['barcode'] ?? '')) ?: $this->generateUniqueBarcode();

        return DB::transaction(function () use ($request, $validated, $inventoryService) {
            $product = Product::create($this->productPayload($validated));
            $this->storeImages($request, $product);
            $this->syncUnits($product, $validated['units'], $validated['price_types']);

            if ($location = Location::query()->where('is_default_fulfillment', true)->where('is_active', true)->first()) {
                $inventoryService->ensureBalance($location, $product);
            }

            return redirect()->route('admin.products.index')->with('success', 'Product created successfully.');
        });
    }

    public function edit(Request $request, Product $product)
    {
        return Spa::render('Admin/Products/Edit', [
            'product' => $product->load(['images', 'units', 'priceTypes.unitPrices']),
            'categories' => Category::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'returnPage' => max(1, $request->integer('return_page', 1)),
        ]);
    }

    public function update(Request $request, Product $product, InventoryService $inventoryService)
    {
        $returnPage = max(1, $request->integer('return_page', 1));
        $validated = $this->validateProduct($request, $product);
        $validated['barcode'] = trim((string) ($validated['barcode'] ?? '')) ?: $this->generateUniqueBarcode();

        return DB::transaction(function () use ($request, $validated, $product, $inventoryService, $returnPage) {
            $product->update($this->productPayload($validated, $product));
            $this->syncImages($request, $product, $validated);
            $this->syncUnits($product, $validated['units'], $validated['price_types']);

            if ($location = Location::query()->where('is_default_fulfillment', true)->where('is_active', true)->first()) {
                $inventoryService->ensureBalance($location, $product);
            }

            return redirect()
                ->route('admin.products.index', $returnPage > 1 ? ['page' => $returnPage] : [])
                ->with('success', 'Product updated successfully.');
        });
    }

    public function destroy(Request $request, Product $product)
    {
        if ($product->inventoryMovements()->exists() || $product->orderItems()->exists()) {
            if ($request->headers->has('X-SPA')) {
                return response()->json([
                    'errors' => ['product' => 'A product with inventory or sales history cannot be deleted. Deactivate it instead.'],
                ], 422);
            }

            return back()->with('error', 'A product with inventory or sales history cannot be deleted. Deactivate it instead.');
        }

        foreach ($product->images as $image) {
            Storage::disk('public')->delete($image->image_path);
        }
        $product->delete();

        if ($request->headers->has('X-SPA')) {
            return response()->json(['deleted' => true]);
        }

        return back()->with('success', 'Product deleted successfully.');
    }

    public function toggleStatus(Product $product)
    {
        $activate = $product->status !== 'active';
        $product->update([
            'status' => $activate ? 'active' : 'inactive',
            'is_active' => $activate,
        ]);

        return back()->with('success', $activate
            ? 'Product activated successfully.'
            : 'Product deactivated successfully. Sales and inventory history were preserved.');
    }

    private function validateProduct(Request $request, ?Product $product = null): array
    {
        $validated = $request->validate([
            'category_id' => ['required', 'exists:categories,id'],
            'barcode' => ['nullable', 'string', 'max:128', Rule::unique('products', 'barcode')->ignore($product?->id)],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'min_quantity' => ['required', 'numeric', 'min:0'],
            'original_price' => ['required', 'numeric', 'min:0'],
            'status' => ['required', Rule::in(['active', 'inactive', 'draft'])],
            'is_featured' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'metadata' => ['nullable', 'array'],
            'mainImageAttachmentId' => ['nullable', 'integer'],
            'imageAttachmentIds' => ['nullable', 'array'],
            'imageAttachmentIds.*' => ['integer'],
            'images' => ['nullable', 'array'],
            'images.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'units' => ['required', 'array', 'min:1'],
            'units.*.id' => ['nullable', 'integer'],
            'units.*.name' => ['required', 'string', 'max:80'],
            'units.*.code' => ['required', 'string', 'max:30'],
            'units.*.conversion_factor' => ['required', 'numeric', 'gt:0'],
            'units.*.is_base' => ['required', 'boolean'],
            'units.*.is_default_selling' => ['required', 'boolean'],
            'units.*.is_active' => ['sometimes', 'boolean'],
            'price_types' => ['required', 'array', 'min:1'],
            'price_types.*.id' => ['nullable', 'integer'],
            'price_types.*.name' => ['required', 'string', 'max:60'],
            'price_types.*.prices' => ['required', 'array'],
            'price_types.*.prices.*' => ['required', 'numeric', 'min:0'],
        ]);

        $baseUnits = collect($validated['units'])->where('is_base', true);
        $sellingUnits = collect($validated['units'])->where('is_default_selling', true);
        if ($baseUnits->count() !== 1 || $sellingUnits->count() !== 1) {
            throw ValidationException::withMessages(['units' => 'Choose exactly one base unit and one default selling unit.']);
        }
        if (abs((float) $baseUnits->first()['conversion_factor'] - 1.0) > 0.000001) {
            throw ValidationException::withMessages(['units' => 'The base unit conversion factor must be 1.']);
        }

        $seenNames = [];
        $seenCodes = [];
        foreach ($validated['units'] as $index => &$unit) {
            $nameKey = Str::lower(trim($unit['name']));
            $codeKey = Str::lower(trim($unit['code']));
            if (isset($seenNames[$nameKey]) || isset($seenCodes[$codeKey])) {
                throw ValidationException::withMessages(['units' => 'Unit names and codes must be unique within a product.']);
            }
            $seenNames[$nameKey] = true;
            $seenCodes[$codeKey] = true;

        }
        unset($unit);

        $seenPriceTypes = [];
        foreach ($validated['price_types'] as $index => &$priceType) {
            $priceType['name'] = Str::lower(Str::slug(trim($priceType['name']), '_'));
            if ($priceType['name'] === '' || isset($seenPriceTypes[$priceType['name']])) {
                throw ValidationException::withMessages(["price_types.{$index}.name" => 'Price names must be present and unique for the product.']);
            }
            if (count($priceType['prices']) !== count($validated['units'])) {
                throw ValidationException::withMessages(["price_types.{$index}.prices" => 'Every price type requires an amount for every product unit.']);
            }
            $seenPriceTypes[$priceType['name']] = true;
        }
        unset($priceType);
        if (! isset($seenPriceTypes['retail'])) {
            throw ValidationException::withMessages(['price_types' => 'Every product requires a retail price type.']);
        }

        if ($product) {
            $submittedIds = collect($validated['units'])->pluck('id')->filter()->map(fn ($id) => (int) $id);
            $invalid = $submittedIds->diff($product->units()->pluck('id'));
            if ($invalid->isNotEmpty()) {
                throw ValidationException::withMessages(['units' => 'A submitted unit does not belong to this product.']);
            }
        }

        return $validated;
    }

    private function productPayload(array $validated, ?Product $product = null): array
    {
        $slugBase = Str::slug($validated['name']) ?: 'product';
        $slug = $slugBase;
        $suffix = 2;
        while (Product::query()->where('slug', $slug)->when($product, fn ($query) => $query->whereKeyNot($product->id))->exists()) {
            $slug = "{$slugBase}-{$suffix}";
            $suffix++;
        }

        return [
            'category_id' => $validated['category_id'],
            'barcode' => $validated['barcode'],
            'name' => $validated['name'],
            'slug' => $slug,
            'description' => $validated['description'] ?? null,
            'min_quantity' => $validated['min_quantity'],
            'original_price' => $validated['original_price'],
            'status' => $validated['status'],
            'is_featured' => $validated['is_featured'] ?? false,
            'is_active' => $validated['is_active'] ?? true,
            'metadata' => $validated['metadata'] ?? null,
        ];
    }

    private function syncUnits(Product $product, array $units, ?array $priceTypes = null): void
    {
        $submittedIds = collect($units)->pluck('id')->filter()->map(fn ($id) => (int) $id)->all();
        $removed = $product->units()->whereNotIn('id', $submittedIds)->get();
        foreach ($removed as $unit) {
            if ($unit->orderItems()->exists() || $unit->inventoryMovements()->exists()) {
                throw ValidationException::withMessages(['units' => "The {$unit->name} unit has history and cannot be removed. Deactivate it instead."]);
            }
            $unit->delete();
        }

        $savedUnits = [];
        foreach (array_values($units) as $index => $data) {
            $payload = [
                'name' => trim($data['name']),
                'code' => trim($data['code']),
                'conversion_factor' => $data['is_base'] ? 1 : $data['conversion_factor'],
                'is_base' => $data['is_base'],
                'is_default_selling' => $data['is_default_selling'],
                'is_active' => $data['is_active'] ?? true,
                'sort_order' => $index,
            ];
            $unit = isset($data['id'])
                ? tap($product->units()->whereKey($data['id'])->firstOrFail())->update($payload)
                : $product->units()->create($payload);
            $savedUnits[] = $unit;
        }

        $priceTypes ??= [];
        $product->priceTypes()->delete();
        foreach (array_values($priceTypes) as $typeIndex => $typeData) {
            $type = $product->priceTypes()->create([
                'name' => $typeData['name'],
                'is_default' => $typeData['name'] === 'retail',
                'sort_order' => $typeIndex,
            ]);
            foreach ($savedUnits as $unitIndex => $unit) {
                $unit->prices()->create([
                    'product_price_type_id' => $type->id,
                    'price' => $typeData['prices'][$unitIndex],
                ]);
            }
        }
    }

    private function storeImages(Request $request, Product $product): void
    {
        foreach ($request->file('images', []) as $index => $image) {
            ProductImage::create([
                'product_id' => $product->id,
                'image_path' => $image->store('products', 'public'),
                'is_primary' => $index === 0,
            ]);
        }
    }

    private function syncImages(Request $request, Product $product, array $validated): void
    {
        if (array_key_exists('imageAttachmentIds', $validated)) {
            $product->images()->whereNotIn('id', $validated['imageAttachmentIds'] ?? [])->get()->each(function ($image) {
                Storage::disk('public')->delete($image->image_path);
                $image->delete();
            });
        }
        $this->storeImages($request, $product);

        if (! empty($validated['mainImageAttachmentId'])) {
            $product->images()->update(['is_primary' => false]);
            $product->images()->whereKey($validated['mainImageAttachmentId'])->update(['is_primary' => true]);
        } elseif (! $product->images()->where('is_primary', true)->exists()) {
            $product->images()->oldest('id')->first()?->update(['is_primary' => true]);
        }
    }

    private function generateUniqueBarcode(array $reserved = []): string
    {
        $reserved = array_fill_keys(array_map(fn ($value) => trim((string) $value), $reserved), true);
        do {
            $barcode = '20'.str_pad((string) random_int(0, 9999999999), 10, '0', STR_PAD_LEFT);
        } while (isset($reserved[$barcode]) || Product::query()->where('barcode', $barcode)->exists());

        return $barcode;
    }

    private function ensureProductBarcodes(): void
    {
        Product::query()->where(fn ($query) => $query->whereNull('barcode')->orWhere('barcode', ''))->chunkById(100, function ($products) {
            foreach ($products as $product) {
                $product->update(['barcode' => $this->generateUniqueBarcode()]);
            }
        });
    }
}
