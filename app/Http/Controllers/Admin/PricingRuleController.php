<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\{PricingRule, ProductPriceType};
use App\Services\{AutomaticPricingService, AuditLogService};
use App\Support\Spa;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PricingRuleController extends Controller
{
    public function index(Request $request)
    {
        return redirect()->route('admin.settings.edit', ['section' => 'prices', 'q' => $request->query('q', ''), 'page' => max(1, $request->integer('page', 1))]);
    }

    public function settingsData(Request $request): array
    {
        return [
            'rules' => PricingRule::query()->when($request->filled('q'), fn ($q) => $q->where('name', 'like', '%'.$request->string('q').'%'))
                ->orderBy('id')->paginate(20)->appends(['section' => 'prices', 'q' => $request->query('q', '')])->through(fn ($rule) => array_merge($rule->toArray(), $this->usage($rule))),
            'filters' => ['q' => $request->string('q')->toString()],
        ];
    }

    private function usage(PricingRule $rule): array
    {
        $count = ProductPriceType::where('name', $rule->code)->whereHas('product', fn ($q) => $q->where('status', 'active')->where('is_active', true))->count();
        $reason = $count ? 'Used by active products, including zero-priced rows.' : ($rule->code === 'retail' ? 'Retail is the required primary price type.' : (PricingRule::count() <= 1 ? 'At least one price type is required.' : null));
        return ['active_product_count' => $count, 'delete_disabled_reason' => $reason];
    }

    public function create(Request $request) { return redirect()->route('admin.settings.edit', array_merge($request->only('return_q', 'return_page'), ['section' => 'prices', 'price_action' => 'create'])); }
    public function edit(Request $request, PricingRule $rule) { return redirect()->route('admin.settings.edit', array_merge($request->only('return_q', 'return_page'), ['section' => 'prices', 'price_action' => 'edit', 'rule_id' => $rule->id])); }

    private function values(Request $request, ?PricingRule $rule): array
    {
        $request->merge(['name' => trim((string) $request->input('name'))]);
        $values = $request->validate([
            'name' => ['required', 'string', 'max:50', 'not_regex:~[,/\\\\]~', Rule::unique('pricing_rules', 'name')->ignore($rule?->id)],
            'pricing_mode' => ['required', Rule::in(['manual', 'automatic'])],
            'markup_percent' => ['required', 'numeric', 'between:0,1000', 'regex:/^\d+(\.\d{1,4})?$/'],
            'rounding' => ['required', 'integer', 'between:1,100000'],
            'minimum_profit' => ['required', 'integer', 'between:0,99999999999'],
        ]);
        $values['markup_percent'] = bcadd((string) $values['markup_percent'], '0', 4);
        $values['rounding'] = (int) $values['rounding'];
        $values['minimum_profit'] = bcadd((string) $values['minimum_profit'], '0', 2);
        return $values;
    }

    public function preview(Request $request, AutomaticPricingService $pricing)
    {
        return DB::transaction(function () use ($request, $pricing) {
            $rule = $request->filled('rule_id') ? PricingRule::findOrFail($request->integer('rule_id')) : null;
            $values = $this->values($request, $rule);
            abort_unless($values['pricing_mode'] === 'automatic', 422, 'Bulk application requires Automatic mode.');
            return response()->json($pricing->bulkPreview($values, $rule));
        });
    }

    public function store(Request $request, AutomaticPricingService $pricing, AuditLogService $audit)
    {
        return $this->save($request, $pricing, $audit);
    }
    public function update(Request $request, PricingRule $rule, AutomaticPricingService $pricing, AuditLogService $audit)
    {
        return $this->save($request, $pricing, $audit, $rule);
    }

    private function save(Request $request, AutomaticPricingService $pricing, AuditLogService $audit, ?PricingRule $rule = null)
    {
        $result = DB::transaction(function () use ($request, $pricing, $audit, $rule) {
            $pricing->lock();
            $rule = $rule ? PricingRule::lockForUpdate()->findOrFail($rule->id) : null;
            if ($rule && (int) $request->input('version', 0) !== $rule->version) abort(409, 'This rule changed. Reload before saving.');
            $values = $this->values($request, $rule);
            $request->validate(['apply_to_existing' => ['sometimes', 'boolean'], 'preview_token' => ['nullable', 'string', 'size:64']]);
            $bulk = $request->boolean('apply_to_existing');
            if ($bulk) {
                if ($values['pricing_mode'] !== 'automatic') throw ValidationException::withMessages(['apply_to_existing' => 'Bulk application requires Automatic mode.']);
                $preview = $pricing->bulkPreview($values, $rule);
                if (! hash_equals($preview['token'], (string) $request->input('preview_token'))) abort(409, 'The pricing scope changed or was not reviewed. Review the bulk impact again.');
            }
            if ($rule) $rule->update(array_merge($values, ['version' => $rule->version + 1]));
            else {
                $code = $pricing->codeForName($values['name']);
                $rule = PricingRule::create(array_merge($values, ['code' => $code]));
            }
            $rule->refresh();
            $result = $pricing->applyRule($rule, $bulk, $request->user()->id);
            $pricing->changed();
            $audit->record('pricing.rule.saved', $rule, ['bulk_apply' => $bulk, 'changed_rows' => $result['changed_row_count'], 'version' => $rule->version], $request);
            return $result;
        }, 3);
        // A 303 makes fetch follow PATCH/DELETE mutations with GET, not the original method.
        return redirect()->route('admin.settings.edit', ['section' => 'prices', 'q' => $request->string('return_q')->toString(), 'page' => max(1, $request->integer('return_page', 1))], 303)->with('success', "Price type saved. {$result['changed_row_count']} automatic prices updated; {$result['skipped_cost_count']} rows need cost.");
    }

    public function destroy(Request $request, PricingRule $rule, AutomaticPricingService $pricing, AuditLogService $audit)
    {
        DB::transaction(function () use ($request, $rule, $pricing, $audit) {
            $pricing->lock();
            $rule = PricingRule::lockForUpdate()->findOrFail($rule->id);
            if ($reason = $this->usage($rule)['delete_disabled_reason']) abort(409, $reason);
            // Retain inactive product amounts, detached as local Manual prices.
            foreach (ProductPriceType::where('name', $rule->code)->get() as $type) $type->unitPrices()->update(['is_manual' => true, 'calculation_status' => 'manual']);
            $audit->record('pricing.rule.deleted', $rule, ['name' => $rule->name], $request);
            $rule->delete();
            $pricing->changed();
        }, 3);
        return redirect()->route('admin.settings.edit', ['section' => 'prices', 'q' => $request->string('return_q')->toString(), 'page' => max(1, $request->integer('return_page', 1))], 303)->with('success', 'Price type deleted.');
    }
}
