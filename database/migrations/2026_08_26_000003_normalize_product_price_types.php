<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('product_price_types')) {
            Schema::create('product_price_types', function (Blueprint $table) {
                $table->id();
                $table->foreignId('product_id')->constrained()->cascadeOnDelete();
                $table->string('name', 60);
                $table->boolean('is_default')->default(false);
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->timestamps();
                $table->unique(['product_id', 'name']);
                $table->index(['product_id', 'is_default']);
            });
        }

        if (! Schema::hasColumn('product_unit_prices', 'price_type')) {
            return;
        }

        Schema::create('product_unit_prices_normalized', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_unit_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_price_type_id')->constrained('product_price_types')->cascadeOnDelete();
            $table->decimal('price', 14, 2);
            $table->timestamps();
            $table->unique(['product_unit_id', 'product_price_type_id'], 'unit_price_type_unique');
        });

        $rows = DB::table('product_unit_prices')
            ->join('product_units', 'product_units.id', '=', 'product_unit_prices.product_unit_id')
            ->select('product_unit_prices.*', 'product_units.product_id')
            ->orderBy('product_units.product_id')
            ->orderBy('product_unit_prices.id')
            ->get();

        $typeIds = [];
        foreach ($rows as $row) {
            $name = strtolower(trim($row->price_type ?: 'retail'));
            $key = $row->product_id.'|'.$name;
            if (! isset($typeIds[$key])) {
                $typeIds[$key] = DB::table('product_price_types')->insertGetId([
                    'product_id' => $row->product_id,
                    'name' => $name,
                    'is_default' => $name === 'retail',
                    'sort_order' => $name === 'retail' ? 0 : count(array_filter(array_keys($typeIds), fn ($existing) => str_starts_with($existing, $row->product_id.'|'))),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            DB::table('product_unit_prices_normalized')->insert([
                'product_unit_id' => $row->product_unit_id,
                'product_price_type_id' => $typeIds[$key],
                'price' => $row->price,
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,
            ]);
        }

        Schema::drop('product_unit_prices');
        Schema::rename('product_unit_prices_normalized', 'product_unit_prices');
    }

    public function down(): void
    {
        // This development-only normalization is intentionally forward-only.
    }
};
