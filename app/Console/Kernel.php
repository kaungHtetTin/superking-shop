<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     *
     * @param  \Illuminate\Console\Scheduling\Schedule  $schedule
     * @return void
     */
    protected function schedule(Schedule $schedule)
    {
        $schedule->command('inventory:expire-reservations')
            ->everyFiveMinutes()
            ->withoutOverlapping();
        $schedule->command('operations:health-check')
            ->everyFifteenMinutes()
            ->withoutOverlapping();
        $schedule->command('inventory:reconcile')
            ->dailyAt('02:00')
            ->withoutOverlapping();
        $schedule->command('inventory:scan-low-stock')
            ->dailyAt(config('inventory.low_stock_digest_time', '08:00'))
            ->withoutOverlapping();
    }

    /**
     * Register the commands for the application.
     *
     * @return void
     */
    protected function commands()
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
