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

class StockAdjustmentController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', StockAdjustment::class);
        return Spa::render('Admin/Inventory/Adjustments/Index', [
            'adjustments' => StockAdjustment::query()
                ->whereIn('location_id', $request->user()->accessibleLocationIds())
                ->with(['location:id,code,name', 'items.product:id,name,product_code', 'items.product.units:id,product_id,name,code,conversion_factor,is_base,is_default_selling,is_active', 'items.unit:id,name,code,conversion_factor'])
                ->latest()->paginate(20)->withQueryString(),
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
