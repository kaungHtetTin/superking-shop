<?php

namespace Tests\Feature;

use App\Models\{Category, FinancialEntry, Location, PricingRule, Product, User};
use App\Services\AutomaticPricingService;
use App\Services\Inventory\StockReceiptService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class AutomaticPricingTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(bool $manual = false, string $cost = '1000'): array
    {
        $actor = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $category = Category::create(['name' => 'Pricing', 'slug' => 'pricing', 'is_active' => true]);
        $product = Product::create(['category_id' => $category->id, 'name' => 'Guitar', 'slug' => 'pricing-guitar', 'original_price' => $cost, 'pricing_base_cost' => $cost, 'min_quantity' => 0, 'status' => 'active', 'is_active' => true]);
        $unit = $product->units()->create(['name' => 'Piece', 'code' => 'pc', 'conversion_factor' => 1, 'is_base' => true, 'is_default_selling' => true, 'is_active' => true]);
        $rule = PricingRule::where('code', 'retail')->firstOrFail();
        $rule->update(['pricing_mode' => 'automatic', 'markup_percent' => '20', 'rounding' => 50, 'minimum_profit' => 100]);
        $type = $product->priceTypes()->create(['name' => 'retail', 'is_default' => true, 'pricing_rule_id' => $rule->id]);
        $price = $unit->prices()->create(['product_price_type_id' => $type->id, 'price' => 777, 'is_manual' => $manual]);
        $location = Location::create(['name' => 'Pricing store', 'code' => 'PRICING', 'type' => 'warehouse', 'is_active' => true, 'timezone' => 'Asia/Rangoon']);
        return [$actor, $product, $unit, $price, $rule, $location];
    }

    private function refresh(Product $product): array
    {
        return DB::transaction(function () use ($product) { $service = app(AutomaticPricingService::class); $service->lock(); return $service->refreshProduct($product, 'test'); });
    }

    public function test_decimal_formula_acceptance_examples_and_foc_cost(): void
    {
        $service = app(AutomaticPricingService::class);
        foreach ([['950',20,100,50,'1150.00'],['1000',10,300,100,'1300.00'],['1000',20,0,100,'1200.00'],['1050',0,0,100,'1100.00'],['0.1',0,0,1,'1.00']] as [$cost,$markup,$profit,$round,$expected]) {
            $this->assertSame($expected, $service->calculate($cost, ['markup_percent'=>$markup,'minimum_profit'=>$profit,'rounding'=>$round]));
        }
        $this->assertSame('8.333333', $service->effectiveCost('10','2','10','100'));
        $this->assertNull($service->calculate('0', ['markup_percent'=>20,'minimum_profit'=>0,'rounding'=>1]));
    }

    public function test_pricing_list_and_editor_are_part_of_main_settings(): void
    {
        [$actor, , , , $rule] = $this->fixture();
        $this->actingAs($actor)->getJson('/admin/settings?section=prices')
            ->assertOk()->assertJsonPath('component', 'Admin/Settings/Edit')
            ->assertJsonPath('props.initialSection', 'prices')
            ->assertJsonPath('props.pricing.rules.data.0.id', $rule->id);
        $this->getJson('/admin/settings?section=prices&price_action=edit&rule_id='.$rule->id)
            ->assertOk()->assertJsonPath('component', 'Admin/Settings/Edit')
            ->assertJsonPath('props.pricingRule.id', $rule->id);
        $this->get('/admin/settings/prices')->assertRedirect('/admin/settings?section=prices&q=&page=1');
        $this->get('/admin/settings/prices/'.$rule->id.'/edit')->assertRedirect('/admin/settings?section=prices&price_action=edit&rule_id='.$rule->id);
    }

    public function test_pricing_mutations_redirect_with_get_to_settings(): void
    {
        [$actor, , , , $rule] = $this->fixture();
        $this->actingAs($actor);
        $values = ['name' => 'Retail', 'pricing_mode' => 'automatic', 'markup_percent' => 50, 'rounding' => 1, 'minimum_profit' => 500, 'version' => $rule->version, 'return_q' => 'Retail', 'return_page' => 2];
        $response = $this->patchJson('/admin/settings/prices/'.$rule->id, $values);
        $response->assertStatus(303)->assertRedirect('/admin/settings?section=prices&q=Retail&page=2');
        $this->assertSame('50.0000', $rule->fresh()->markup_percent);
        $this->getJson($response->headers->get('Location'))->assertOk()
            ->assertJsonPath('props.initialSection', 'prices')->assertJsonPath('props.pricingAction', null);

        $values['name'] = 'Special';
        $values['pricing_mode'] = 'manual';
        $this->postJson('/admin/settings/prices', $values)->assertStatus(303)
            ->assertRedirect('/admin/settings?section=prices&q=Retail&page=2');
        $unused = PricingRule::where('name', 'Special')->firstOrFail();
        $this->deleteJson('/admin/settings/prices/'.$unused->id.'?return_q=Retail&return_page=2')
            ->assertStatus(303)->assertRedirect('/admin/settings?section=prices&q=Retail&page=2');
        $this->assertDatabaseMissing('pricing_rules', ['id' => $unused->id]);
    }

    public function test_auto_recalculation_is_idempotent_and_manual_override_is_preserved(): void
    {
        [, $product, , $price] = $this->fixture();
        $this->assertSame(1, $this->refresh($product)['changed_row_count']);
        $this->assertSame('1200.00', $price->fresh()->price);
        $this->assertSame(0, $this->refresh($product)['changed_row_count']);
        $this->assertDatabaseCount('price_changes', 1);
        $price->update(['is_manual'=>true,'price'=>555]);
        $this->refresh($product);
        $this->assertSame('555.00', $price->fresh()->price);
    }

    public function test_missing_cost_retains_saved_price_and_blocks_new_zero_auto_row(): void
    {
        [, $product, $unit, $price] = $this->fixture(false, '0');
        $this->assertSame(1, $this->refresh($product)['skipped_cost_count']);
        $this->assertSame('777.00', $price->fresh()->price);
        $price->update(['price'=>0]);
        $this->assertNull($unit->fresh()->priceFor('retail'));
        $product->update(['pricing_base_cost'=>1000]);
        $this->refresh($product);
        $this->assertNotNull($unit->fresh()->priceFor('retail'));
    }

    public function test_rule_modes_and_bulk_application_require_explicit_review(): void
    {
        [$actor,$product,,$price,$rule] = $this->fixture(true);
        $values = ['name'=>'Retail','pricing_mode'=>'automatic','markup_percent'=>'30','rounding'=>'50','minimum_profit'=>'0','version'=>1];
        $url = '/admin/settings/prices/'.$rule->id;
        $this->actingAs($actor)->patchJson($url,$values)->assertRedirect();
        $this->assertSame('777.00',$price->fresh()->price);
        $values['version']=2;
        $values['apply_to_existing']=true;
        $this->patchJson($url,$values)->assertStatus(409);
        $preview=$this->postJson('/admin/settings/prices/preview',array_merge($values,['rule_id'=>$rule->id]))->assertOk()->json();
        $this->assertSame(1,$preview['manual_overrides']);
        $this->patchJson($url,array_merge($values,['preview_token'=>$preview['token']]))->assertRedirect();
        $this->assertFalse($price->fresh()->is_manual);
        $this->assertSame('1300.00',$price->fresh()->price);
        $values['version']=3; $values['pricing_mode']='manual'; $values['apply_to_existing']=false;
        $this->patchJson($url,$values)->assertRedirect();
        $this->assertTrue($price->fresh()->is_manual);
        $this->assertSame('1300.00',$price->fresh()->price);
    }

    public function test_bulk_preview_rejects_cost_changes_after_review(): void
    {
        [$actor,$product,,,$rule] = $this->fixture(true);
        $values=['name'=>'Retail','pricing_mode'=>'automatic','markup_percent'=>'20','rounding'=>'50','minimum_profit'=>'100','version'=>1,'rule_id'=>$rule->id];
        $preview=$this->actingAs($actor)->postJson('/admin/settings/prices/preview',$values)->assertOk()->json();
        $product->update(['pricing_base_cost'=>2000]);
        $this->patchJson('/admin/settings/prices/'.$rule->id,array_merge($values,['apply_to_existing'=>true,'preview_token'=>$preview['token']]))->assertStatus(409);
    }

    public function test_purchase_foc_updates_latest_cost_and_selling_price_without_changing_finance_basis(): void
    {
        [$actor,$product,$unit,$price,,$location] = $this->fixture();
        $service=app(StockReceiptService::class);
        $receipt=$service->createDraft($location,[['product_unit_id'=>$unit->id,'received_quantity'=>10,'free_quantity'=>2,'unit_cost'=>1200]],$actor);
        $posted=$service->post($receipt,$actor);
        $this->assertSame('1000.000000',$product->fresh()->pricing_buying_cost);
        $this->assertSame('1200.00',$price->fresh()->price);
        $this->assertDatabaseHas('inventory_balances',['product_id'=>$product->id,'on_hand_qty'=>12]);
        $this->assertDatabaseHas('financial_entries',['reference'=>$receipt->receipt_number,'amount'=>12000]);
        $this->assertSame(1,$posted->pricing_summary['changed_row_count']);
        $service->delete($receipt,$actor);
        $this->assertNull($product->fresh()->pricing_source_receipt_id);
        $this->assertSame('1000.000000',$product->fresh()->pricing_buying_cost);
        $this->assertSame('1000.00',$product->fresh()->original_price);
    }

    public function test_below_cost_purchase_requires_acknowledgment_and_rolls_back_inventory(): void
    {
        [$actor,$product,$unit,$price,,$location]=$this->fixture(true);
        $service=app(StockReceiptService::class);
        $receipt=$service->createDraft($location,[['product_unit_id'=>$unit->id,'received_quantity'=>1,'unit_cost'=>2000]],$actor);
        try { $service->post($receipt,$actor); $this->fail('Expected warning'); }
        catch (ValidationException $exception) { $this->assertArrayHasKey('acknowledge_below_cost',$exception->errors()); }
        $this->assertSame('draft',$receipt->fresh()->status);
        $this->assertDatabaseMissing('inventory_balances',['product_id'=>$product->id]);
        $service->post($receipt,$actor,true);
        $this->assertSame('777.00',$price->fresh()->price);
    }

    public function test_older_receipt_posting_does_not_replace_latest_created_purchase_cost(): void
    {
        [$actor,$product,$unit,,,$location]=$this->fixture();
        $service=app(StockReceiptService::class);
        $old=$service->createDraft($location,[['product_unit_id'=>$unit->id,'received_quantity'=>1,'unit_cost'=>100]],$actor);
        $new=$service->createDraft($location,[['product_unit_id'=>$unit->id,'received_quantity'=>1,'unit_cost'=>200]],$actor);
        $service->post($new,$actor);
        $service->post($old,$actor);
        $this->assertSame('200.000000',$product->fresh()->pricing_buying_cost);
        $this->assertSame($new->id,$product->fresh()->pricing_source_receipt_id);
    }

    public function test_permission_validation_and_delete_guards(): void
    {
        [$actor,,,,$rule]=$this->fixture();
        $this->actingAs($actor)->deleteJson('/admin/settings/prices/'.$rule->id)->assertStatus(409);
        $values=['name'=>'Bad/name','pricing_mode'=>'automatic','markup_percent'=>'1001','rounding'=>'0','minimum_profit'=>'-1'];
        $this->postJson('/admin/settings/prices',$values)->assertUnprocessable()->assertJsonValidationErrors(['name','markup_percent','rounding','minimum_profit']);
        $values=['name'=>' retail ','pricing_mode'=>'manual','markup_percent'=>'0','rounding'=>'1','minimum_profit'=>'0'];
        $this->postJson('/admin/settings/prices',$values)->assertUnprocessable()->assertJsonValidationErrors('name');
        $staff=User::factory()->create(['role'=>'customer']);
        $this->actingAs($staff)->postJson('/admin/settings/prices/preview',$values)->assertForbidden();
    }

    public function test_rule_rename_preserves_compatibility_key_and_product_type_id(): void
    {
        [$actor,$product,,$price,$rule]=$this->fixture();
        $this->actingAs($actor)->patchJson('/admin/settings/prices/'.$rule->id,['name'=>'Standard','pricing_mode'=>'automatic','markup_percent'=>'20','rounding'=>'50','minimum_profit'=>'100','version'=>1])->assertRedirect();
        $this->assertSame('retail',$rule->fresh()->code);
        $this->assertSame($price->product_price_type_id,$price->fresh()->product_price_type_id);
        $this->assertSame('retail',$price->fresh()->price_type);
    }

    public function test_product_create_ignores_client_auto_amount_and_edit_preserves_stable_rows(): void
    {
        [$actor,$existing] = $this->fixture();
        $payload = ['category_id'=>$existing->category_id,'name'=>'New auto product','original_price'=>950,'min_quantity'=>0,'status'=>'active',
            'units'=>[['name'=>'Piece','code'=>'pc','conversion_factor'=>1,'is_base'=>true,'is_default_selling'=>true,'is_active'=>true]],
            'price_types'=>[['name'=>'retail','prices'=>[1],'is_manual'=>[false]]]];
        $this->actingAs($actor)->postJson('/admin/products',$payload)->assertRedirect();
        $product=Product::where('name','New auto product')->firstOrFail();
        $price=$product->units->first()->prices->first();
        $this->assertSame('1150.00',$price->price);
        $this->assertFalse($price->is_manual);
        $payload['units'][0]['id']=$product->units->first()->id;
        $payload['price_types'][0]['id']=$price->product_price_type_id;
        $payload['price_types'][0]['is_manual']=[true];
        $payload['price_types'][0]['prices']=[888];
        $payload['pricing_version']=$product->pricing_version;
        $this->patchJson('/admin/products/'.$product->id, array_merge($payload, ['original_price' => 123]))->assertStatus(422)->assertJsonValidationErrors('original_price');
        $this->assertSame('950.00', $product->fresh()->original_price);
        $this->patchJson('/admin/products/'.$product->id,$payload)->assertRedirect();
        $this->assertSame('888.00',$price->fresh()->price);
        $this->assertTrue($price->fresh()->is_manual);
        $this->patchJson('/admin/products/'.$product->id,$payload)->assertStatus(409);
        $payload['pricing_version']=$product->fresh()->pricing_version;
        $payload['price_types'][0]['is_manual']=[false];
        $payload['price_types'][0]['prices']=[1];
        $this->patchJson('/admin/products/'.$product->id,$payload)->assertRedirect();
        $this->assertSame('1150.00',$price->fresh()->price);
    }

    public function test_new_rule_bulk_adds_active_missing_rows_but_not_inactive_products(): void
    {
        [$actor,$product] = $this->fixture();
        $inactive=$product->replicate(); $inactive->slug='inactive-guitar'; $inactive->product_code=null; $inactive->status='inactive'; $inactive->is_active=false; $inactive->save();
        $inactive->units()->create(['name'=>'Piece','code'=>'pc','conversion_factor'=>1,'is_base'=>true,'is_default_selling'=>true,'is_active'=>true]);
        $values=['name'=>'Wholesale','pricing_mode'=>'automatic','markup_percent'=>10,'rounding'=>50,'minimum_profit'=>0];
        $preview=$this->actingAs($actor)->postJson('/admin/settings/prices/preview',$values)->assertOk()->json();
        $this->assertSame(1,$preview['missing_rows']);
        $this->postJson('/admin/settings/prices',array_merge($values,['apply_to_existing'=>true,'preview_token'=>$preview['token']]))->assertRedirect();
        $this->assertDatabaseHas('product_price_types',['product_id'=>$product->id,'name'=>'wholesale']);
        $this->assertDatabaseMissing('product_price_types',['product_id'=>$inactive->id,'name'=>'wholesale']);
        $type=$product->priceTypes()->where('name','wholesale')->first();
        $this->assertSame('1100.00',$type->unitPrices->first()->price);
        $this->assertSame(1,(int) $type->unitPrices->first()->applied_rule_version);
    }

    public function test_rule_edit_updates_inactive_auto_units_and_converts_base_price(): void
    {
        [$actor,$product,$unit,$price,$rule] = $this->fixture();
        $product->update(['is_active'=>false,'status'=>'inactive']);
        $unit->update(['is_active'=>false]);
        $box=$product->units()->create(['name'=>'Box','code'=>'box','conversion_factor'=>12,'is_base'=>false,'is_active'=>true]);
        $boxPrice=$box->prices()->create(['product_price_type_id'=>$price->product_price_type_id,'price'=>0,'is_manual'=>false]);
        $this->actingAs($actor)->patchJson('/admin/settings/prices/'.$rule->id,['name'=>'Retail','pricing_mode'=>'automatic','markup_percent'=>20,'rounding'=>50,'minimum_profit'=>0,'version'=>1])->assertRedirect();
        $this->assertSame('1200.00',$price->fresh()->price);
        $this->assertSame('14400.00',$boxPrice->fresh()->price);
    }

    public function test_oversized_calculation_rolls_back_rule_and_all_prices(): void
    {
        [$actor,$product,,$price,$rule] = $this->fixture();
        $product->update(['pricing_base_cost'=>'999999999999']);
        $this->actingAs($actor)->patchJson('/admin/settings/prices/'.$rule->id,['name'=>'Retail','pricing_mode'=>'automatic','markup_percent'=>1000,'rounding'=>100,'minimum_profit'=>0,'version'=>1])->assertUnprocessable()->assertJsonValidationErrors('pricing');
        $this->assertSame(1,$rule->fresh()->version);
        $this->assertSame('777.00',$price->fresh()->price);
        $this->assertDatabaseCount('price_changes',0);
    }

    public function test_pos_price_refresh_returns_zero_for_unavailable_auto_prices_and_manual_flags_in_purchase_search(): void
    {
        [$actor,$product,$unit,$price,,$location] = $this->fixture(false,'0');
        $price->update(['price'=>0]); $this->refresh($product);
        $this->actingAs($actor)->getJson('/admin/pos/products/prices?unit_ids[]='.$unit->id)->assertOk()->assertJsonPath('0.prices.0.price',0);
        $response=$this->getJson('/admin/inventory/products/search?location_id='.$location->id.'&q=Guitar')->assertOk();
        $this->assertFalse($response->json('0.prices.0.is_manual'));
    }
}
