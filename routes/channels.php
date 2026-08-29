<?php

use App\Models\Location;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Here you may register all of the event broadcasting channels that your
| application supports. The given channel authorization callbacks are
| used to check if an authenticated user can listen to the channel.
|
*/

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('inventory.location.{locationId}', function ($user, $locationId) {
    $location = Location::query()->find((int) $locationId);

    return $location
        && $user->hasAdminPermission('inventory.view')
        && $user->canAccessLocation($location);
});

Broadcast::channel('inventory.all', function ($user) {
    return $user->hasAdminPermission('inventory.view')
        && $user->hasAdminPermission('locations.manage');
});
