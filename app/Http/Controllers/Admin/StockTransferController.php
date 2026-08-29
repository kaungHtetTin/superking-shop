<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Location;
use App\Models\StockTransfer;
use App\Services\AuditLogService;
use App\Services\Inventory\StockTransferService;
use Illuminate\Http\Request;
use App\Support\Spa;

class StockTransferController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', StockTransfer::class);
        $locationIds = $request->user()->accessibleLocationIds();

        return Spa::render('Admin/Inventory/Transfers/Index', [
            'transfers' => StockTransfer::query()
                ->where(function ($query) use ($locationIds) {
                    $query->whereIn('source_location_id', $locationIds)
                        ->orWhereIn('destination_location_id', $locationIds);
                })
                ->with(['sourceLocation:id,code,name', 'destinationLocation:id,code,name', 'items'])
                ->latest()
                ->paginate(20)
                ->withQueryString(),
            'canCreate' => $request->user()->can('create', StockTransfer::class),
            'realtime' => [
                'locationIds' => $locationIds,
                'canAll' => $request->user()->hasAdminPermission('locations.manage'),
            ],
            'lastUpdated' => now()->toIso8601String(),
            'pollIntervalMs' => 20000,
        ]);
    }

    public function create(Request $request)
    {
        $this->authorize('create', StockTransfer::class);

        return Spa::render('Admin/Inventory/Transfers/Create', [
            'locations' => Location::query()
                ->whereIn('id', $request->user()->accessibleLocationIds())
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'code', 'name', 'type']),
            'categories' => Category::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request, StockTransferService $service, AuditLogService $audit)
    {
        $this->authorize('create', StockTransfer::class);
        $validated = $request->validate([
            'source_location_id' => ['required', 'integer', 'exists:locations,id'],
            'destination_location_id' => ['required', 'integer', 'exists:locations,id', 'different:source_location_id'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_unit_id' => ['required', 'integer', 'exists:product_units,id'],
            'items.*.requested_quantity' => ['required', 'numeric', 'gt:0'],
        ]);

        $source = Location::findOrFail($validated['source_location_id']);
        $destination = Location::findOrFail($validated['destination_location_id']);
        abort_unless($request->user()->canAccessLocation($source), 403);
        abort_unless($request->user()->canAccessLocation($destination), 403);

        $transfer = $service->transferNow(
            $source,
            $destination,
            $validated['items'],
            $request->user()
        );
        $audit->record('inventory.transfer.posted', $transfer, [
            'source_location_id' => $source->id,
            'destination_location_id' => $destination->id,
        ], $request);

        return redirect()->route('admin.inventory.transfers.show', $transfer)->with('success', 'Stock transferred.');
    }

    public function show(Request $request, StockTransfer $transfer)
    {
        $this->authorize('view', $transfer);

        return Spa::render('Admin/Inventory/Transfers/Show', [
            'transfer' => $transfer->load([
                'sourceLocation:id,code,name,type',
                'destinationLocation:id,code,name,type',
                'items.product:id,name,product_code',
                'items.unit:id,name,code,conversion_factor',
                'creator:id,name',
            ]),
            'lastUpdated' => now()->toIso8601String(),
            'pollIntervalMs' => 20000,
        ]);
    }

}
