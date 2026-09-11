<?php

namespace App\Services;

use App\Models\PricingRule;
use App\Models\Product;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProductUnitPriceCsvService
{
    public const MAX_ROWS = 50000;

    public const HEADERS = [
        'product_code', 'sku', 'product_name', 'unit_name', 'unit_code',
        'conversion_factor', 'is_base', 'is_default_selling', 'is_active',
        'price_type', 'price',
    ];

    public function import(UploadedFile $file): array
    {
        $rows = $this->read($file);
        $products = Product::query()
            ->whereIn('product_code', collect($rows)->pluck('product_code')->unique())
            ->with(['units', 'priceTypes.unitPrices'])
            ->get()
            ->keyBy('product_code');

        $errors = [];
        foreach (collect($rows)->pluck('product_code')->unique() as $code) {
            if (! $products->has($code)) $errors[] = "Product code '{$code}' does not exist.";
        }
        if ($errors !== []) throw ValidationException::withMessages(['unit_price_file' => implode("\n", $errors)]);

        $plans = [];
        foreach (collect($rows)->groupBy('product_code') as $code => $productRows) {
            try {
                $plans[$code] = $this->planProduct($products[$code], $productRows->all());
            } catch (ValidationException $exception) {
                $errors = array_merge($errors, $exception->errors()['unit_price_file'] ?? []);
            }
        }
        if ($errors !== []) throw ValidationException::withMessages(['unit_price_file' => implode("\n", $errors)]);

        return DB::transaction(function () use ($plans) {
            $pricing = app(AutomaticPricingService::class);
            $pricing->lock();
            $stats = ['products' => 0, 'units_created' => 0, 'units_updated' => 0, 'price_types_created' => 0, 'prices_upserted' => 0];

            foreach ($plans as $productCode => $plan) {
                $product = Product::query()->where('product_code', $productCode)->lockForUpdate()->firstOrFail();
                $savedUnits = [];
                foreach ($plan['units'] as $key => $unitData) {
                    $payload = collect($unitData)->only(['name', 'code', 'conversion_factor', 'is_base', 'is_default_selling', 'is_active'])->all();
                    if ($unitData['id']) {
                        $unit = $product->units()->whereKey($unitData['id'])->firstOrFail();
                        $unit->update($payload);
                        $stats['units_updated']++;
                    } else {
                        $unit = $product->units()->create($payload + ['sort_order' => $product->units()->max('sort_order') + 1]);
                        $stats['units_created']++;
                    }
                    $savedUnits[$key] = $unit;
                }

                $types = [];
                foreach ($plan['types'] as $index => $name) {
                    $rule = PricingRule::query()->where('code', $name)->first();
                    $type = $product->priceTypes()->firstOrNew(['name' => $name]);
                    if (! $type->exists) $stats['price_types_created']++;
                    $type->fill(['is_default' => $name === 'retail', 'sort_order' => $index, 'pricing_rule_id' => $rule?->id])->save();
                    $types[$name] = [$type, $rule];
                }

                foreach ($plan['prices'] as $priceData) {
                    [$type] = $types[$priceData['price_type']];
                    $price = $savedUnits[$priceData['unit_key']]->prices()->firstOrNew(['product_price_type_id' => $type->id]);
                    $price->fill([
                        'price' => $priceData['price'],
                        'is_manual' => true,
                        'calculation_status' => 'manual',
                    ])->save();
                    $stats['prices_upserted']++;
                }

                $pricing->refreshProduct($product, 'unit_price_import', auth()->id());
                $stats['products']++;
            }

            return $stats;
        });
    }

    private function read(UploadedFile $file): array
    {
        $handle = fopen($file->getRealPath(), 'rb');
        if ($handle === false) throw ValidationException::withMessages(['unit_price_file' => 'The CSV file could not be read.']);
        $header = fgetcsv($handle);
        if ($header === false) {
            fclose($handle);
            throw ValidationException::withMessages(['unit_price_file' => 'The CSV file is empty.']);
        }
        $header = array_map(fn ($value) => Str::lower(trim((string) $value)), $header);
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);
        if ($header !== self::HEADERS) {
            fclose($handle);
            throw ValidationException::withMessages(['unit_price_file' => 'CSV columns must exactly match the downloaded unit and price template.']);
        }

        $rows = [];
        $errors = [];
        $line = 1;
        while (($values = fgetcsv($handle)) !== false) {
            $line++;
            if (count(array_filter($values, fn ($value) => trim((string) $value) !== '')) === 0) continue;
            if (count($rows) >= self::MAX_ROWS) { $errors[] = 'CSV files may contain at most '.self::MAX_ROWS.' rows.'; break; }
            if (count($values) !== count(self::HEADERS)) { $errors[] = "Row {$line}: expected ".count(self::HEADERS).' columns.'; continue; }
            $row = array_combine(self::HEADERS, array_map(fn ($value) => trim((string) $value), $values));
            $rowErrors = [];
            foreach (['product_code', 'unit_name', 'unit_code', 'conversion_factor', 'is_base', 'is_default_selling', 'is_active', 'price_type', 'price'] as $required) {
                if ($row[$required] === '') $rowErrors[] = str_replace('_', ' ', $required).' is required';
            }
            if (mb_strlen($row['unit_name']) > 80) $rowErrors[] = 'unit name is too long';
            if (mb_strlen($row['unit_code']) > 30) $rowErrors[] = 'unit code is too long';
            if (! is_numeric($row['conversion_factor']) || (float) $row['conversion_factor'] <= 0) $rowErrors[] = 'conversion factor must be greater than zero';
            if (! is_numeric($row['price']) || (float) $row['price'] < 0) $rowErrors[] = 'price must be zero or greater';
            foreach (['is_base', 'is_default_selling', 'is_active'] as $boolean) {
                $parsed = $this->boolean($row[$boolean]);
                if ($parsed === null) $rowErrors[] = str_replace('_', ' ', $boolean).' must be yes or no';
                else $row[$boolean] = $parsed;
            }
            if (is_bool($row['is_base']) && $row['is_base'] && is_numeric($row['conversion_factor']) && abs((float) $row['conversion_factor'] - 1) > 0.000001) $rowErrors[] = 'base unit conversion factor must be 1';
            $row['price_type'] = Str::lower(Str::slug($row['price_type'], '_'));
            if ($row['price_type'] === '') $rowErrors[] = 'price type is invalid';
            if (mb_strlen($row['price_type']) > 60) $rowErrors[] = 'price type is too long';
            if ($rowErrors !== []) $errors[] = "Row {$line}: ".implode('; ', $rowErrors).'.';
            else { $row['_line'] = $line; $rows[] = $row; }
        }
        fclose($handle);
        if ($rows === [] && $errors === []) $errors[] = 'The CSV file has no data rows.';
        if ($errors !== []) throw ValidationException::withMessages(['unit_price_file' => implode("\n", $errors)]);
        return $rows;
    }

    private function planProduct(Product $product, array $rows): array
    {
        $errors = [];
        $existingNames = $product->units->mapWithKeys(
            fn ($unit) => [$this->unitIdentity($unit->name) => $unit]
        );
        $existingCodes = $product->units->mapWithKeys(
            fn ($unit) => [$this->unitIdentity($unit->code) => $unit]
        );
        $units = [];
        $prices = [];
        $seenPrices = [];
        $types = $product->priceTypes->pluck('name')->all();

        foreach ($rows as $row) {
            $nameKey = $this->unitIdentity($row['unit_name']);
            $codeKey = $this->unitIdentity($row['unit_code']);
            $nameMatch = $existingNames->get($nameKey);
            $codeMatch = $existingCodes->get($codeKey);

            if (($nameMatch && ! $codeMatch) || (! $nameMatch && $codeMatch)) {
                $matchedField = $nameMatch ? 'name' : 'code';
                $errors[] = "Row {$row['_line']}: unit {$matchedField} matches an existing unit, but name and code must both match that unit.";
                continue;
            }
            if ($nameMatch && $codeMatch && $nameMatch->id !== $codeMatch->id) {
                $errors[] = "Row {$row['_line']}: unit name and code match different existing units.";
                continue;
            }

            $unitId = $nameMatch?->id;
            $unitKey = $unitId ? 'id:'.$unitId : 'new:'.$nameKey.'|'.$codeKey;
            $definition = ['id' => $unitId, 'name' => $row['unit_name'], 'code' => $row['unit_code'], 'conversion_factor' => $row['is_base'] ? 1 : (float) $row['conversion_factor'], 'is_base' => $row['is_base'], 'is_default_selling' => $row['is_default_selling'], 'is_active' => $row['is_active']];
            if (isset($units[$unitKey]) && $units[$unitKey] !== $definition) $errors[] = "Row {$row['_line']}: repeated unit details are inconsistent.";
            $units[$unitKey] = $definition;
            $priceKey = $unitKey.'|'.$row['price_type'];
            if (isset($seenPrices[$priceKey])) $errors[] = "Row {$row['_line']}: duplicate unit and price type combination.";
            $seenPrices[$priceKey] = true;
            if (! in_array($row['price_type'], $types, true)) $types[] = $row['price_type'];
            $prices[] = ['unit_key' => $unitKey, 'price_type' => $row['price_type'], 'price' => (float) $row['price']];
        }

        $finalUnits = $product->units->mapWithKeys(fn ($unit) => ['id:'.$unit->id => [
            'name' => $unit->name, 'code' => $unit->code,
            'is_base' => (bool) $unit->is_base,
            'is_default_selling' => (bool) $unit->is_default_selling,
        ]])->all();
        foreach ($units as $key => $unit) $finalUnits[$key] = $unit;
        if (collect($finalUnits)->where('is_base', true)->count() !== 1) $errors[] = "{$product->product_code}: the final unit set must have exactly one base unit.";
        if (collect($finalUnits)->where('is_default_selling', true)->count() !== 1) $errors[] = "{$product->product_code}: the final unit set must have exactly one default selling unit.";
        if (collect($finalUnits)->pluck('name')->map(fn ($name) => Str::lower(trim($name)))->duplicates()->isNotEmpty()) $errors[] = "{$product->product_code}: unit names must be unique.";
        if (collect($finalUnits)->pluck('code')->map(fn ($code) => Str::lower(trim($code)))->duplicates()->isNotEmpty()) $errors[] = "{$product->product_code}: unit codes must be unique.";

        foreach (array_keys($finalUnits) as $unitKey) {
            foreach ($types as $type) {
                if (! isset($seenPrices[$unitKey.'|'.$type])) $errors[] = "{$product->product_code}: missing {$type} price row for unit {$unitKey}.";
            }
        }
        if (! in_array('retail', $types, true)) $errors[] = "{$product->product_code}: retail price type is required.";
        if ($errors !== []) throw ValidationException::withMessages(['unit_price_file' => implode("\n", array_unique($errors))]);

        return ['units' => $units, 'types' => array_values($types), 'prices' => $prices];
    }

    private function boolean(string $value): ?bool
    {
        return match (Str::lower(trim($value))) {
            'yes', 'true', '1' => true,
            'no', 'false', '0' => false,
            default => null,
        };
    }

    private function unitIdentity(string $value): string
    {
        return Str::lower(trim($value));
    }
}
