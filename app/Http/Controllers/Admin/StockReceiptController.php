<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Location;
use App\Models\ProductUnit;
use App\Models\StockReceipt;
use App\Services\AuditLogService;
use App\Services\Inventory\StockReceiptService;
use Illuminate\Http\Request;
use App\Support\Spa;

class StockReceiptController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', StockReceipt::class);
        return Spa::render('Admin/Inventory/Receipts/Index', [
            'receipts' => StockReceipt::query()
                ->whereIn('location_id', $request->user()->accessibleLocationIds())
                ->with(['location:id,code,name', 'items'])
                ->latest()->paginate(20)->withQueryString(),
        ]);
    }

    public function create(Request $request)
    {
        $this->authorize('create', StockReceipt::class);
        return Spa::render('Admin/Inventory/Receipts/Create', [
            'locations' => Location::query()->whereIn('id', $request->user()->accessibleLocationIds())->orderBy('name')->get(['id', 'code', 'name', 'type']),
            'categories' => Category::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function show(Request $request, StockReceipt $receipt)
    {
        $this->authorize('view', $receipt);
        $receipt->load([
            'location:id,code,name,type',
            'creator:id,name',
            'receiver:id,name',
            'inventoryImport:id,batch_number,original_filename',
            'items.product:id,name,product_code,barcode,original_price',
            'items.unit:id,product_id,name,code,conversion_factor',
        ]);

        return Spa::render('Admin/Inventory/Receipts/Show', [
            'receipt' => $receipt,
        ]);
    }

    public function store(Request $request, StockReceiptService $service, AuditLogService $audit)
    {
        $this->authorize('create', StockReceipt::class);
        $validated = $request->validate($this->receiptRules());
        $location = Location::findOrFail($validated['location_id']);
        abort_unless($request->user()->canAccessLocation($location), 403);

        $receipt = $service->createDraft($location, $validated['items'], $request->user(), $validated['supplier_reference'] ?? null, $validated['notes'] ?? null);
        $audit->record('inventory.receipt.created', $receipt, ['location_id' => $location->id], $request);

        $receipt = $service->post($receipt, $request->user());
        $audit->record('inventory.receipt.posted', $receipt, ['location_id' => $receipt->location_id], $request);

        return redirect()->route('admin.inventory.receipts.index')->with('success', 'Receipt posted and stock updated.');
    }

    public function edit(Request $request, StockReceipt $receipt)
    {
        $this->authorize('update', $receipt);
        abort_unless($receipt->status === 'draft', 404);
        $receipt->load([
            'items.product:id,name,product_code,barcode,original_price',
            'items.product.inventoryBalances' => fn ($query) => $query->where('location_id', $receipt->location_id),
            'items.unit.prices',
        ]);

        return Spa::render('Admin/Inventory/Receipts/Edit', [
            'receipt' => [
                'id' => $receipt->id,
                'receipt_number' => $receipt->receipt_number,
                'location_id' => $receipt->location_id,
                'supplier_reference' => $receipt->supplier_reference,
                'notes' => $receipt->notes,
                'items' => $receipt->items->map(fn ($item) => [
                    'product_id' => $item->product_id,
                    'product_unit_id' => $item->product_unit_id,
                    'received_quantity' => $item->received_quantity,
                    'unit_cost' => $item->unit_cost,
                    'unit' => $this->receiptUnitPayload($item->unit),
                ])->values(),
            ],
            'locations' => Location::query()->whereIn('id', $request->user()->accessibleLocationIds())->orderBy('name')->get(['id', 'code', 'name', 'type']),
            'categories' => Category::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function update(Request $request, StockReceipt $receipt, StockReceiptService $service, AuditLogService $audit)
    {
        $this->authorize('update', $receipt);
        $validated = $request->validate($this->receiptRules());
        $location = Location::findOrFail($validated['location_id']);
        abort_unless($request->user()->canAccessLocation($location), 403);

        $receipt = $service->updateDraft($receipt, $location, $validated['items'], $validated['supplier_reference'] ?? null, $validated['notes'] ?? null);
        $audit->record('inventory.receipt.updated', $receipt, ['location_id' => $location->id], $request);

        $receipt = $service->post($receipt, $request->user());
        $audit->record('inventory.receipt.posted', $receipt, ['location_id' => $receipt->location_id], $request);

        return redirect()->route('admin.inventory.receipts.index')->with('success', 'Receipt posted and stock updated.');
    }

    public function destroy(Request $request, StockReceipt $receipt, StockReceiptService $service, AuditLogService $audit)
    {
        $this->authorize('delete', $receipt);
        $receiptNumber = $receipt->receipt_number;
        $locationId = $receipt->location_id;

        $service->delete($receipt, $request->user());
        $audit->record('inventory.receipt.deleted', null, ['receipt_number' => $receiptNumber, 'location_id' => $locationId], $request);

        return redirect()
            ->route('admin.inventory.receipts.index', [], 303)
            ->with('success', "Receipt {$receiptNumber} deleted and stock adjusted.");
    }

    private function receiptRules(): array
    {
        return [
            'location_id' => ['required', 'integer', 'exists:locations,id'],
            'supplier_reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'items.*.product_unit_id' => ['required', 'integer', 'exists:product_units,id'],
            'items.*.expected_quantity' => ['nullable', 'numeric', 'min:0'],
            'items.*.received_quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_cost' => ['nullable', 'numeric', 'min:0'],
            'items.*.notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    private function receiptUnitPayload(ProductUnit $unit): array
    {
        $balance = $unit->product->inventoryBalances->first();

        return [
            'id' => $unit->id,
            'product_id' => $unit->product_id,
            'product_code' => $unit->product->product_code,
            'barcode' => $unit->product->barcode,
            'product_name' => $unit->product->name,
            'unit_name' => $unit->name,
            'unit_code' => $unit->code,
            'conversion_factor' => (float) $unit->conversion_factor,
            'original_price' => (float) $unit->product->original_price,
            'prices' => $unit->prices,
            'on_hand_qty' => (float) ($balance?->on_hand_qty ?? 0),
            'available_qty' => (float) ($balance?->available_qty ?? 0),
        ];
    }
}
