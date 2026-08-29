<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('icon')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained()->onDelete('cascade');
            $table->string('product_code', 64)->unique();
            $table->string('barcode', 128)->nullable()->unique();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->decimal('min_quantity', 18, 4)->default(0);
            $table->decimal('original_price', 14, 2)->default(0);
            $table->string('status', 32)->default('active');
            $table->json('metadata')->nullable();
            $table->boolean('is_featured')->default(false);
            $table->boolean('is_active')->default(true);
            $table->decimal('rating', 3, 2)->default(0);
            $table->integer('review_count')->default(0);
            $table->timestamps();
        });

        Schema::create('product_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->string('image_path');
            $table->boolean('is_primary')->default(false);
            $table->timestamps();
        });

        Schema::create('product_units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->string('code', 30);
            $table->decimal('conversion_factor', 18, 6)->default(1)->comment('Number of base units in one of this unit');
            $table->boolean('is_base')->default(false);
            $table->boolean('is_default_selling')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['product_id', 'name']);
            $table->unique(['product_id', 'code']);
            $table->index(['product_id', 'is_base']);
            $table->index(['product_id', 'is_default_selling']);
        });

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

        Schema::create('product_unit_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_unit_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_price_type_id')->constrained()->cascadeOnDelete();
            $table->decimal('price', 14, 2);
            $table->timestamps();
            $table->unique(['product_unit_id', 'product_price_type_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('product_unit_prices');
        Schema::dropIfExists('product_price_types');
        Schema::dropIfExists('product_units');
        Schema::dropIfExists('product_images');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');
    }
};
