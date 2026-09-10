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

    public function test_missing_category_can_be_created_as_inactive(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'status' => 'active']);
        Category::create(['name' => 'Beverages', 'slug' => 'beverages', 'is_active' => true]);
        $csv = "name,parent_category,category,sku,barcode,base_unit_name,base_unit_code,cost_price,retail_price,min_quantity,status,description\nValid,,Beverages,,1001,Piece,pc,10,20,0,active,\nNew Product,,New Category,,1002,Piece,pc,10,15,0,active,\n";

        $this->actingAs($admin)->post('/admin/products/import', [
            'file' => UploadedFile::fake()->createWithContent('products.csv', $csv),
            'create_missing_categories' => true,
        ])->assertRedirect('/admin/products')
            ->assertSessionHas('success', 'CSV import completed — 2 of 2 new products created successfully. 1 new category was created as inactive.');

        $this->assertDatabaseHas('categories', ['name' => 'New Category', 'is_active' => false]);
        $this->assertDatabaseHas('products', ['name' => 'New Product']);
        $this->assertSame(0, Product::query()->where('name', 'New Product')->inActiveCategory()->count());

        Category::query()->where('name', 'New Category')->update(['is_active' => true]);
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
        $this->assertFalse($parent->is_active);
        $this->assertFalse($child->is_active);
        $this->assertDatabaseHas('products', ['name' => 'Coffee', 'category_id' => $child->id]);
    }
}
