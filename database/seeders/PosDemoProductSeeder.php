<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\PosRegister;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class PosDemoProductSeeder extends Seeder
{
    public function run(): void
    {
        $warehouse = $this->location('MAIN-WH', 'Main Warehouse', true);
        $store = $this->location('MAIN-STORE', 'Main Store', false);
        PosRegister::query()->updateOrCreate(['code' => 'POS-01'], ['location_id' => $store->id, 'name' => 'Front Counter POS', 'is_active' => true]);
        PosRegister::query()->updateOrCreate(['code' => 'WH-POS-01'], ['location_id' => $warehouse->id, 'name' => 'Warehouse Test POS', 'is_active' => true]);

        $categories = collect([
            ['name' => 'Guitars', 'icon' => 'guitar', 'sort_order' => 10],
            ['name' => 'Keyboards', 'icon' => 'piano', 'sort_order' => 20],
            ['name' => 'Drums', 'icon' => 'drum', 'sort_order' => 30],
            ['name' => 'Accessories', 'icon' => 'cable', 'sort_order' => 40],
        ])->mapWithKeys(function (array $data) {
            $category = Category::query()->updateOrCreate(['slug' => Str::slug($data['name'])], array_merge($data, ['description' => "Demo {$data['name']} for POS testing.", 'is_active' => true, 'metadata' => ['homepage_featured' => true]]));

            return [$data['name'] => $category];
        });

        $products = [
            ['category' => 'Guitars', 'code' => 'PRD-GTR-AQU', 'barcode' => '899100100001', 'name' => 'Aquila Classic Acoustic Guitar', 'cost' => 125000, 'min' => 3, 'retail' => 185000, 'wholesale' => 160000, 'warehouse' => 18, 'store' => 6, 'pack' => 5],
            ['category' => 'Guitars', 'code' => 'PRD-GTR-STP', 'barcode' => '899100100002', 'name' => 'StagePro Electric Guitar', 'cost' => 310000, 'min' => 2, 'retail' => 420000, 'wholesale' => 375000, 'warehouse' => 7, 'store' => 2, 'pack' => null],
            ['category' => 'Keyboards', 'code' => 'PRD-KEY-MEL', 'barcode' => '899100100003', 'name' => 'Melody 61-Key Portable Keyboard', 'cost' => 180000, 'min' => 2, 'retail' => 260000, 'wholesale' => 228000, 'warehouse' => 10, 'store' => 3, 'pack' => null],
            ['category' => 'Drums', 'code' => 'PRD-DRM-PLS', 'barcode' => '899100100004', 'name' => 'Pulse Compact Cajon', 'cost' => 61000, 'min' => 4, 'retail' => 95000, 'wholesale' => 82000, 'warehouse' => 16, 'store' => 5, 'pack' => 4],
            ['category' => 'Accessories', 'code' => 'PRD-ACC-CBL', 'barcode' => '899100100005', 'name' => 'RoadLine 10 ft Instrument Cable', 'cost' => 9000, 'min' => 15, 'retail' => 18000, 'wholesale' => 14500, 'warehouse' => 80, 'store' => 25, 'pack' => 10],
            ['category' => 'Accessories', 'code' => 'PRD-ACC-TUN', 'barcode' => '899100100006', 'name' => 'Clip-On Chromatic Tuner', 'cost' => 11000, 'min' => 12, 'retail' => 22000, 'wholesale' => 17500, 'warehouse' => 65, 'store' => 20, 'pack' => 12],
            ['category' => 'Accessories', 'code' => 'PRD-ACC-STR', 'barcode' => '899100100007', 'name' => 'Demo Out-of-Stock Guitar Strings', 'cost' => 8000, 'min' => 10, 'retail' => 16000, 'wholesale' => 12500, 'warehouse' => 0, 'store' => 0, 'pack' => 12],
        ];

        foreach ($products as $data) {
            $product = Product::query()->updateOrCreate(
                ['product_code' => $data['code']],
                ['category_id' => $categories[$data['category']]->id, 'barcode' => $data['barcode'], 'name' => $data['name'], 'slug' => Str::slug($data['name']), 'description' => "Demo {$data['name']} with product-level inventory and unit conversion.", 'min_quantity' => $data['min'], 'original_price' => $data['cost'], 'status' => 'active', 'is_active' => true, 'is_featured' => true, 'rating' => 4.50, 'review_count' => 12, 'metadata' => ['demo_pos_product' => true]]
            );
            $base = $product->units()->updateOrCreate(['code' => 'pc'], ['name' => 'Piece', 'conversion_factor' => 1, 'is_base' => true, 'is_default_selling' => true, 'is_active' => true, 'sort_order' => 0]);
            $retail = $product->priceTypes()->updateOrCreate(['name' => 'retail'], ['is_default' => true, 'sort_order' => 0]);
            $wholesale = $product->priceTypes()->updateOrCreate(['name' => 'wholesale'], ['is_default' => false, 'sort_order' => 1]);
            $base->prices()->updateOrCreate(['product_price_type_id' => $retail->id], ['price' => $data['retail']]);
            $base->prices()->updateOrCreate(['product_price_type_id' => $wholesale->id], ['price' => $data['wholesale']]);
            if ($data['pack']) {
                $pack = $product->units()->updateOrCreate(['code' => 'box'], ['name' => 'Box', 'conversion_factor' => $data['pack'], 'is_base' => false, 'is_default_selling' => false, 'is_active' => true, 'sort_order' => 1]);
                $pack->prices()->updateOrCreate(['product_price_type_id' => $retail->id], ['price' => $data['retail'] * $data['pack']]);
                $pack->prices()->updateOrCreate(['product_price_type_id' => $wholesale->id], ['price' => $data['wholesale'] * $data['pack']]);
            }
            $this->setBalance($warehouse, $product, $data['warehouse']);
            $this->setBalance($store, $product, $data['store']);
        }
    }

    private function location(string $code, string $name, bool $default): Location
    {
        return Location::query()->updateOrCreate(['code' => $code], ['name' => $name, 'type' => 'warehouse', 'timezone' => 'Asia/Yangon', 'is_active' => true, 'is_default_fulfillment' => $default, 'is_system' => true]);
    }

    private function setBalance(Location $location, Product $product, float $quantity): void
    {
        InventoryBalance::query()->updateOrCreate(['location_id' => $location->id, 'product_id' => $product->id], ['on_hand_qty' => $quantity, 'reserved_qty' => 0, 'version' => 1]);
    }
}
