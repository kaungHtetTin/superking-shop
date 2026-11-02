<?php

namespace Tests\Feature;

use App\Models\{Category, CycleCount, FinancialEntry, InventoryBalance, InventoryMovement, Location, Permission, Product, Role, StockAdjustment, User};
use App\Services\Inventory\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CycleCountingTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $user = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $location = Location::create(['name' => 'Count warehouse', 'code' => 'CC-A', 'type' => 'warehouse', 'is_active' => true]);
        $other = Location::create(['name' => 'Other warehouse', 'code' => 'CC-B', 'type' => 'warehouse', 'is_active' => true]);
        $category = Category::create(['name' => 'Count products', 'slug' => 'count-products', 'is_active' => true]);
        $products = collect([10, 20, 30])->map(function ($cost, $index) use ($category, $location, $other) {
            $product = Product::create(['category_id' => $category->id, 'name' => 'Count product '.$index, 'slug' => 'count-product-'.$index,
                'original_price' => $cost, 'status' => 'active', 'is_active' => true]);
            $product->units()->create(['name' => 'Piece', 'code' => 'PC', 'conversion_factor' => 1, 'is_base' => true, 'is_default_selling' => true, 'is_active' => true]);
            app(InventoryService::class)->receive($location, $product, 10);
            app(InventoryService::class)->receive($other, $product, 50);
            return $product;
        });
        $this->actingAs($user);
        return [$user, $location, $other, $products];
    }

    private function start($user, $location, $products): CycleCount
    {
        $this->post('/admin/inventory/cycle-counts', ['location_id' => $location->id, 'product_ids' => $products->pluck('id')->all(), 'notes' => 'Weekly shelf count'])
            ->assertSessionHasNoErrors()->assertRedirect();
        return CycleCount::latest('id')->firstOrFail();
    }

    private function saveCounts(CycleCount $count, array $quantities): void
    {
        $this->put('/admin/inventory/cycle-counts/'.$count->id, ['revision' => $count->fresh()->revision, 'notes' => 'Weekly shelf count',
            'items' => $count->items()->orderBy('product_id')->get()->map(fn ($item, $index) => ['id' => $item->id, 'counted_quantity' => $quantities[$index], 'notes' => 'Shelf verified'])->all()])
            ->assertSessionHasNoErrors()->assertRedirect();
    }

    public function test_count_posts_only_selected_warehouse_variances_with_cost_and_audit_history(): void
    {
        [$user, $location, $other, $products] = $this->fixture();
        $count = $this->start($user, $location, $products);
        $this->assertNull($count->items->first()->counted_quantity);
        $this->saveCounts($count, [8, 12, 10]);
        $this->assertEquals(10, InventoryBalance::where('location_id', $location->id)->where('product_id', $products[0]->id)->value('on_hand_qty'));
        $this->getJson('/admin/inventory/cycle-counts/'.$count->id)->assertOk()
            ->assertJsonPath('props.count.items.0.stale', false);
        $this->get('/admin/inventory/cycle-counts/'.$count->id.'/export')->assertDownload($count->count_number.'.xlsx');
        $this->post('/admin/inventory/cycle-counts/'.$count->id.'/post', ['revision' => $count->fresh()->revision])->assertSessionHasNoErrors()->assertRedirect();
        $count->refresh();
        $this->assertSame('posted', $count->status);
        $this->assertEquals($user->id, $count->posted_by);
        $this->assertNotNull($count->posted_at);
        $this->assertCount(2, $count->adjustment->items);
        $this->assertEquals(-20, $count->adjustment->items->firstWhere('product_id', $products[0]->id)->value_delta);
        $this->assertEquals(40, $count->adjustment->items->firstWhere('product_id', $products[1]->id)->value_delta);
        $this->assertEquals([8, 12, 10], InventoryBalance::where('location_id', $location->id)->orderBy('product_id')->pluck('on_hand_qty')->map(fn ($value) => (int) $value)->all());
        $this->assertEquals([50, 50, 50], InventoryBalance::where('location_id', $other->id)->orderBy('product_id')->pluck('on_hand_qty')->map(fn ($value) => (int) $value)->all());
        $this->assertDatabaseHas('financial_entries', ['reference' => $count->adjustment->adjustment_number.':'.$count->adjustment->items[0]->id, 'type' => 'expense', 'amount' => 20]);
        $this->assertEquals(2, FinancialEntry::where('category', FinancialEntry::CATEGORY_STOCK_ADJUSTMENT)->count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'inventory.cycle_count.posted', 'subject_id' => $count->id]);
        $movements = InventoryMovement::count();
        $this->post('/admin/inventory/cycle-counts/'.$count->id.'/post', ['revision' => $count->revision])->assertSessionHasErrors('count');
        $this->putJson('/admin/inventory/cycle-counts/'.$count->id, ['revision' => $count->revision, 'items' => $count->items->map(fn ($item) => ['id' => $item->id, 'counted_quantity' => 0])->all()])->assertUnprocessable();
        $this->assertEquals($movements, InventoryMovement::count());
    }

    public function test_blank_counts_block_posting_and_explicit_zero_is_counted(): void
    {
        [$user, $location, , $products] = $this->fixture();
        $count = $this->start($user, $location, $products->take(1));
        $this->postJson('/admin/inventory/cycle-counts/'.$count->id.'/post', ['revision' => $count->revision])->assertUnprocessable()->assertJsonValidationErrors('count');
        $this->saveCounts($count, [0]);
        $this->post('/admin/inventory/cycle-counts/'.$count->id.'/post', ['revision' => $count->fresh()->revision])->assertSessionHasNoErrors();
        $this->assertEquals(0, InventoryBalance::where('location_id', $location->id)->where('product_id', $products[0]->id)->value('on_hand_qty'));
    }

    public function test_stock_activity_invalidates_count_even_when_quantity_returns_to_snapshot(): void
    {
        [$user, $location, , $products] = $this->fixture();
        $count = $this->start($user, $location, $products->take(1));
        $this->saveCounts($count, [9]);
        app(InventoryService::class)->completeSale($location, $products[0], 1);
        app(InventoryService::class)->returnSale($location, $products[0], 1);
        $this->getJson('/admin/inventory/cycle-counts/'.$count->id)->assertOk()->assertJsonPath('props.count.items.0.stale', true);
        $this->postJson('/admin/inventory/cycle-counts/'.$count->id.'/post', ['revision' => $count->fresh()->revision])->assertUnprocessable();
        $this->assertSame('draft', $count->fresh()->status);
        $this->assertEquals(0, StockAdjustment::count());
        $this->post('/admin/inventory/cycle-counts/'.$count->id.'/refresh', ['revision' => $count->fresh()->revision])->assertSessionHasNoErrors();
        $this->assertNull($count->items()->first()->counted_quantity);
        $this->saveCounts($count, [9]);
        $this->post('/admin/inventory/cycle-counts/'.$count->id.'/post', ['revision' => $count->fresh()->revision])->assertSessionHasNoErrors();
        $this->assertSame('posted', $count->fresh()->status);
    }

    public function test_cost_change_and_stale_editor_revision_are_rejected(): void
    {
        [$user, $location, , $products] = $this->fixture();
        $count = $this->start($user, $location, $products->take(1));
        $revision = $count->revision;
        $this->saveCounts($count, [9]);
        $this->postJson('/admin/inventory/cycle-counts/'.$count->id.'/cancel', ['revision' => $revision])->assertUnprocessable();
        $products[0]->update(['original_price' => 11]);
        $this->postJson('/admin/inventory/cycle-counts/'.$count->id.'/post', ['revision' => $count->fresh()->revision])->assertUnprocessable();
        $this->assertEquals(10, $count->items()->first()->base_cost);
        $this->assertSame('draft', $count->fresh()->status);
    }

    public function test_reserved_stock_failure_rolls_back_entire_count(): void
    {
        [$user, $location, , $products] = $this->fixture();
        app(InventoryService::class)->reserve($location, $products[1], 9);
        $count = $this->start($user, $location, $products->take(2));
        $this->saveCounts($count, [8, 7]);
        $this->postJson('/admin/inventory/cycle-counts/'.$count->id.'/post', ['revision' => $count->fresh()->revision])->assertUnprocessable();
        $this->assertEquals(0, StockAdjustment::count());
        $this->assertEquals(0, FinancialEntry::where('category', FinancialEntry::CATEGORY_STOCK_ADJUSTMENT)->count());
        $this->assertEquals(10, InventoryBalance::where('location_id', $location->id)->where('product_id', $products[0]->id)->value('on_hand_qty'));
    }

    public function test_matching_counts_post_without_stock_or_finance_changes_and_cancel_is_final(): void
    {
        [$user, $location, , $products] = $this->fixture();
        $count = $this->start($user, $location, $products->take(1));
        $this->saveCounts($count, [10]);
        $movements = InventoryMovement::count();
        $this->post('/admin/inventory/cycle-counts/'.$count->id.'/post', ['revision' => $count->fresh()->revision])->assertSessionHasNoErrors();
        $this->assertSame('posted', $count->fresh()->status);
        $this->assertNull($count->fresh()->stock_adjustment_id);
        $this->assertEquals($movements, InventoryMovement::count());
        $cancelled = $this->start($user, $location, $products->take(1));
        $this->post('/admin/inventory/cycle-counts/'.$cancelled->id.'/cancel', ['revision' => $cancelled->revision])->assertSessionHasNoErrors();
        $this->postJson('/admin/inventory/cycle-counts/'.$cancelled->id.'/refresh', ['revision' => $cancelled->fresh()->revision])->assertUnprocessable();
        $this->assertSame('cancelled', $cancelled->fresh()->status);
    }

    public function test_counts_and_actions_are_scoped_to_assigned_warehouse_and_approval_permission(): void
    {
        [$admin, $location, $other, $products] = $this->fixture();
        $own = $this->start($admin, $location, $products->take(1));
        $denied = $this->start($admin, $other, $products->take(1));
        $role = Role::create(['name' => 'cycle_counter', 'display_name' => 'Cycle Counter', 'is_admin' => true]);
        $role->permissions()->sync(Permission::whereIn('name', ['inventory.view', 'inventory.adjust.create'])->pluck('id'));
        $user = User::factory()->create(['role' => 'staff', 'status' => 'active']);
        $user->roles()->sync([$role->id]);
        $user->locations()->sync([$location->id]);
        $this->actingAs($user);
        $this->getJson('/admin/inventory/cycle-counts')->assertOk()->assertJsonPath('props.counts.total', 1);
        $this->getJson('/admin/inventory/cycle-counts?location_id='.$other->id)->assertForbidden();
        $this->getJson('/admin/inventory/cycle-counts/'.$denied->id)->assertForbidden();
        $this->getJson('/admin/inventory/cycle-counts/'.$denied->id.'/export')->assertForbidden();
        $this->postJson('/admin/inventory/cycle-counts', ['location_id' => $other->id, 'product_ids' => [$products[0]->id]])->assertForbidden();
        foreach (['refresh', 'cancel'] as $action) {
            $this->postJson('/admin/inventory/cycle-counts/'.$denied->id.'/'.$action, ['revision' => $denied->revision])->assertForbidden();
        }
        $this->putJson('/admin/inventory/cycle-counts/'.$denied->id, [])->assertForbidden();
        $this->postJson('/admin/inventory/cycle-counts/'.$own->id.'/post', ['revision' => $own->revision])->assertForbidden();
        $this->postJson('/admin/inventory/cycle-counts/'.$own->id.'/save-and-post', ['revision' => $own->revision])->assertForbidden();
        $this->saveCounts($own, [9]);
        $role->permissions()->sync(Permission::where('name', 'inventory.adjust.approve')->pluck('id'));
        $user->unsetRelation('roles');
        $this->getJson('/admin/inventory/cycle-counts/'.$own->id)->assertOk()->assertJsonPath('props.canEdit', false)->assertJsonPath('props.canPost', true);
        $this->putJson('/admin/inventory/cycle-counts/'.$own->id, [])->assertForbidden();
        $this->postJson('/admin/inventory/cycle-counts/'.$own->id.'/save-and-post', [])->assertForbidden();
        $this->post('/admin/inventory/cycle-counts/'.$own->id.'/post', ['revision' => $own->fresh()->revision])->assertSessionHasNoErrors();
        $this->assertSame('posted', $own->fresh()->status);
    }

    public function test_save_and_post_applies_unsaved_counts_in_one_atomic_operation(): void
    {
        [$user, $location, , $products] = $this->fixture();
        $count = $this->start($user, $location, $products->take(2));
        $payload = ['revision' => $count->revision, 'notes' => 'Confirmed physical count',
            'items' => $count->items()->orderBy('product_id')->get()->map(fn ($item, $index) => ['id' => $item->id, 'counted_quantity' => $index ? 12 : 8])->all()];
        $this->post('/admin/inventory/cycle-counts/'.$count->id.'/save-and-post', $payload)->assertSessionHasNoErrors()->assertRedirect();
        $this->assertSame('posted', $count->fresh()->status);
        $this->assertEquals([8, 12], $count->items()->orderBy('product_id')->pluck('counted_quantity')->map(fn ($value) => (int) $value)->all());
        $this->assertCount(2, $count->fresh()->adjustment->items);
        $this->assertDatabaseHas('audit_logs', ['action' => 'inventory.cycle_count.posted', 'subject_id' => $count->id]);
        $this->postJson('/admin/inventory/cycle-counts/'.$count->id.'/save-and-post', $payload)->assertUnprocessable();
        $this->assertEquals(1, StockAdjustment::count());
    }

    public function test_save_and_post_rolls_back_saved_values_if_stock_is_stale_or_counts_incomplete(): void
    {
        [$user, $location, , $products] = $this->fixture();
        $count = $this->start($user, $location, $products->take(2));
        $payload = ['revision' => $count->revision, 'items' => $count->items()->orderBy('product_id')->get()
            ->map(fn ($item, $index) => ['id' => $item->id, 'counted_quantity' => $index ? null : 8])->all()];
        $this->postJson('/admin/inventory/cycle-counts/'.$count->id.'/save-and-post', $payload)->assertUnprocessable();
        $this->assertEquals(1, $count->fresh()->revision);
        $this->assertNull($count->items()->first()->counted_quantity);
        $payload['items'][1]['counted_quantity'] = 10;
        app(InventoryService::class)->completeSale($location, $products[0], 1);
        $this->postJson('/admin/inventory/cycle-counts/'.$count->id.'/save-and-post', $payload)->assertUnprocessable()->assertJsonValidationErrors('snapshot');
        $this->assertEquals(1, $count->fresh()->revision);
        $this->assertNull($count->items()->first()->counted_quantity);
        $this->assertSame('draft', $count->fresh()->status);
        $this->assertEquals(0, StockAdjustment::count());
    }

    public function test_fractional_counts_keep_quantity_and_cost_precision(): void
    {
        [$user, $location, , $products] = $this->fixture();
        $products[0]->update(['original_price' => 12.345678]);
        $count = $this->start($user, $location, $products->take(1));
        $this->saveCounts($count, [10.125]);
        $this->post('/admin/inventory/cycle-counts/'.$count->id.'/post', ['revision' => $count->fresh()->revision])->assertSessionHasNoErrors();
        $line = $count->fresh()->adjustment->items->sole();
        $this->assertEquals(0.125, $line->quantity_delta);
        $this->assertEquals(12.345678, $count->items()->sole()->base_cost);
        $this->assertEquals(1.54, $line->value_delta);
        $this->assertEquals(10.125, InventoryBalance::where('location_id', $location->id)->where('product_id', $products[0]->id)->value('on_hand_qty'));
    }

    public function test_inactive_warehouses_and_changed_base_units_cannot_post(): void
    {
        [$user, $location, , $products] = $this->fixture();
        $count = $this->start($user, $location, $products->take(1));
        $this->saveCounts($count, [9]);
        $location->update(['is_active' => false]);
        $this->postJson('/admin/inventory/cycle-counts', ['location_id' => $location->id, 'product_ids' => [$products[0]->id]])->assertUnprocessable();
        $this->postJson('/admin/inventory/cycle-counts/'.$count->id.'/post', ['revision' => $count->fresh()->revision])->assertUnprocessable();
        $location->update(['is_active' => true]);
        $products[0]->units()->update(['is_active' => false]);
        $this->postJson('/admin/inventory/cycle-counts/'.$count->id.'/post', ['revision' => $count->fresh()->revision])->assertUnprocessable();
        $this->assertSame('draft', $count->fresh()->status);
        $this->assertEquals(0, StockAdjustment::count());
    }

    public function test_count_history_protects_products_without_stock_movements_from_deletion(): void
    {
        [$user, $location, , $products] = $this->fixture();
        $product = $products[0]->replicate();
        $product->slug = 'count-only-product';
        $product->product_code = 'COUNT-ONLY';
        $product->save();
        $product->units()->create(['name' => 'Piece', 'code' => 'PC', 'conversion_factor' => 1, 'is_base' => true, 'is_active' => true]);
        $count = $this->start($user, $location, collect([$product]));
        $this->getJson('/admin/products?q=COUNT-ONLY')->assertOk()->assertJsonPath('props.products.data.0.has_count_history', true);
        $this->withHeader('X-SPA', 'true')->delete('/admin/products/'.$product->id)->assertUnprocessable();
        $this->assertDatabaseHas('products', ['id' => $product->id]);
        $this->assertEquals($product->id, $count->items()->first()->product_id);
    }

    public function test_invalid_quantities_foreign_lines_and_duplicate_products_are_rejected(): void
    {
        [$user, $location, , $products] = $this->fixture();
        $this->postJson('/admin/inventory/cycle-counts', ['location_id' => $location->id, 'product_ids' => [$products[0]->id, $products[0]->id]])->assertUnprocessable();
        $count = $this->start($user, $location, $products->take(1));
        $other = $this->start($user, $location, $products->skip(1)->take(1));
        $this->putJson('/admin/inventory/cycle-counts/'.$count->id, ['revision' => $count->revision, 'items' => [['id' => $count->items->first()->id, 'counted_quantity' => -1]]])->assertUnprocessable();
        $this->putJson('/admin/inventory/cycle-counts/'.$count->id, ['revision' => $count->revision, 'items' => [['id' => $other->items->first()->id, 'counted_quantity' => 9]]])->assertUnprocessable();
        $this->assertNull($count->items()->first()->counted_quantity);
    }
}
