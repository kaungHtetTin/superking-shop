<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Role;
use App\Models\Location;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $email = env('INITIAL_ADMIN_EMAIL', 'admin@onlineshop.com');
        $password = env('INITIAL_ADMIN_PASSWORD', 'password');

        $admin = User::updateOrCreate(
            ['email' => $email],
            [
                'name' => env('INITIAL_ADMIN_NAME', 'Super Admin'),
                'password' => Hash::make($password),
                'role' => 'super_admin',
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        $superAdminRoleId = Role::query()->where('name', 'super_admin')->value('id');

        if ($superAdminRoleId) {
            $admin->roles()->sync([$superAdminRoleId]);
        }

        User::withTrashed()
            ->where('email', 'manager@onlineshop.com')
            ->where('role', 'manager')
            ->where('name', 'Shop Manager')
            ->forceDelete();

        if (Schema::hasTable('locations')) {
            $locationAssignments = Location::query()
                ->get()
                ->mapWithKeys(fn (Location $location) => [$location->id => [
                    'is_default' => $location->code === 'MAIN-WH',
                ]])
                ->all();

            $admin->locations()->sync($locationAssignments);
        }
    }
}
