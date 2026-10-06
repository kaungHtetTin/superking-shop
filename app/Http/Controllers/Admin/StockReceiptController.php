<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\StockReceipt;
use App\Services\AuditLogService;
use App\Services\Inventory\StockReceiptCsvService;
use App\Services\Inventory\StockReceiptService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use App\Support\Spa;
use Throwable;

class StockReceiptController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', StockReceipt::class);
        $locationIds = $request->user()->accessibleLocationIds();
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'location_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(StockReceipt::STATUSES)],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $term = trim($validated['q'] ?? '');
        $query = StockReceipt::query()
            ->whereIn('location_id', $locationIds)
            ->with(['location:id,code,name', 'items'])
            ->when($term !== '', fn ($scope) => $scope->where(fn ($search) => $search
                ->where('receipt_number', 'like', "%{$term}%")
                ->orWhere('supplier_reference', 'like', "%{$term}%")
                ->orWhereHas('items.product', fn ($products) => $products
                    ->where('name', 'like', "%{$term}%")
                    ->orWhere('product_code', 'like', "%{$term}%"))))
            ->when(! empty($validated['location_id']), fn ($scope) => $scope->where('location_id', (int) $validated['location_id']))
            ->when(! empty($validated['status']), fn ($scope) => $scope->where('status', $validated['status']))
            ->when(! empty($validated['from']), fn ($scope) => $scope->where('created_at', '>=', Carbon::parse($validated['from'])->startOfDay()))
            ->when(! empty($validated['to']), fn ($scope) => $scope->where('created_at', '<=', Carbon::parse($validated['to'])->endOfDay()));

        return Spa::render('Admin/Inventory/Receipts/Index', [
            'receipts' => $query->latest()->paginate(20)->withQueryString(),
            'locations' => Location::query()->whereIn('id', $locationIds)->orderBy('name')->get(['id', 'code', 'name']),
            'statuses' => StockReceipt::STATUSES,
            'filters' => $request->only(['q', 'location_id', 'status', 'from', 'to']),
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

    public function importTemplate(Request $request)
    {
        $this->authorize('create', StockReceipt::class);

        return response()->streamDownload(function () {
            $output = fopen('php://output', 'wb');
            $pricing = app(\App\Services\AutomaticPricingService::class);
            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, StockReceiptCsvService::HEADERS);

            Product::query()
                ->where('is_active', true)
                ->whereHas('defaultSellingUnit', fn ($query) => $query->where('is_active', true))
                ->with('defaultSellingUnit')
                ->orderBy('name')
                ->chunkById(500, function ($products) use ($output, $pricing) {
                    foreach ($products as $product) {
                        $unit = $product->defaultSellingUnit;
                        $buyingCost = $pricing->readCost($product);
                        fputcsv($output, [
                            $this->excelSafe($product->product_code),
                            $this->excelSafe($product->sku),
                            $this->excelSafe($product->name),
                            $this->excelSafe($unit->name),
                            $this->excelSafe($unit->code),
                            '0',
                            '0',
                            number_format((float) $buyingCost * (float) $unit->conversion_factor, 2, '.', ''),
                        ]);
                    }
                });
            fclose($output);
        }, 'stock-receipt-template-'.now()->format('Y-m-d-His').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function importPreview(Request $request, StockReceiptCsvService $importer): JsonResponse
    {
        $this->authorize('create', StockReceipt::class);
        $validated = $request->validate([
            'location_id' => ['required', 'integer', 'exists:locations,id'],
            'receipt_file' => ['required', 'file', 'mimes:csv,txt', 'max:20480'],
        ]);
        $location = Location::findOrFail($validated['location_id']);
        abort_unless($request->user()->canAccessLocation($location), 403);

        $rows = $importer->parse($validated['receipt_file'], $location);
        $items = collect($rows)->map(fn ($row) => [
            'product_id' => $row['product']->id,
            'product_unit_id' => $row['unit']->id,
            'received_quantity' => $row['received_quantity'],
            'free_quantity' => $row['free_quantity'],
            'unit_cost' => $row['unit_cost'],
            'unit' => $this->receiptUnitPayload($row['unit'], $row['product']),
        ])->values();

        return response()->json([
            'items' => $items,
            'message' => $items->count().' receipt lines imported. Review quantities and costs before continuing.',
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
            'items.product:id,name,product_code,sku,barcode,original_price,pricing_base_cost,pricing_buying_cost',
            'items.product.units:id,product_id,name,code,conversion_factor,is_base,is_default_selling,is_active',
            'items.unit:id,product_id,name,code,conversion_factor',
            'corrections.actor:id,name',
            'corrections.item.product:id,name,product_code',
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

    public function correct(Request $request, StockReceipt $receipt, StockReceiptService $service, AuditLogService $audit)
    {
        $this->authorize('correct', $receipt);
        abort_unless($request->user()->canAccessLocation($receipt->location), 403);
        $validated = $request->validate([
            'item_id' => ['required', 'integer', 'exists:stock_receipt_items,id'],
            'reason' => ['required', Rule::in(['purchase_error', 'supplier_bonus'])],
            'received_quantity' => ['required', 'numeric', 'min:0', 'max:9999999999'],
            'free_quantity' => ['required', 'numeric', 'min:0', 'max:9999999999'],
            'unit_cost' => ['required', 'numeric', 'min:0', 'max:999999999999.99'],
            'notes' => ['required', 'string', 'max:2000'],
        ]);
        $item = $receipt->items()->findOrFail($validated['item_id']);
        $correction = $service->correctPostedItem($receipt, $item, $validated, $request->user());
        $audit->record('inventory.receipt.corrected', $receipt, ['correction_id' => $correction->id, 'reason' => $correction->reason, 'purchase_amount_delta' => $correction->purchase_amount_delta], $request);

        return redirect()->route('admin.inventory.receipts.show', $receipt)->with('success', 'Receipt corrected. Original and corrected values remain in the audit history.');
    }

    public function edit(Request $request, StockReceipt $receipt)
    {
        $this->authorize('update', $receipt);
        abort_unless($receipt->status === 'draft', 404);
        $receipt->load([
            'items.product:id,name,product_code,sku,barcode,original_price,pricing_base_cost,pricing_buying_cost',
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
        $buyingCost = app(\App\Services\AutomaticPricingService::class)->readCost($product);

        $mapUnit = fn (ProductUnit $option) => [
            'id' => $option->id,
            'product_unit_id' => $option->id,
            'product_id' => $option->product_id,
            'product_code' => $product->product_code,
            'product_sku' => $product->sku,
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
            'buying_cost' => (float) $buyingCost,
            'prices' => $option->prices,
            'on_hand_qty' => $option->fromBaseQuantity((float) ($balance?->on_hand_qty ?? 0)),
            'available_base_qty' => (float) ($balance?->available_qty ?? 0),
            'available_qty' => $option->fromBaseQuantity((float) ($balance?->available_qty ?? 0)),
        ];

        return array_merge($mapUnit($unit), [
            'unit_options' => $product->units->map($mapUnit)->values(),
        ]);
    }

    private function excelSafe(?string $value): string
    {
        $value ??= '';

        return preg_match('/^[=+\-@\t\r]/u', $value) ? "'{$value}" : $value;
    }
}
