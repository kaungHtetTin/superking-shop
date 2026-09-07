<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\FinancialEntry;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\StockTransfer;
use App\Models\User;
use App\Services\Inventory\InventoryService;
use App\Services\Inventory\StockTransferService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class StockTransferDeletionTest extends TestCase
{
    use RefreshDatabase;

    public function test_deleting_a_transfer_reverses_inventory_and_removes_financial_and_transfer_records(): void
    {
        [$product, $unit, $source, $destination, $actor] = $this->transferFixture();
        $inventory = app(InventoryService::class);
        $inventory->receive($source, $product, 10, idempotencyKey: 'transfer-delete-opening');
        $transfer = app(StockTransferService::class)->transferNow(
            $source,
            $destination,
            [['product_unit_id' => $unit->id, 'requested_quantity' => 4]],
            $actor,
        );
        $transferNumber = $transfer->transfer_number;

        app(StockTransferService::class)->delete($transfer, $actor);

        $this->assertSame(10.0, $this->stockAt($source, $product));
        $this->assertSame(0.0, $this->stockAt($destination, $product));
        $this->assertDatabaseMissing('stock_transfers', ['id' => $transfer->id]);
        $this->assertDatabaseMissing('stock_transfer_items', ['stock_transfer_id' => $transfer->id]);
        $this->assertDatabaseMissing('financial_entries', ['stock_transfer_id' => $transfer->id]);
        $this->assertDatabaseMissing('financial_entries', ['reference' => $transferNumber]);
        $this->assertDatabaseHas('inventory_movements', [
            'location_id' => $destination->id,
            'product_id' => $product->id,
            'reason_code' => 'transfer_delete',
            'quantity_delta' => -4,
        ]);
        $this->assertDatabaseHas('inventory_movements', [
            'location_id' => $source->id,
            'product_id' => $product->id,
            'reason_code' => 'transfer_delete',
            'quantity_delta' => 4,
        ]);
    }

    public function test_deleting_a_transfer_is_atomic_when_destination_stock_is_no_longer_available(): void
    {
        [$product, $unit, $source, $destination, $actor] = $this->transferFixture();
        $inventory = app(InventoryService::class);
        $inventory->receive($source, $product, 10, idempotencyKey: 'transfer-delete-guard-opening');
        $transfer = app(StockTransferService::class)->transferNow(
            $source,
            $destination,
            [['product_unit_id' => $unit->id, 'requested_quantity' => 4]],
            $actor,
        );
        $inventory->completeSale($destination, $product, 1, idempotencyKey: 'transfer-delete-guard-sale');

        try {
            app(StockTransferService::class)->delete($transfer, $actor);
            $this->fail('A transfer was deleted after some destination stock had been consumed.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('quantity', $exception->errors());
        }

        $this->assertSame(6.0, $this->stockAt($source, $product));
        $this->assertSame(3.0, $this->stockAt($destination, $product));
        $this->assertDatabaseHas('stock_transfers', ['id' => $transfer->id]);
        $this->assertSame(0, FinancialEntry::query()->where('stock_transfer_id', $transfer->id)->count());
        $this->assertSame(0, InventoryMovement::query()->where('reason_code', 'transfer_delete')->count());
    }

    public function test_authorized_admin_can_delete_a_transfer_through_the_admin_endpoint(): void
    {
        [$product, $unit, $source, $destination, $actor] = $this->transferFixture();
        app(InventoryService::class)->receive($source, $product, 10, idempotencyKey: 'transfer-delete-endpoint-opening');
        $transfer = app(StockTransferService::class)->transferNow(
            $source,
            $destination,
            [['product_unit_id' => $unit->id, 'requested_quantity' => 4]],
            $actor,
        );

        $response = $this->actingAs($actor)->delete("/admin/inventory/transfers/{$transfer->id}");

        $response->assertRedirect('/admin/inventory/transfers');
        $response->assertSessionHas('success');
        $this->assertDatabaseMissing('stock_transfers', ['id' => $transfer->id]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'inventory.transfer.deleted',
            'subject_type' => null,
            'subject_id' => null,
        ]);
    }

    /** @return array{Product, ProductUnit, Location, Location, User} */
    private function transferFixture(): array
    {
        $category = Category::create([
            'name' => 'Transfer test category',
            'slug' => 'transfer-test-'.uniqid(),
            'is_active' => true,
        ]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Transfer test product',
            'slug' => 'transfer-product-'.uniqid(),
            'description' => 'Transfer reversal test product',
            'min_quantity' => 0,
            'original_price' => 25,
            'status' => 'active',
            'is_active' => true,
        ]);
        $unit = $product->units()->create([
            'name' => 'Piece',
            'code' => 'PC',
            'conversion_factor' => 1,
            'is_base' => true,
            'is_default_selling' => true,
            'is_active' => true,
            'sort_order' => 0,
        ]);
        $source = $this->location('SRC');
        $destination = $this->location('DST');
        $actor = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);

        return [$product, $unit, $source, $destination, $actor];
    }

    private function location(string $prefix): Location
    {
        return Location::create([
            'code' => $prefix.'-'.uniqid(),
            'name' => $prefix.' warehouse',
            'type' => 'warehouse',
            'timezone' => 'Asia/Rangoon',
            'is_active' => true,
            'is_default_fulfillment' => false,
            'is_system' => false,
        ]);
    }

    private function stockAt(Location $location, Product $product): float
    {
        return (float) InventoryBalance::query()
            ->whereBelongsTo($location)
            ->whereBelongsTo($product)
            ->value('on_hand_qty');
    }
}
