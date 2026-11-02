<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\{CycleCount, InventoryBalance, Location};
use App\Services\{AuditLogService, ExcelExportService};
use App\Services\Inventory\CycleCountService;
use App\Support\Spa;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CycleCountController extends Controller
{
    public function index(Request $request)
    {
        $filters = $request->validate(['location_id' => ['nullable', 'integer', 'exists:locations,id'],
            'status' => ['nullable', Rule::in(['draft', 'posted', 'cancelled'])], 'q' => ['nullable', 'string', 'max:120']]);
        if (! empty($filters['location_id'])) {
            $this->location($request, $filters['location_id']);
        }
        $counts = CycleCount::query()->whereIn('location_id', $request->user()->accessibleLocationIds())
            ->with(['location:id,name,code', 'creator:id,name'])->withCount('items')
            ->when($filters['location_id'] ?? null, fn ($q, $id) => $q->where('location_id', $id))
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['q'] ?? null, fn ($q, $term) => $q->where('count_number', 'like', '%'.$term.'%'))
            ->latest()->paginate(20)->withQueryString();
        return Spa::render('Admin/Inventory/CycleCounts/Index', ['counts' => $counts, 'filters' => $filters,
            'locations' => $this->locations($request), 'canCreate' => $request->user()->hasAdminPermission('inventory.adjust.create')]);
    }

    public function create(Request $request)
    {
        $request->validate(['location_id' => ['nullable', 'integer', 'exists:locations,id']]);
        if ($request->filled('location_id')) {
            $this->location($request, $request->integer('location_id'));
        }
        return Spa::render('Admin/Inventory/CycleCounts/Create', ['locations' => $this->locations($request)->where('is_active', true)->values(),
            'selectedLocationId' => $request->integer('location_id') ?: null]);
    }

    public function store(Request $request, CycleCountService $service, AuditLogService $audit)
    {
        $data = $request->validate(['location_id' => ['required', 'integer', 'exists:locations,id'],
            'product_ids' => ['required', 'array', 'min:1', 'max:200'], 'product_ids.*' => ['required', 'integer', 'distinct', 'exists:products,id'],
            'notes' => ['nullable', 'string', 'max:2000']]);
        $location = $this->location($request, $data['location_id']);
        abort_unless($location->is_active, 422, 'Choose an active warehouse.');
        $count = $service->create($location, $data['product_ids'], $request->user(), $data['notes'] ?? null);
        $audit->record('inventory.cycle_count.created', $count, [], $request);
        return redirect()->route('admin.inventory.cycle-counts.show', $count)->with('success', 'Cycle count started. Enter physical quantities in base units.');
    }

    public function show(Request $request, CycleCount $cycleCount)
    {
        $this->location($request, $cycleCount->location_id);
        $cycleCount->load(['location', 'creator:id,name', 'poster:id,name', 'adjustment:id,adjustment_number,status', 'items.product', 'items.unit']);
        $balances = InventoryBalance::where('location_id', $cycleCount->location_id)->whereIn('product_id', $cycleCount->items->pluck('product_id'))->get()->keyBy('product_id');
        $cycleCount->items->each(function ($item) use ($balances) {
            $balance = $balances->get($item->product_id);
            $item->setAttribute('stale', ! $balance || $balance->version !== $item->balance_version
                || bccomp((string) $balance->on_hand_qty, (string) $item->system_quantity, 4) !== 0
                || bccomp((string) $item->product->original_price, (string) $item->base_cost, 6) !== 0
                || ! $item->unit?->is_base || ! $item->unit?->is_active || (float) $item->unit?->conversion_factor !== 1.0);
            $item->unsetRelation('product');
            $item->unsetRelation('unit');
        });
        return Spa::render('Admin/Inventory/CycleCounts/Show', ['count' => $cycleCount,
            'canEdit' => $request->user()->hasAdminPermission('inventory.adjust.create'),
            'canPost' => $request->user()->hasAdminPermission('inventory.adjust.approve')]);
    }

    public function update(Request $request, CycleCount $cycleCount, CycleCountService $service, AuditLogService $audit)
    {
        $this->location($request, $cycleCount->location_id);
        $data = $this->countData($request);
        $service->save($cycleCount, $data);
        $audit->record('inventory.cycle_count.saved', $cycleCount, [], $request);
        return back()->with('success', 'Physical counts saved. Review differences before posting.');
    }

    public function refresh(Request $request, CycleCount $cycleCount, CycleCountService $service, AuditLogService $audit)
    {
        $this->location($request, $cycleCount->location_id);
        $data = $request->validate(['revision' => ['required', 'integer', 'min:1']]);
        $service->refresh($cycleCount, $data['revision']);
        $audit->record('inventory.cycle_count.refreshed', $cycleCount, [], $request);
        return back()->with('success', 'Snapshot refreshed. Physical quantities were cleared; recount all selected products.');
    }

    public function post(Request $request, CycleCount $cycleCount, CycleCountService $service, AuditLogService $audit)
    {
        $this->location($request, $cycleCount->location_id);
        $data = $request->validate(['revision' => ['required', 'integer', 'min:1']]);
        $service->post($cycleCount, $data['revision'], $request->user());
        $audit->record('inventory.cycle_count.posted', $cycleCount, [], $request);
        return back()->with('success', 'Cycle count posted. Warehouse stock and inventory value have been adjusted.');
    }

    public function saveAndPost(Request $request, CycleCount $cycleCount, CycleCountService $service, AuditLogService $audit)
    {
        abort_unless($request->user()->hasAdminPermission('inventory.adjust.create'), 403);
        $this->location($request, $cycleCount->location_id);
        $service->saveAndPost($cycleCount, $this->countData($request), $request->user());
        $audit->record('inventory.cycle_count.posted', $cycleCount, ['saved_and_posted' => true], $request);
        return back()->with('success', 'Physical counts saved and posted. Warehouse stock and inventory value have been adjusted.');
    }

    public function cancel(Request $request, CycleCount $cycleCount, CycleCountService $service, AuditLogService $audit)
    {
        $this->location($request, $cycleCount->location_id);
        $data = $request->validate(['revision' => ['required', 'integer', 'min:1']]);
        $service->cancel($cycleCount, $data['revision']);
        $audit->record('inventory.cycle_count.cancelled', $cycleCount, [], $request);
        return back()->with('success', 'Cycle count cancelled.');
    }

    public function export(Request $request, CycleCount $cycleCount, ExcelExportService $excel)
    {
        $this->location($request, $cycleCount->location_id);
        $cycleCount->load(['items', 'location']);
        $rows = $cycleCount->items->map(function ($item) use ($cycleCount) {
            $delta = $item->counted_quantity === null ? null : round((float) $item->counted_quantity - (float) $item->system_quantity, 4);
            return [$cycleCount->count_number, $cycleCount->location->name, $cycleCount->status, $cycleCount->snapshot_at->toDateTimeString(),
                $item->product_name, $item->product_code, $item->unit_name, (float) $item->system_quantity,
                $item->counted_quantity === null ? null : (float) $item->counted_quantity, $delta, (float) $item->base_cost,
                $delta === null ? null : round($delta * (float) $item->base_cost, 2), $item->notes];
        });
        $path = $excel->create('Cycle Count', ['Count', 'Warehouse', 'Status', 'Snapshot at', 'Product', 'Code', 'Base unit',
            'System quantity', 'Physical count', 'Quantity difference', 'Unit cost', 'Value difference', 'Notes'], $rows);
        return response()->download($path, $cycleCount->count_number.'.xlsx')->deleteFileAfterSend(true);
    }

    private function countData(Request $request): array
    {
        return $request->validate(['revision' => ['required', 'integer', 'min:1'], 'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1', 'max:200'], 'items.*.id' => ['required', 'integer', 'distinct'],
            'items.*.counted_quantity' => ['nullable', 'numeric', 'min:0', 'max:9999999999', 'decimal:0,4'],
            'items.*.notes' => ['nullable', 'string', 'max:1000']]);
    }

    private function location(Request $request, int $id): Location
    {
        $location = Location::findOrFail($id);
        abort_unless($request->user()->canAccessLocation($location), 403);
        return $location;
    }

    private function locations(Request $request)
    {
        return Location::query()->whereIn('id', $request->user()->accessibleLocationIds())->where('type', 'warehouse')
            ->orderBy('name')->get(['id', 'name', 'code', 'is_active']);
    }
}
