<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Location;
use App\Models\Product;
use App\Models\User;
use App\Services\Inventory\StockReceiptCsvService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class StockReceiptCsvImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_template_uses_each_products_default_selling_unit_and_converted_cost(): void
    {
        [$admin, , $product, , $box] = $this->fixture();

        $content = $this->actingAs($admin)
            ->get('/admin/inventory/receipts/import/template')
            ->assertOk()
            ->assertDownload()
            ->streamedContent();

        $this->assertStringStartsWith("\xEF\xBB\xBF".implode(',', StockReceiptCsvService::HEADERS), $content);
        $stream = fopen('php://temp', 'w+b');
        fwrite($stream, preg_replace('/^\xEF\xBB\xBF/', '', $content));
        rewind($stream);
        $headers = fgetcsv($stream);
        $row = fgetcsv($stream);
        fclose($stream);
        $this->assertSame(StockReceiptCsvService::HEADERS, $headers);
        $this->assertSame([$product->product_code, 'RECEIPT-01', 'Receipt Product', 'Box', 'box', '0', '0', '125.00'], $row);
        $this->assertTrue($box->is_default_selling);
    }

    public function test_import_preview_returns_selected_lines_for_step_three_without_posting_stock(): void
    {
        [$admin, $location, $product, , $box] = $this->fixture();
        $csv = implode(',', StockReceiptCsvService::HEADERS)."\n"
            ."{$product->product_code},RECEIPT-01,Receipt Product,Box,box,3,1,120\n";

        $response = $this->actingAs($admin)->post('/admin/inventory/receipts/import/preview', [
            'location_id' => $location->id,
            'receipt_file' => UploadedFile::fake()->createWithContent('receipt.csv', $csv),
        ], ['Accept' => 'application/json']);

        $response->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.product_id', $product->id)
            ->assertJsonPath('items.0.product_unit_id', $box->id)
            ->assertJsonPath('items.0.received_quantity', 3)
            ->assertJsonPath('items.0.free_quantity', 1)
            ->assertJsonPath('items.0.unit_cost', 120)
            ->assertJsonPath('items.0.unit.is_default_selling', true);

        $this->assertDatabaseCount('stock_receipts', 0);
        $this->assertDatabaseCount('inventory_movements', 0);
    }

    public function test_zero_quantity_rows_are_ignored_and_at_least_one_paid_quantity_is_required(): void
    {
        [$admin, $location, $product] = $this->fixture();
        $csv = implode(',', StockReceiptCsvService::HEADERS)."\n"
            ."{$product->product_code},RECEIPT-01,Receipt Product,Box,box,0,0,125\n";

        $this->actingAs($admin)->post('/admin/inventory/receipts/import/preview', [
            'location_id' => $location->id,
            'receipt_file' => UploadedFile::fake()->createWithContent('receipt.csv', $csv),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('receipt_file');
    }

    private function fixture(): array
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $location = Location::create(['name' => 'Receipt CSV warehouse', 'code' => 'RCV-CSV', 'type' => 'warehouse', 'is_active' => true]);
        $category = Category::create(['name' => 'Receipt CSV', 'slug' => 'receipt-csv', 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Receipt Product',
            'slug' => 'receipt-product',
            'sku' => 'RECEIPT-01',
            'original_price' => 12.50,
            'status' => 'active',
            'is_active' => true,
        ]);
        $piece = $product->units()->create([
            'name' => 'Piece', 'code' => 'pc', 'conversion_factor' => 1,
            'is_base' => true, 'is_default_selling' => false, 'is_active' => true,
        ]);
        $box = $product->units()->create([
            'name' => 'Box', 'code' => 'box', 'conversion_factor' => 10,
            'is_base' => false, 'is_default_selling' => true, 'is_active' => true,
        ]);

        return [$admin, $location, $product, $piece, $box];
    }
}
