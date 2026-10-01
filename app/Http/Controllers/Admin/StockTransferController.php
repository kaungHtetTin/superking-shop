<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Location;
use App\Models\StockTransfer;
use App\Services\AuditLogService;
use App\Services\Inventory\StockTransferService;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use App\Support\Spa;

class StockTransferController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', StockTransfer::class);
        $locationIds = $request->user()->accessibleLocationIds();

        $filters = $request->validate($this->filterRules());
        $query = $this->filteredQuery($locationIds, $filters);
        $summaryRows = (clone $query)->with(['sourceLocation:id,code,name', 'destinationLocation:id,code,name'])->get();
        $transfers = (clone $query)
            ->with(['sourceLocation:id,code,name', 'destinationLocation:id,code,name', 'items'])
            ->latest()
            ->paginate(20)
            ->withQueryString();
        $transfers->getCollection()->each(function (StockTransfer $transfer) use ($request) {
            $transfer->setAttribute('can_delete', $request->user()->can('delete', $transfer));
        });

        return Spa::render('Admin/Inventory/Transfers/Index', [
            'transfers' => $transfers,
            'filters' => $filters,
            'locations' => Location::query()->whereIn('id', $locationIds)->orderBy('name')->get(['id', 'code', 'name']),
            'summary' => [
                'count' => $summaryRows->count(),
                'transfer_value' => (float) $summaryRows->sum('total_amount'),
                'by_source' => $this->summarizeByLocation($summaryRows, 'sourceLocation'),
                'by_destination' => $this->summarizeByLocation($summaryRows, 'destinationLocation'),
            ],
            'canCreate' => $request->user()->can('create', StockTransfer::class),
            'realtime' => [
                'locationIds' => $locationIds,
                'canAll' => $request->user()->isSuperAdmin(),
            ],
            'lastUpdated' => now()->toIso8601String(),
            'pollIntervalMs' => 20000,
        ]);
    }

    public function export(Request $request)
    {
        $this->authorize('viewAny', StockTransfer::class);
        $locationIds = $request->user()->accessibleLocationIds();
        $filters = $request->validate($this->filterRules());
        $rows = $this->filteredQuery($locationIds, $filters)
            ->with(['sourceLocation:id,code,name', 'destinationLocation:id,code,name', 'items'])
            ->oldest()
            ->get();
        $bySource = $this->summarizeByLocation($rows, 'sourceLocation');
        $byDestination = $this->summarizeByLocation($rows, 'destinationLocation');

        return response()->streamDownload(function () use ($rows, $bySource, $byDestination) {
            $output = fopen('php://output', 'w');
            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, ['TRANSFER RECORDS']);
            fputcsv($output, ['Date', 'Transfer', 'From shop', 'To shop', 'Lines', 'Units', 'Transfer amount', 'Note']);
            foreach ($rows as $row) {
                $total = (float) $row->total_amount;
                fputcsv($output, [$row->created_at?->format('Y-m-d H:i:s'), $row->transfer_number, $row->sourceLocation?->name, $row->destinationLocation?->name, $row->items->count(), $row->items->sum('requested_quantity'), $total, $row->notes]);
            }
            fputcsv($output, []);
            fputcsv($output, ['FILTERED OVERALL SUMMARY']);
            fputcsv($output, ['Transfers', 'Transfer amount']);
            fputcsv($output, [$rows->count(), $rows->sum('total_amount')]);
            fputcsv($output, []);
            fputcsv($output, ['SENT BY SHOP']);
            fputcsv($output, ['Shop', 'Transfers', 'Transfer amount']);
            foreach ($bySource as $row) fputcsv($output, [$row['name'], $row['count'], $row['transfer_value']]);
            fputcsv($output, []);
            fputcsv($output, ['RECEIVED BY SHOP']);
            fputcsv($output, ['Shop', 'Transfers', 'Transfer amount']);
            foreach ($byDestination as $row) fputcsv($output, [$row['name'], $row['count'], $row['transfer_value']]);
            fclose($output);
        }, 'transfer-records-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
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
            'destinationLocations' => Location::query()->where('is_active', true)->orderBy('name')->get(['id', 'code', 'name', 'type']),
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
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $source = Location::findOrFail($validated['source_location_id']);
        $destination = Location::findOrFail($validated['destination_location_id']);
        abort_unless($request->user()->canAccessLocation($source), 403);
        abort_unless($source->is_active && $destination->is_active, 422, 'Choose active source and destination branches.');

        $transfer = $service->transferNow(
            $source,
            $destination,
            $validated['items'],
            $request->user(),
            $validated
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
                'items.product.units:id,product_id,name,code,conversion_factor,is_base,is_default_selling,is_active',
                'items.unit:id,name,code,conversion_factor',
                'creator:id,name',
            ]),
            'canDelete' => $request->user()->can('delete', $transfer),
            'lastUpdated' => now()->toIso8601String(),
            'pollIntervalMs' => 20000,
        ]);
    }

    public function destroy(Request $request, StockTransfer $transfer, StockTransferService $service, AuditLogService $audit)
    {
        $this->authorize('delete', $transfer);
        $transferNumber = $transfer->transfer_number;
        $sourceLocationId = $transfer->source_location_id;
        $destinationLocationId = $transfer->destination_location_id;
        $totalAmount = (float) $transfer->total_amount;

        DB::transaction(function () use ($service, $transfer, $request, $audit, $transferNumber, $sourceLocationId, $destinationLocationId, $totalAmount) {
            $service->delete($transfer, $request->user());
            $audit->record('inventory.transfer.deleted', null, [
                'transfer_number' => $transferNumber,
                'source_location_id' => $sourceLocationId,
                'destination_location_id' => $destinationLocationId,
                'total_amount' => $totalAmount,
                'inventory_reversed' => true,
                'financial_entries_removed' => true,
            ], $request);
        }, 3);

        return redirect()
            ->route('admin.inventory.transfers.index', [], 303)
            ->with('success', "Transfer {$transferNumber} deleted; inventory and financial records were reversed.");
    }

    private function filterRules(): array
    {
        return [
            'source' => ['nullable', 'integer'],
            'destination' => ['nullable', 'integer'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
        ];
    }

    private function filteredQuery(array $locationIds, array $filters): Builder
    {
        return StockTransfer::query()
            ->where(fn ($query) => $query->whereIn('source_location_id', $locationIds)->orWhereIn('destination_location_id', $locationIds))
            ->when($filters['source'] ?? null, fn ($query, $id) => $query->where('source_location_id', $id))
            ->when($filters['destination'] ?? null, fn ($query, $id) => $query->where('destination_location_id', $id))
            ->when($filters['date_from'] ?? null, fn ($query, $date) => $query->whereDate('created_at', '>=', $date))
            ->when($filters['date_to'] ?? null, fn ($query, $date) => $query->whereDate('created_at', '<=', $date));
    }

    private function summarizeByLocation($rows, string $relation): array
    {
        return $rows->groupBy(fn ($row) => $row->{$relation}?->id)->map(function ($group) use ($relation) {
            $location = $group->first()->{$relation};
            $total = (float) $group->sum('total_amount');
            return ['id' => $location?->id, 'name' => $location?->name ?? '-', 'code' => $location?->code, 'count' => $group->count(), 'transfer_value' => $total];
        })->values()->all();
    }

}
