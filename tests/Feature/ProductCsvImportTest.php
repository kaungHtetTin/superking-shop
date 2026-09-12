<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Location;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class ProductCsvImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_import_products_with_one_base_unit_and_retail_price(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        Category::create(['name' => 'Beverages', 'slug' => 'beverages', 'is_active' => true]);
        $location = Location::query()->where('is_default_fulfillment', true)->firstOrFail();
        $csv = "name,parent_category,category,sku,barcode,base_unit_name,base_unit_code,cost_price,retail_price,min_quantity,status,description\nCoffee,,Beverages,COFFEE-001,885001,Piece,pc,800,1000,5,active,Test coffee\nTea,,Beverages,,,Packet,pkt,500,750,2,draft,\n";

        $this->actingAs($admin)->post('/admin/products/import', [
            'file' => UploadedFile::fake()->createWithContent('products.csv', $csv),
            'create_missing_categories' => true,
        ])->assertRedirect('/admin/products')->assertSessionHas('success', 'CSV import completed — 2 of 2 new products created successfully.');

        $coffee = Product::where('name', 'Coffee')->with(['baseUnit.prices', 'priceTypes'])->firstOrFail();
        $this->assertSame('pc', $coffee->baseUnit->code);
        $this->assertSame(1.0, (float) $coffee->baseUnit->conversion_factor);
        $this->assertSame(1000.0, (float) $coffee->baseUnit->prices->first()->price);
        $this->assertSame('retail', $coffee->priceTypes->first()->name);
        $this->assertSame('COFFEE-001', $coffee->sku);
        $this->assertDatabaseHas('inventory_balances', ['location_id' => $location->id, 'product_id' => $coffee->id, 'on_hand_qty' => 0]);
        $this->assertNotEmpty(Product::where('name', 'Tea')->value('barcode'));
    }

    public function test_missing_category_can_be_created_as_active(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        Category::create(['name' => 'Beverages', 'slug' => 'beverages', 'is_active' => true]);
        $csv = "name,parent_category,category,sku,barcode,base_unit_name,base_unit_code,cost_price,retail_price,min_quantity,status,description\nValid,,Beverages,,1001,Piece,pc,10,20,0,active,\nNew Product,,New Category,,1002,Piece,pc,10,15,0,active,\n";

        $this->actingAs($admin)->post('/admin/products/import', [
            'file' => UploadedFile::fake()->createWithContent('products.csv', $csv),
            'create_missing_categories' => true,
        ])->assertRedirect('/admin/products')
            ->assertSessionHas('success', 'CSV import completed — 2 of 2 new products created successfully. 1 new category was created as active.');

        $this->assertDatabaseHas('categories', ['name' => 'New Category', 'is_active' => true]);
        $this->assertDatabaseHas('products', ['name' => 'New Product']);
        $this->assertSame(1, Product::query()->where('name', 'New Product')->inActiveCategory()->count());
    }

    public function test_missing_category_is_rejected_when_auto_create_is_disabled(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $csv = "name,parent_category,category,sku,barcode,base_unit_name,base_unit_code,cost_price,retail_price,min_quantity,status,description\nProduct,,Missing,,1002,Piece,pc,10,15,0,active,\n";

        $this->actingAs($admin)->from('/admin/products/import')->post('/admin/products/import', [
            'file' => UploadedFile::fake()->createWithContent('products.csv', $csv),
            'create_missing_categories' => false,
        ])->assertRedirect('/admin/products/import')->assertSessionHasErrors('file');

        $this->assertSame(0, Product::count());
    }

    public function test_template_has_excel_compatible_utf8_bom_and_headers(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $response = $this->actingAs($admin)->get('/admin/products/import/template')->assertOk();

        $content = $response->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBFname,parent_category,category,sku,barcode", $content);
    }

    public function test_legacy_template_without_new_optional_columns_can_be_imported(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        Category::create(['name' => 'Beverages', 'slug' => 'beverages', 'is_active' => true]);
        $csv = "\xEF\xBB\xBFname,category,barcode,base_unit_name,base_unit_code,cost_price,retail_price,min_quantity,status,description\nLegacy Tea,Beverages,,Piece,pc,100,150,0,active,Imported from the previous template\n";

        $this->actingAs($admin)->post('/admin/products/import', [
            'file' => UploadedFile::fake()->createWithContent('product-import-template.csv', $csv),
            'create_missing_categories' => true,
        ])->assertRedirect('/admin/products')->assertSessionHasNoErrors();

        $this->assertDatabaseHas('products', [
            'name' => 'Legacy Tea',
            'sku' => null,
        ]);
    }

    public function test_export_uses_the_same_columns_as_the_new_product_import(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $parent = Category::create(['name' => 'Drinks', 'slug' => 'drinks', 'is_active' => true]);
        $category = Category::create(['parent_id' => $parent->id, 'name' => 'Beverages', 'slug' => 'beverages', 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'sku' => 'EXPORT-COFFEE-001',
            'barcode' => '8850099',
            'name' => 'Export Coffee',
            'slug' => 'export-coffee',
            'original_price' => 800,
            'min_quantity' => 5,
            'status' => 'active',
            'is_active' => true,
        ]);
        $unit = $product->units()->create(['name' => 'Piece', 'code' => 'pc', 'conversion_factor' => 1, 'is_base' => true, 'is_default_selling' => true, 'is_active' => true]);
        $retail = $product->priceTypes()->create(['name' => 'retail', 'is_default' => true]);
        $unit->prices()->create(['product_price_type_id' => $retail->id, 'price' => 1000]);

        $content = $this->actingAs($admin)->get('/admin/products/export')->assertOk()->streamedContent();

        $this->assertStringStartsWith("\xEF\xBB\xBFname,parent_category,category,sku,barcode", $content);
        $stream = fopen('php://temp', 'w+b');
        fwrite($stream, preg_replace('/^\xEF\xBB\xBF/', '', $content));
        rewind($stream);
        $headers = fgetcsv($stream);
        $row = fgetcsv($stream);
        fclose($stream);

        $this->assertSame(['name', 'parent_category', 'category', 'sku', 'barcode', 'base_unit_name', 'base_unit_code', 'cost_price', 'retail_price', 'min_quantity', 'status', 'description'], $headers);
        $this->assertSame(['Export Coffee', 'Drinks', 'Beverages', 'EXPORT-COFFEE-001', '8850099', 'Piece', 'pc', '800.00', '1000.00', '5.0000', 'active', ''], $row);
    }

    public function test_import_creates_and_assigns_parent_and_child_categories(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $csv = "name,parent_category,category,sku,barcode,base_unit_name,base_unit_code,cost_price,retail_price,min_quantity,status,description\nCoffee,Drinks,Hot Drinks,COFFEE-HOT,8850100,Piece,pc,10,20,0,active,\n";

        $this->actingAs($admin)->post('/admin/products/import', [
            'file' => UploadedFile::fake()->createWithContent('products.csv', $csv),
            'create_missing_categories' => true,
        ])->assertRedirect('/admin/products');

        $parent = Category::query()->where('name', 'Drinks')->whereNull('parent_id')->firstOrFail();
        $child = Category::query()->where('name', 'Hot Drinks')->where('parent_id', $parent->id)->firstOrFail();
        $this->assertTrue($parent->is_active);
        $this->assertTrue($child->is_active);
        $this->assertDatabaseHas('products', ['name' => 'Coffee', 'category_id' => $child->id]);
    }

    public function test_matching_parent_and_category_are_imported_as_one_top_level_category(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $csv = "name,parent_category,category,sku,barcode,base_unit_name,base_unit_code,cost_price,retail_price,min_quantity,status,description\nCoffee,Beverages, beverages ,MATCHING-CATEGORY,,Piece,pc,10,20,0,active,\n";

        $this->actingAs($admin)->post('/admin/products/import', [
            'file' => UploadedFile::fake()->createWithContent('products.csv', $csv),
            'create_missing_categories' => true,
        ])->assertRedirect('/admin/products')->assertSessionHasNoErrors();

        $category = Category::query()->where('name', 'beverages')->whereNull('parent_id')->firstOrFail();
        $this->assertDatabaseCount('categories', 1);
        $this->assertDatabaseHas('products', [
            'name' => 'Coffee',
            'category_id' => $category->id,
        ]);
    }

    public function test_blank_category_uses_active_system_default_even_when_category_creation_is_disabled(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $csv = "name,parent_category,category,sku,barcode,base_unit_name,base_unit_code,cost_price,retail_price,min_quantity,status,description\nLoose Item,Ignored Parent,,NO-CATEGORY,,Piece,pc,10,20,0,active,\n";

        $this->actingAs($admin)->post('/admin/products/import', [
            'file' => UploadedFile::fake()->createWithContent('products.csv', $csv),
            'create_missing_categories' => false,
        ])->assertRedirect('/admin/products')->assertSessionHasNoErrors();

        $category = Category::query()
            ->where('name', \App\Services\ProductCsvImportService::DEFAULT_CATEGORY)
            ->whereNull('parent_id')
            ->firstOrFail();

        $this->assertTrue($category->is_active);
        $this->assertDatabaseHas('products', [
            'name' => 'Loose Item',
            'category_id' => $category->id,
        ]);
    }

    public function test_unit_price_template_exports_existing_matrix_and_import_adds_a_unit(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $category = Category::create(['name' => 'Beverages', 'slug' => 'beverages', 'is_active' => true]);
        $product = Product::create(['category_id' => $category->id, 'sku' => 'COFFEE-01', 'name' => 'Coffee', 'slug' => 'coffee', 'original_price' => 100, 'status' => 'active', 'is_active' => true]);
        $piece = $product->units()->create(['name' => 'Piece', 'code' => 'pc', 'conversion_factor' => 1, 'is_base' => true, 'is_default_selling' => true, 'is_active' => true]);
        $retail = $product->priceTypes()->create(['name' => 'retail', 'is_default' => true]);
        $piece->prices()->create(['product_price_type_id' => $retail->id, 'price' => 150, 'is_manual' => false, 'calculation_status' => 'cost_required']);

        $export = $this->actingAs($admin)->get('/admin/products/import/unit-prices/template')->assertOk()->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBFproduct_code,sku,product_name,unit_name,unit_code", $export);
        $this->assertStringNotContainsString('pricing_mode', $export);
        $this->assertStringContainsString('COFFEE-01,Coffee', $export);

        $headers = implode(',', \App\Services\ProductUnitPriceCsvService::HEADERS);
        $csv = $headers."\n"
            ."{$product->product_code},COFFEE-01,Coffee,Piece,pc,1,yes,no,yes,retail,150\n"
            ."{$product->product_code},COFFEE-01,Coffee,Box,box,10,no,yes,yes,retail,1400\n";

        $this->actingAs($admin)->post('/admin/products/import/unit-prices', [
            'unit_price_file' => UploadedFile::fake()->createWithContent('unit-prices.csv', $csv),
        ])->assertRedirect('/admin/products');

        $box = $product->fresh()->units()->where('code', 'box')->firstOrFail();
        $this->assertSame(2, $product->fresh()->units()->count());
        $this->assertSame($piece->id, $product->units()->where('code', 'pc')->firstOrFail()->id);
        $this->assertSame(10.0, (float) $box->conversion_factor);
        $this->assertTrue($box->is_default_selling);
        $this->assertFalse($piece->fresh()->is_default_selling);
        $this->assertSame(1400.0, (float) $box->prices()->firstOrFail()->price);
        $this->assertTrue($piece->prices()->firstOrFail()->is_manual);
        $this->assertSame('manual', $piece->prices()->firstOrFail()->calculation_status);
    }

    public function test_unit_price_import_rejects_an_incomplete_matrix_without_changes(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $category = Category::create(['name' => 'Beverages', 'slug' => 'beverages', 'is_active' => true]);
        $product = Product::create(['category_id' => $category->id, 'name' => 'Tea', 'slug' => 'tea', 'original_price' => 100, 'status' => 'active', 'is_active' => true]);
        $piece = $product->units()->create(['name' => 'Piece', 'code' => 'pc', 'conversion_factor' => 1, 'is_base' => true, 'is_default_selling' => true, 'is_active' => true]);
        $retail = $product->priceTypes()->create(['name' => 'retail', 'is_default' => true]);
        $piece->prices()->create(['product_price_type_id' => $retail->id, 'price' => 150, 'is_manual' => true]);
        $headers = implode(',', \App\Services\ProductUnitPriceCsvService::HEADERS);
        $csv = $headers."\n{$product->product_code},,Tea,Box,box,10,no,no,yes,retail,1400\n";

        $this->actingAs($admin)->from('/admin/products/import')->post('/admin/products/import/unit-prices', [
            'unit_price_file' => UploadedFile::fake()->createWithContent('unit-prices.csv', $csv),
        ])->assertRedirect('/admin/products/import')->assertSessionHasErrors('unit_price_file');

        $this->assertSame(1, $product->units()->count());
        $this->assertDatabaseMissing('product_units', ['product_id' => $product->id, 'code' => 'box']);
    }

    public function test_unit_price_import_rejects_a_partial_existing_unit_identity_match(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        $category = Category::create(['name' => 'Beverages', 'slug' => 'beverages', 'is_active' => true]);
        $product = Product::create(['category_id' => $category->id, 'name' => 'Juice', 'slug' => 'juice', 'original_price' => 100, 'status' => 'active', 'is_active' => true]);
        $piece = $product->units()->create(['name' => 'Piece', 'code' => 'pc', 'conversion_factor' => 1, 'is_base' => true, 'is_default_selling' => true, 'is_active' => true]);
        $retail = $product->priceTypes()->create(['name' => 'retail', 'is_default' => true]);
        $piece->prices()->create(['product_price_type_id' => $retail->id, 'price' => 150, 'is_manual' => true]);
        $headers = implode(',', \App\Services\ProductUnitPriceCsvService::HEADERS);
        $csv = $headers."\n{$product->product_code},,Juice,Piece,each,1,yes,yes,yes,retail,150\n";

        $this->actingAs($admin)->from('/admin/products/import')->post('/admin/products/import/unit-prices', [
            'unit_price_file' => UploadedFile::fake()->createWithContent('unit-prices.csv', $csv),
        ])->assertRedirect('/admin/products/import')->assertSessionHasErrors('unit_price_file');

        $this->assertSame(1, $product->units()->count());
        $this->assertSame('pc', $piece->fresh()->code);
    }
}
