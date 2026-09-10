<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Services\ProductCsvImportService;
use App\Support\Spa;
use Illuminate\Http\Request;

class ProductImportController extends Controller
{
    public function create()
    {
        return Spa::render('Admin/Products/Import', [
            'categories' => Category::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function template()
    {
        $rows = [
            ProductCsvImportService::HEADERS,
            ['Example Coffee', 'Drinks', 'Beverages', 'COFFEE-001', '', 'Piece', 'pc', '800', '1000', '5', 'active', 'Example row - replace or delete'],
        ];

        return response()->streamDownload(function () use ($rows) {
            $output = fopen('php://output', 'wb');
            fwrite($output, "\xEF\xBB\xBF");
            foreach ($rows as $row) fputcsv($output, $row);
            fclose($output);
        }, 'product-import-template.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function export()
    {
        return response()->streamDownload(function () {
            $output = fopen('php://output', 'wb');
            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, ProductCsvImportService::HEADERS);

            Product::query()
                ->with(['category:id,parent_id,name', 'category.parent:id,name', 'baseUnit.prices.typeDefinition'])
                ->orderBy('id')
                ->chunkById(500, function ($products) use ($output) {
                    foreach ($products as $product) {
                        $baseUnit = $product->baseUnit;
                        $retailPrice = $baseUnit?->prices
                            ->first(fn ($price) => $price->typeDefinition?->name === 'retail')?->price;

                        fputcsv($output, [
                            $this->excelSafe($product->name),
                            $this->excelSafe($product->category?->parent?->name),
                            $this->excelSafe($product->category?->name),
                            $this->excelSafe($product->sku),
                            $this->excelSafe($product->barcode),
                            $this->excelSafe($baseUnit?->name),
                            $this->excelSafe($baseUnit?->code),
                            $product->original_price,
                            $retailPrice,
                            $product->min_quantity,
                            $product->status,
                            $this->excelSafe($product->description),
                        ]);
                    }
                });

            fclose($output);
        }, 'products-'.now()->format('Y-m-d-His').'.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function store(Request $request, ProductCsvImportService $importer)
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
            'create_missing_categories' => ['required', 'boolean'],
        ]);

        $result = $importer->import($validated['file'], $validated['create_missing_categories']);
        $message = "CSV import completed — {$result['products']} of {$result['total_rows']} new products created successfully.";
        if ($result['categories'] > 0) {
            $categoryLabel = $result['categories'] === 1 ? 'category was' : 'categories were';
            $message .= " {$result['categories']} new {$categoryLabel} created as inactive.";
        }
        if ($result['skipped_rows'] > 0) {
            $message .= " {$result['skipped_rows']} blank rows were skipped.";
        }

        return redirect()->route('admin.products.index')
            ->with('success', $message);
    }

    private function excelSafe(?string $value): string
    {
        $value ??= '';

        return preg_match('/^[=+\-@\t\r]/u', $value) ? "'{$value}" : $value;
    }
}
