<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->string('role')->default('customer'); // super_admin, manager, cashier, support, customer
            $table->json('permissions')->nullable(); // Granular permissions for admin roles
            $table->string('status')->default('active'); // active, suspended
            $table->string('phone')->nullable();
            $table->string('avatar')->nullable();
            $table->integer('loyalty_points')->default(0);
            $table->string('tier')->default('Bronze'); // Bronze, Silver, Gold, Platinum
            $table->rememberToken();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('users');
    }
};
