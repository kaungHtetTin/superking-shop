<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storefront_blocks', function (Blueprint $table) {
            $table->id();
            $table->string('type', 40);
            $table->string('key')->nullable()->index();
            $table->string('title')->nullable();
            $table->string('subtitle')->nullable();
            $table->string('button_label')->nullable();
            $table->string('link_url')->nullable();
            $table->string('image_path')->nullable();
            $table->string('accent_color', 7)->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['type', 'is_active', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storefront_blocks');
    }
};
