<?php

namespace App\Services;

use App\Models\{Product, ProductPriceType, ProductUnitPrice, PricingRule};
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AutomaticPricingService
{
    public const MAX_PRICE = '999999999999.99';

    /** All catalog-pricing mutations acquire this lock before product locks. */
    public function lock(): int
    {
        return (int) DB::table('pricing_states')->where('id', 1)->lockForUpdate()->value('version');
    }

    public function changed(): void
    {
        DB::table('pricing_states')->where('id', 1)->increment('version');
    }

    public function belowCostWarnings(Product $product): array
    {
        $cost = $this->readCost($product);
        $warnings = [];
        foreach ($product->units()->with('prices')->get() as $unit) {
            foreach ($unit->prices as $price) {
                if ($price->is_manual && bccomp((string) $price->price, '0', 2) > 0 && bccomp((string) $price->price, bcmul($cost, (string) $unit->conversion_factor, 6), 6) < 0) {
                    $warnings[] = $product->name.' / '.$unit->name.' / '.$price->price_type.' is below buying cost.';
                }
            }
        }
        return $warnings;
    }

    /** Decimal only; ceil after choosing the larger floor, never binary floats. */
    public function calculate(string $cost, array $rule, string $factor = '1'): ?string
    {
        if (bccomp($cost, '0', 6) <= 0) return null;
        $markup = bcmul($cost, bcadd('1', bcdiv((string) $rule['markup_percent'], '100', 10), 10), 12);
        $floor = bcadd($cost, (string) $rule['minimum_profit'], 12);
        $candidate = bccomp($markup, $floor, 12) >= 0 ? $markup : $floor;
        $increment = (string) $rule['rounding'];
        $steps = bcdiv($candidate, $increment, 0);
        if (bccomp(bcmul($steps, $increment, 12), $candidate, 12) < 0) $steps = bcadd($steps, '1', 0);
        $unitAmount = bcmul(bcmul($steps, $increment, 12), $factor, 12);
        $cents = bcmul($unitAmount, '100', 12);
        $whole = bcdiv($cents, '1', 0);
        if (bccomp($whole, $cents, 12) < 0) $whole = bcadd($whole, '1', 0);
        $amount = bcdiv($whole, '100', 2);
        if (bccomp($amount, self::MAX_PRICE, 2) > 0) {
            throw ValidationException::withMessages(['pricing' => 'Calculated selling price exceeds the supported amount. Reduce cost, conversion or markup.']);
        }
        return $amount;
    }

    public function effectiveCost(string $paid, string $free, string $factor, string $unitCost): string
    {
        if (bccomp($paid, '0', 4) <= 0 || bccomp($factor, '0', 6) <= 0 || bccomp($free, '0', 4) < 0 || bccomp($unitCost, '0', 2) < 0) {
            throw ValidationException::withMessages(['items' => 'Paid quantity and conversion must be positive; free quantity and cost cannot be negative.']);
        }
        $total = bcmul($paid, $unitCost, 6);
        $quantity = bcmul(bcadd($paid, $free, 4), $factor, 10);
        $cost = bcadd(bcdiv($total, $quantity, 12), '0.0000005', 6);
        if (bccomp($cost, '999999999999.999999', 6) > 0) throw ValidationException::withMessages(['items' => 'Effective buying cost exceeds the supported amount.']);
        return $cost;
    }

    public function resolveCost(Product $product): string
    {
        $line = $this->latestLine($product);
        $cost = $line ? $this->effectiveCost((string) $line->received_quantity, (string) $line->free_quantity, (string) $line->conversion_factor, (string) $line->unit_cost)
            : (string) ($product->pricing_base_cost ?? $product->original_price ?? '0');
        $product->forceFill(['pricing_base_cost' => $product->pricing_base_cost ?? $product->original_price, 'pricing_buying_cost' => $cost,
            'pricing_source_receipt_id' => $line?->stock_receipt_id])->save();
        return $cost;
    }

    /** Caller holds the pricing lock; no completed order/item is ever changed. */
    public function refreshProduct(Product $product, string $trigger, ?int $actorId = null, ?string $operation = null, ?PricingRule $onlyRule = null, bool $enroll = false): array
    {
        $product = Product::query()->lockForUpdate()->findOrFail($product->id);
        $cost = $this->resolveCost($product);
        $operation ??= $trigger.':'.bin2hex(random_bytes(12));
        $units = $product->units()->get();
        if ($enroll && $onlyRule) {
            $type = $product->priceTypes()->firstOrCreate(['name' => $onlyRule->code], ['is_default' => $onlyRule->code === 'retail', 'pricing_rule_id' => $onlyRule->id]);
            $type->update(['pricing_rule_id' => $onlyRule->id]);
            foreach ($units->where('is_active', true) as $unit) {
                $row = $unit->prices()->firstOrCreate(['product_price_type_id' => $type->id], ['price' => 0]);
                $row->update(['is_manual' => false]);
            }
        }
        $changes = [];
        $skipped = 0;
        foreach ($product->priceTypes()->with('unitPrices')->get() as $type) {
            $rule = $type->pricingRule ?: PricingRule::where('code', $type->name)->first();
            if (! $rule || ($onlyRule && $rule->id !== $onlyRule->id)) continue;
            if (! $type->pricing_rule_id) $type->update(['pricing_rule_id' => $rule->id]);
            foreach ($type->unitPrices as $price) {
                if ($rule->pricing_mode === 'manual') {
                    $price->update(['is_manual' => true, 'calculation_status' => 'manual']);
                    continue;
                }
                if ($price->is_manual) continue;
                $unit = $units->firstWhere('id', $price->product_unit_id);
                if (! $unit) continue;
                $amount = $this->calculate($cost, $rule->toArray(), (string) $unit->conversion_factor);
                if ($amount === null) {
                    $price->update(['calculation_status' => 'cost_required', 'applied_rule_version' => $rule->version]);
                    $skipped++;
                    continue;
                }
                $old = (string) $price->price;
                $price->update(['price' => $amount, 'calculation_status' => 'calculated', 'applied_rule_version' => $rule->version]);
                if (bccomp($old, $amount, 2) === 0) continue;
                $change = ['product_id' => $product->id, 'product_unit_id' => $unit->id, 'pricing_rule_id' => $rule->id,
                    'old_price' => $old, 'new_price' => $amount, 'cost_used' => $cost,
                    'rule_snapshot' => json_encode($rule->toArray()), 'trigger' => $trigger, 'actor_id' => $actorId,
                    'operation_id' => $operation, 'created_at' => now(), 'updated_at' => now()];
                DB::table('price_changes')->insert($change);
                $changes[] = array_merge($change, ['product_name' => $product->name, 'price_type' => $rule->name, 'unit_name' => $unit->name]);
            }
        }
        $product->increment('pricing_version');
        $this->changed();
        return ['price_changes' => $changes, 'changed_row_count' => count($changes), 'skipped_cost_count' => $skipped, 'operation_id' => $operation];
    }

    public function bulkPreview(array $values, ?PricingRule $rule = null): array
    {
        $version = $this->lock();
        $counts = ['active_products' => 0, 'automatic_rows' => 0, 'manual_overrides' => 0, 'missing_rows' => 0, 'products_without_cost' => 0];
        $examples = [];
        $scope = [];
        $code = $rule?->code ?? $this->codeForName($values['name']);
        foreach (Product::where('status', 'active')->where('is_active', true)->with(['units.prices', 'priceTypes'])->orderBy('id')->get() as $product) {
            $counts['active_products']++;
            $cost = $this->readCost($product);
            if (bccomp($cost, '0', 6) <= 0) $counts['products_without_cost']++;
            $type = $product->priceTypes->firstWhere('name', $code);
            foreach ($product->units->where('is_active', true) as $unit) {
                $price = $type ? $unit->prices->firstWhere('product_price_type_id', $type->id) : null;
                $counts[$price ? ($price->is_manual ? 'manual_overrides' : 'automatic_rows') : 'missing_rows']++;
                $new = $this->calculate($cost, $values, (string) $unit->conversion_factor);
                $scope[] = [$product->id, $product->pricing_version, $unit->id, $unit->conversion_factor, $price?->price, $price?->is_manual, $cost];
                if (count($examples) < 30) $examples[] = ['product' => $product->name, 'unit' => $unit->name, 'old_price' => $price?->price, 'new_price' => $new, 'cost' => $cost];
            }
        }
        $token = hash_hmac('sha256', json_encode([$version, $rule?->id, $rule?->version, $values, $scope]), (string) config('app.key'));
        return array_merge($counts, ['token' => $token, 'examples' => $examples]);
    }

    public function readCost(Product $product): string
    {
        $line = $this->latestLine($product);
        return $line ? $this->effectiveCost((string) $line->received_quantity, (string) $line->free_quantity, (string) $line->conversion_factor, (string) $line->unit_cost)
            : (string) ($product->pricing_base_cost ?? $product->original_price ?? '0');
    }

    public function latestLine(Product $product): ?object
    {
        return DB::table('stock_receipt_items as items')->join('stock_receipts as receipts', 'receipts.id', '=', 'items.stock_receipt_id')
            ->where('items.product_id', $product->id)->where('receipts.status', 'posted')->whereNotNull('items.unit_cost')
            ->orderByDesc('receipts.created_at')->orderByDesc('receipts.id')->orderByDesc('items.id')->first(['items.*']);
    }

    public function codeForName(string $name): string
    {
        $code = substr(\Illuminate\Support\Str::slug($name, '_'), 0, 50) ?: 'price_'.substr(hash('sha256', $name), 0, 12);
        $candidate = $code;
        $suffix = 2;
        while (PricingRule::where('code', $candidate)->exists()) $candidate = substr($code, 0, 50).'_'.$suffix++;
        return $candidate;
    }

    public function applyRule(PricingRule $rule, bool $bulk, ?int $actorId): array
    {
        $operation = 'rule:'.$rule->id.':v'.$rule->version;
        $changes = []; $skipped = 0;
        // Existing auto rows on inactive products still follow rule edits; only
        // active products are newly enrolled by the explicit bulk command.
        foreach (Product::orderBy('id')->get() as $product) {
            $enroll = $bulk && $product->status === 'active' && $product->is_active;
            if (! $enroll && ! $product->priceTypes()->where('name', $rule->code)->exists()) continue;
            $result = $this->refreshProduct($product, 'rule_save', $actorId, $operation, $rule, $enroll);
            $changes = array_merge($changes, $result['price_changes']);
            $skipped += $result['skipped_cost_count'];
        }
        return ['price_changes' => $changes, 'changed_row_count' => count($changes), 'skipped_cost_count' => $skipped, 'operation_id' => $operation, 'rule_version' => $rule->version];
    }
}
