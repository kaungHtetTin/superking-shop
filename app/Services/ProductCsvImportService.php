<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Location;
use App\Models\Product;
use App\Services\Inventory\InventoryService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProductCsvImportService
{
    public const MAX_ROWS = 10000;

    public const HEADERS = [
        'name', 'category', 'barcode', 'base_unit_name', 'base_unit_code',
        'cost_price', 'retail_price', 'min_quantity', 'status', 'description',
    ];

    public function __construct(private InventoryService $inventoryService)
    {
    }

    /** @return array{total_rows: int, products: int, categories: int, skipped_rows: int} */
    public function import(UploadedFile $file, bool $createMissingCategories = true): array
    {
        [$rows, $errors, $stats] = $this->readAndValidate($file, $createMissingCategories);

        if ($errors !== []) {
            $messages = array_merge([
                "CSV import failed — Total rows: {$stats['total_rows']}; Valid rows: {$stats['valid_rows']}; Invalid rows: {$stats['invalid_rows']}; Products imported: 0.",
            ], $errors);
            throw ValidationException::withMessages(['file' => implode("\n", $messages)]);
        }

        return DB::transaction(function () use ($rows, $stats) {
            $pricing = app(AutomaticPricingService::class);
            $pricing->lock();
            $defaultLocation = Location::query()
                ->where('is_default_fulfillment', true)
                ->where('is_active', true)
                ->first();

            $createdCategories = 0;
            $categoryIds = Category::query()->get(['id', 'name'])
                ->mapWithKeys(fn (Category $category) => [Str::lower(trim($category->name)) => $category->id])
                ->all();

            foreach ($rows as $row) {
                $categoryKey = Str::lower($row['category']);
                if (! isset($categoryIds[$categoryKey])) {
                    $category = Category::create([
                        'name' => $row['category'],
                        'slug' => $this->uniqueCategorySlug($row['category']),
                        'is_active' => false,
                    ]);
                    $categoryIds[$categoryKey] = $category->id;
                    $createdCategories++;
                }

                $product = Product::create([
                    'category_id' => $categoryIds[$categoryKey],
                    'barcode' => $row['barcode'] ?: $this->uniqueBarcode(),
                    'name' => $row['name'],
                    'slug' => $this->uniqueSlug($row['name']),
                    'description' => $row['description'] ?: null,
                    'min_quantity' => $row['min_quantity'],
                    'original_price' => $row['cost_price'],
                    'status' => $row['status'],
                    'is_active' => $row['status'] === 'active',
                ]);

                $unit = $product->units()->create([
                    'name' => $row['base_unit_name'],
                    'code' => $row['base_unit_code'],
                    'conversion_factor' => 1,
                    'is_base' => true,
                    'is_default_selling' => true,
                    'is_active' => true,
                    'sort_order' => 0,
                ]);
                $retail = $product->priceTypes()->create([
                    'name' => 'retail',
                    'is_default' => true,
                    'sort_order' => 0,
                ]);
                $unit->prices()->create([
                    'product_price_type_id' => $retail->id,
                    'price' => $row['retail_price'],
                ]);
                // An imported retail amount is an explicit Manual override.
                foreach (\App\Models\PricingRule::where('pricing_mode', 'automatic')->where('code', '!=', 'retail')->get() as $rule) {
                    $type = $product->priceTypes()->create(['name' => $rule->code, 'pricing_rule_id' => $rule->id]);
                    $unit->prices()->create(['product_price_type_id' => $type->id, 'price' => 0, 'is_manual' => false]);
                }
                $pricing->refreshProduct($product, 'product_import', auth()->id());

                if ($defaultLocation) {
                    $this->inventoryService->ensureBalance($defaultLocation, $product);
                }
            }

            return [
                'total_rows' => $stats['total_rows'],
                'products' => count($rows),
                'categories' => $createdCategories,
                'skipped_rows' => $stats['skipped_rows'],
            ];
        });
    }

    /** @return array{array<int, array<string, mixed>>, array<int, string>, array{total_rows: int, valid_rows: int, invalid_rows: int, skipped_rows: int}} */
    private function readAndValidate(UploadedFile $file, bool $createMissingCategories): array
    {
        $handle = fopen($file->getRealPath(), 'rb');
        if ($handle === false) {
            return [[], ['The CSV file could not be read.'], $this->emptyStats()];
        }

        $header = fgetcsv($handle);
        if ($header === false) {
            fclose($handle);
            return [[], ['The CSV file is empty.'], $this->emptyStats()];
        }
        $header = array_map(fn ($value) => Str::lower(trim((string) $value)), $header);
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);
        if ($header !== self::HEADERS) {
            fclose($handle);
            return [[], ['CSV columns must exactly match the downloaded template.'], $this->emptyStats()];
        }

        $categories = Category::query()->get(['id', 'name'])
            ->keyBy(fn (Category $category) => Str::lower(trim($category->name)));
        $existingBarcodes = Product::query()->whereNotNull('barcode')->pluck('barcode')
            ->mapWithKeys(fn ($barcode) => [trim((string) $barcode) => true])->all();
        $fileBarcodes = [];
        $rows = [];
        $errors = [];
        $line = 1;
        $totalRows = 0;
        $invalidRows = 0;
        $skippedRows = 0;

        while (($values = fgetcsv($handle)) !== false) {
            $line++;
            if (count(array_filter($values, fn ($value) => trim((string) $value) !== '')) === 0) {
                $skippedRows++;
                continue;
            }
            $totalRows++;
            if ($totalRows > self::MAX_ROWS) {
                $errors[] = 'CSV files may contain at most '.self::MAX_ROWS.' product rows.';
                $invalidRows++;
                break;
            }
            if (count($values) !== count(self::HEADERS)) {
                $errors[] = "Row {$line}: expected ".count(self::HEADERS).' columns.';
                $invalidRows++;
                continue;
            }

            $row = array_combine(self::HEADERS, array_map(fn ($value) => trim((string) $value), $values));
            $rowErrors = [];
            foreach (['name', 'category', 'base_unit_name', 'base_unit_code', 'cost_price', 'retail_price'] as $required) {
                if ($row[$required] === '') {
                    $rowErrors[] = str_replace('_', ' ', $required).' is required';
                }
            }
            if (mb_strlen($row['name']) > 255) $rowErrors[] = 'name is too long';
            if (mb_strlen($row['barcode']) > 128) $rowErrors[] = 'barcode is too long';
            if (mb_strlen($row['base_unit_name']) > 80) $rowErrors[] = 'base unit name is too long';
            if (mb_strlen($row['base_unit_code']) > 30) $rowErrors[] = 'base unit code is too long';

            $category = $categories->get(Str::lower($row['category']));
            if (! $category && ! $createMissingCategories) $rowErrors[] = "category '{$row['category']}' does not exist";

            foreach (['cost_price', 'retail_price', 'min_quantity'] as $number) {
                $row[$number] = $row[$number] === '' && $number === 'min_quantity' ? '0' : $row[$number];
                if (! is_numeric($row[$number]) || (float) $row[$number] < 0) {
                    $rowErrors[] = str_replace('_', ' ', $number).' must be zero or greater';
                }
            }
            $row['status'] = Str::lower($row['status'] ?: 'active');
            if (! in_array($row['status'], ['active', 'inactive', 'draft'], true)) {
                $rowErrors[] = 'status must be active, inactive, or draft';
            }
            if ($row['barcode'] !== '') {
                if (isset($existingBarcodes[$row['barcode']])) $rowErrors[] = 'barcode already exists';
                if (isset($fileBarcodes[$row['barcode']])) $rowErrors[] = 'barcode is duplicated in this file';
                $fileBarcodes[$row['barcode']] = true;
            }

            if ($rowErrors !== []) {
                $errors[] = "Row {$line}: ".implode('; ', $rowErrors).'.';
                $invalidRows++;
                continue;
            }
            $rows[] = $row;
        }
        fclose($handle);

        if ($rows === [] && $errors === []) $errors[] = 'The CSV file has no product rows.';

        return [$rows, $errors, [
            'total_rows' => $totalRows,
            'valid_rows' => count($rows),
            'invalid_rows' => $invalidRows,
            'skipped_rows' => $skippedRows,
        ]];
    }

    /** @return array{total_rows: int, valid_rows: int, invalid_rows: int, skipped_rows: int} */
    private function emptyStats(): array
    {
        return ['total_rows' => 0, 'valid_rows' => 0, 'invalid_rows' => 0, 'skipped_rows' => 0];
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'product';
        $slug = $base;
        $suffix = 2;
        while (Product::query()->where('slug', $slug)->exists()) $slug = $base.'-'.$suffix++;
        return $slug;
    }

    private function uniqueCategorySlug(string $name): string
    {
        $base = Str::slug($name) ?: 'category';
        $slug = $base;
        $suffix = 2;
        while (Category::query()->where('slug', $slug)->exists()) $slug = $base.'-'.$suffix++;
        return $slug;
    }

    private function uniqueBarcode(): string
    {
        do {
            $barcode = '20'.str_pad((string) random_int(0, 9999999999), 10, '0', STR_PAD_LEFT);
        } while (Product::query()->where('barcode', $barcode)->exists());
        return $barcode;
    }
}
