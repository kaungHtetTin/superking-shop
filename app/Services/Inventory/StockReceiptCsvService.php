<?php

namespace App\Services\Inventory;

use App\Models\Location;
use App\Models\Product;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StockReceiptCsvService
{
    public const MAX_ROWS = 50000;

    public const HEADERS = [
        'product_code', 'sku', 'product_name', 'unit_name', 'unit_code',
        'paid_quantity', 'free_quantity', 'unit_cost',
    ];

    /** @return array<int, array{product: Product, unit: \App\Models\ProductUnit, received_quantity: float, free_quantity: float, unit_cost: float}> */
    public function parse(UploadedFile $file, Location $location): array
    {
        $rows = $this->readSelectedRows($file);
        $products = Product::query()
            ->where('is_active', true)
            ->whereIn('product_code', collect($rows)->pluck('product_code')->unique())
            ->with([
                'inventoryBalances' => fn ($query) => $query->where('location_id', $location->id),
                'units' => fn ($query) => $query->where('is_active', true)->with('prices')->orderByDesc('is_base')->orderBy('sort_order'),
            ])
            ->get()
            ->keyBy('product_code');

        $errors = [];
        $selected = [];
        $seenProducts = [];

        foreach ($rows as $row) {
            $product = $products->get($row['product_code']);
            if (! $product) {
                $errors[] = "Row {$row['_line']}: active product code '{$row['product_code']}' was not found.";
                continue;
            }
            if (isset($seenProducts[$product->id])) {
                $errors[] = "Row {$row['_line']}: product '{$row['product_code']}' appears more than once.";
                continue;
            }

            $nameKey = $this->identity($row['unit_name']);
            $codeKey = $this->identity($row['unit_code']);
            $nameMatch = $product->units->first(fn ($unit) => $this->identity($unit->name) === $nameKey);
            $codeMatch = $product->units->first(fn ($unit) => $this->identity($unit->code) === $codeKey);

            if (! $nameMatch || ! $codeMatch || $nameMatch->id !== $codeMatch->id) {
                $errors[] = "Row {$row['_line']}: unit name and code do not identify the same active unit for '{$row['product_code']}'.";
                continue;
            }

            $seenProducts[$product->id] = true;
            $selected[] = [
                'product' => $product,
                'unit' => $nameMatch,
                'received_quantity' => (float) $row['paid_quantity'],
                'free_quantity' => (float) $row['free_quantity'],
                'unit_cost' => (float) $row['unit_cost'],
            ];
        }

        if ($errors !== []) {
            throw ValidationException::withMessages(['receipt_file' => implode("\n", array_unique($errors))]);
        }

        return $selected;
    }

    private function readSelectedRows(UploadedFile $file): array
    {
        $handle = fopen($file->getRealPath(), 'rb');
        if ($handle === false) {
            throw ValidationException::withMessages(['receipt_file' => 'The CSV file could not be read.']);
        }

        $header = fgetcsv($handle);
        if ($header === false) {
            fclose($handle);
            throw ValidationException::withMessages(['receipt_file' => 'The CSV file is empty.']);
        }

        $header = array_map(fn ($value) => Str::lower(trim((string) $value)), $header);
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);
        if ($header !== self::HEADERS) {
            fclose($handle);
            throw ValidationException::withMessages(['receipt_file' => 'CSV columns must exactly match the downloaded receipt template.']);
        }

        $rows = [];
        $errors = [];
        $line = 1;
        while (($values = fgetcsv($handle)) !== false) {
            $line++;
            if (count(array_filter($values, fn ($value) => trim((string) $value) !== '')) === 0) continue;
            if ($line - 1 > self::MAX_ROWS) {
                $errors[] = 'CSV files may contain at most '.self::MAX_ROWS.' product rows.';
                break;
            }
            if (count($values) !== count(self::HEADERS)) {
                $errors[] = "Row {$line}: expected ".count(self::HEADERS).' columns.';
                continue;
            }

            $row = array_combine(self::HEADERS, array_map(fn ($value) => trim((string) $value), $values));
            $paid = $row['paid_quantity'] === '' ? 0 : $row['paid_quantity'];
            $free = $row['free_quantity'] === '' ? 0 : $row['free_quantity'];
            $rowErrors = [];

            if (! is_numeric($paid) || (float) $paid < 0 || (float) $paid > 9999999999) $rowErrors[] = 'paid quantity must be between 0 and 9999999999';
            if (! is_numeric($free) || (float) $free < 0 || (float) $free > 9999999999) $rowErrors[] = 'free quantity must be between 0 and 9999999999';
            if ($rowErrors !== []) {
                $errors[] = "Row {$line}: ".implode('; ', $rowErrors).'.';
                continue;
            }

            if ((float) $paid === 0.0 && (float) $free === 0.0) continue;
            if ((float) $paid <= 0) $rowErrors[] = 'paid quantity must be greater than zero for an imported receipt line';
            foreach (['product_code', 'unit_name', 'unit_code', 'unit_cost'] as $required) {
                if ($row[$required] === '') $rowErrors[] = str_replace('_', ' ', $required).' is required';
            }
            if ($row['unit_cost'] !== '' && (! is_numeric($row['unit_cost']) || (float) $row['unit_cost'] < 0 || (float) $row['unit_cost'] > 999999999999.99)) {
                $rowErrors[] = 'unit cost must be between 0 and 999999999999.99';
            }

            if ($rowErrors !== []) $errors[] = "Row {$line}: ".implode('; ', $rowErrors).'.';
            else {
                $row['paid_quantity'] = $paid;
                $row['free_quantity'] = $free;
                $row['_line'] = $line;
                $rows[] = $row;
            }
        }
        fclose($handle);

        if ($rows === [] && $errors === []) {
            $errors[] = 'Enter a paid quantity for at least one product before importing.';
        }
        if ($errors !== []) {
            throw ValidationException::withMessages(['receipt_file' => implode("\n", array_unique($errors))]);
        }

        return $rows;
    }

    private function identity(string $value): string
    {
        return Str::lower(trim($value));
    }
}
