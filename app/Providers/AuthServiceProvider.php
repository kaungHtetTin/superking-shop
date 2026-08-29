<?php

namespace App\Providers;

use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Gate;

class AuthServiceProvider extends ServiceProvider
{
    /**
     * The policy mappings for the application.
     *
     * @var array<class-string, class-string>
     */
    protected $policies = [
        \App\Models\Location::class => \App\Policies\LocationPolicy::class,
        \App\Models\StockReceipt::class => \App\Policies\StockReceiptPolicy::class,
        \App\Models\StockAdjustment::class => \App\Policies\StockAdjustmentPolicy::class,
        \App\Models\StockTransfer::class => \App\Policies\StockTransferPolicy::class,
    ];

    /**
     * Register any authentication / authorization services.
     *
     * @return void
     */
    public function boot()
    {
        $this->registerPolicies();

        //
    }
}
