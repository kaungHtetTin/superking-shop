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
use Illuminate\Support\Facades\DB;
use App\Support\Spa;
use Throwable;

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
            'priceChanges' => DB::table('price_changes')->where('operation_id', 'receipt:'.$receipt->id)->orderBy('id')->get(),
        ]);
    }

    public function store(Request $request, StockReceiptService $service, AuditLogService $audit)
    {
        $this->authorize('create', StockReceipt::class);
        $validated = $request->validate($this->receiptRules());
        $location = Location::findOrFail($validated['location_id']);
        abort_unless($request->user()->canAccessLocation($location), 403);

        try {
            $posted = DB::transaction(function () use ($service, $audit, $location, $validated, $request) {
                $receipt = $service->createDraft($location, $validated['items'], $request->user(), $validated['supplier_reference'] ?? null, $validated['notes'] ?? null);
                $audit->record('inventory.receipt.created', $receipt, ['location_id' => $location->id], $request);

                $receipt = $service->post($receipt, $request->user(), $request->boolean('acknowledge_below_cost'));
                $audit->record('inventory.receipt.posted', $receipt, ['location_id' => $receipt->location_id], $request);
                return $receipt;
            }, 3);
        } catch (\Illuminate\Validation\ValidationException $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            report($exception);

            return back()->withInput()->withErrors([
                'receipt' => 'Receipt could not be posted. No stock was changed. Please try again or contact an administrator.',
            ]);
        }

        return redirect()->route('admin.inventory.receipts.show', $posted)->with('success', 'Receipt posted. '.($posted->pricing_summary['changed_row_count'] ?? 0).' prices updated; '.($posted->pricing_summary['skipped_cost_count'] ?? 0).' rows need cost.');
    }

    public function edit(Request $request, StockReceipt $receipt)
    {
        $this->authorize('update', $receipt);
        abort_unless($receipt->status === 'draft', 404);
        $receipt->load([
            'items.product:id,name,product_code,barcode,original_price',
            'items.product.inventoryBalances' => fn ($query) => $query->where('location_id', $receipt->location_id),
            'items.product.units' => fn ($query) => $query->where('is_active', true)->with('prices')->orderByDesc('is_base')->orderBy('sort_order'),
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
                    'free_quantity' => $item->free_quantity,
                    'notes' => $item->notes,
                    'unit_cost' => $item->unit_cost,
                    'unit' => $this->receiptUnitPayload($item->unit, $item->product),
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

        try {
            $posted = DB::transaction(function () use ($service, $audit, $receipt, $location, $validated, $request) {
                $updatedReceipt = $service->updateDraft($receipt, $location, $validated['items'], $validated['supplier_reference'] ?? null, $validated['notes'] ?? null);
                $audit->record('inventory.receipt.updated', $updatedReceipt, ['location_id' => $location->id], $request);

                $postedReceipt = $service->post($updatedReceipt, $request->user(), $request->boolean('acknowledge_below_cost'));
                $audit->record('inventory.receipt.posted', $postedReceipt, ['location_id' => $postedReceipt->location_id], $request);
                return $postedReceipt;
            }, 3);
        } catch (\Illuminate\Validation\ValidationException $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            report($exception);

            return back()->withInput()->withErrors([
                'receipt' => 'Receipt could not be posted. No stock was changed. Please try again or contact an administrator.',
            ]);
        }

        return redirect()->route('admin.inventory.receipts.show', $posted)->with('success', 'Receipt posted. '.($posted->pricing_summary['changed_row_count'] ?? 0).' prices updated; '.($posted->pricing_summary['skipped_cost_count'] ?? 0).' rows need cost.');
    }

    public function destroy(Request $request, StockReceipt $receipt, StockReceiptService $service, AuditLogService $audit)
    {
        $this->authorize('delete', $receipt);
        $receiptNumber = $receipt->receipt_number;
        $locationId = $receipt->location_id;

        $summary = $service->delete($receipt, $request->user());
        $audit->record('inventory.receipt.deleted', null, ['receipt_number' => $receiptNumber, 'location_id' => $locationId], $request);

        return redirect()
            ->route('admin.inventory.receipts.index', [], 303)
            ->with('success', "Receipt {$receiptNumber} deleted and stock adjusted. {$summary['changed_row_count']} prices updated; {$summary['skipped_cost_count']} rows need cost.");
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
            'acknowledge_below_cost' => ['sometimes', 'boolean'],
            'items.*.free_quantity' => ['sometimes', 'numeric', 'min:0', 'max:9999999999'],
            'items.*.received_quantity' => ['required', 'numeric', 'min:0.0001', 'max:9999999999'],
            'items.*.unit_cost' => ['nullable', 'numeric', 'min:0', 'max:999999999999.99'],
            'items.*.notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    private function receiptUnitPayload(ProductUnit $unit, \App\Models\Product $product): array
    {
        $balance = $product->inventoryBalances->first();

        $mapUnit = fn (ProductUnit $option) => [
            'id' => $option->id,
            'product_unit_id' => $option->id,
            'product_id' => $option->product_id,
            'product_code' => $product->product_code,
            'barcode' => $product->barcode,
            'product_name' => $product->name,
            'unit_name' => $option->name,
            'unit_code' => $option->code,
            'name' => $option->name,
            'code' => $option->code,
            'conversion_factor' => (float) $option->conversion_factor,
            'is_base' => (bool) $option->is_base,
            'is_default_selling' => (bool) $option->is_default_selling,
            'original_price' => (float) $product->original_price,
            'prices' => $option->prices,
            'on_hand_qty' => $option->fromBaseQuantity((float) ($balance?->on_hand_qty ?? 0)),
            'available_base_qty' => (float) ($balance?->available_qty ?? 0),
            'available_qty' => $option->fromBaseQuantity((float) ($balance?->available_qty ?? 0)),
        ];

        return array_merge($mapUnit($unit), [
            'unit_options' => $product->units->map($mapUnit)->values(),
        ]);
    }
}
