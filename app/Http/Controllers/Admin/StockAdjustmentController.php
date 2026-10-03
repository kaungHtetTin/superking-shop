<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\ProductUnit;
use App\Models\StockAdjustment;
use App\Services\AuditLogService;
use App\Services\Inventory\StockAdjustmentService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Support\Spa;
use Illuminate\Support\Carbon;

class StockAdjustmentController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', StockAdjustment::class);
        $locationIds = $request->user()->accessibleLocationIds();
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'location_id' => ['nullable', 'integer'],
            'reason_code' => ['nullable', Rule::in(array_keys(StockAdjustment::REASONS))],
            'status' => ['nullable', Rule::in(StockAdjustment::STATUSES)],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $query = StockAdjustment::query()
            ->whereIn('location_id', $locationIds)
            ->with(['location:id,code,name', 'items.product:id,name,product_code', 'items.product.units:id,product_id,name,code,conversion_factor,is_base,is_default_selling,is_active', 'items.unit:id,name,code,conversion_factor']);

        $term = trim($validated['q'] ?? '');
        $query
            ->when($term !== '', fn ($scope) => $scope->where(fn ($search) => $search
                ->where('adjustment_number', 'like', "%{$term}%")
                ->orWhereHas('items.product', fn ($products) => $products
                    ->where('name', 'like', "%{$term}%")
                    ->orWhere('product_code', 'like', "%{$term}%"))))
            ->when(! empty($validated['location_id']), fn ($scope) => $scope->where('location_id', (int) $validated['location_id']))
            ->when(! empty($validated['reason_code']), fn ($scope) => $scope->where('reason_code', $validated['reason_code']))
            ->when(! empty($validated['status']), fn ($scope) => $scope->where('status', $validated['status']))
            ->when(! empty($validated['from']), fn ($scope) => $scope->where('created_at', '>=', Carbon::parse($validated['from'])->startOfDay()))
            ->when(! empty($validated['to']), fn ($scope) => $scope->where('created_at', '<=', Carbon::parse($validated['to'])->endOfDay()));

        return Spa::render('Admin/Inventory/Adjustments/Index', [
            'adjustments' => $query->latest()->paginate(20)->withQueryString(),
            'locations' => Location::query()->whereIn('id', $locationIds)->orderBy('name')->get(['id', 'code', 'name']),
            'reasons' => collect(StockAdjustment::REASONS)->map(fn ($label, $value) => compact('value', 'label'))->values(),
            'statuses' => StockAdjustment::STATUSES,
            'filters' => $request->only(['q', 'location_id', 'reason_code', 'status', 'from', 'to']),
        ]);
    }

    public function create(Request $request)
    {
        $this->authorize('create', StockAdjustment::class);
        $validated = $request->validate([
            'product_unit_id' => ['required', 'integer', 'exists:product_units,id'],
            'location_id' => ['nullable', 'integer', 'exists:locations,id'],
        ]);
        $locations = Location::query()
            ->whereIn('id', $request->user()->accessibleLocationIds())
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'type']);

        if ($locations->isEmpty()) {
            abort(403);
        }

        $selectedLocationId = $validated['location_id'] ?? $locations->first()->id;
        abort_unless($locations->contains('id', (int) $selectedLocationId), 403);

        $unit = ProductUnit::query()
            ->with([
                'product:id,name,product_code,barcode',
                'product.units' => fn ($query) => $query
                    ->where('is_active', true)
                    ->orderByDesc('conversion_factor')
                    ->select(['id', 'product_id', 'name', 'code', 'conversion_factor', 'is_base', 'is_default_selling', 'is_active']),
                'product.primaryImage:id,product_id,image_path',
            ])
            ->findOrFail($validated['product_unit_id']);
        $balances = InventoryBalance::query()
            ->where('product_id', $unit->product_id)
            ->whereIn('location_id', $locations->pluck('id'))
            ->get(['location_id', 'on_hand_qty'])
            ->keyBy('location_id');

        return Spa::render('Admin/Inventory/Adjustments/Create', [
            'locations' => $locations,
            'reasons' => collect(StockAdjustment::REASONS)->map(fn ($label, $value) => compact('value', 'label'))->values(),
            'selectedUnit' => [
                'id' => $unit->id,
                'product_id' => $unit->product_id,
                'product_code' => $unit->product->product_code,
                'barcode' => $unit->product->barcode,
                'product_name' => $unit->product->name,
                'unit_name' => $unit->name,
                'unit_code' => $unit->code,
                'conversion_factor' => (float) $unit->conversion_factor,
                'image_path' => $unit->product->primaryImage?->image_path,
                'unit_options' => $unit->product->units->values(),
                'balances' => $locations->mapWithKeys(fn (Location $location) => [
                    $location->id => (float) ($balances->get($location->id)?->on_hand_qty ?? 0),
                ]),
            ],
            'selectedLocationId' => (int) $selectedLocationId,
        ]);
    }

    public function store(Request $request, StockAdjustmentService $service, AuditLogService $audit)
    {
        $this->authorize('create', StockAdjustment::class);
        $validated = $request->validate([
            'location_id' => ['required', 'integer', 'exists:locations,id'],
            'reason_code' => ['required', Rule::in(array_keys(StockAdjustment::REASONS))],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_unit_id' => ['required', 'integer', 'exists:product_units,id'],
            'items.*.counted_quantity' => ['required', 'numeric', 'min:0'],
            'items.*.notes' => ['nullable', 'string', 'max:1000'],
        ]);
        $location = Location::findOrFail($validated['location_id']);
        abort_unless($request->user()->canAccessLocation($location), 403);

        $adjustment = $service->createPosted($location, $validated['items'], $validated['reason_code'], $request->user(), $validated['notes'] ?? null);
        $audit->record('inventory.adjustment.created', $adjustment, ['location_id' => $location->id], $request);
        return redirect()->route('admin.inventory.adjustments.index')->with('success', 'Stock quantity updated.');
    }
}
