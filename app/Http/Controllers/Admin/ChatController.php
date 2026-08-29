<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use App\Support\Spa;

class ChatController extends Controller
{
    public function index(Request $request)
    {
        return Spa::render('Admin/Chats/Index');
    }

    public function show(Request $request, User $user)
    {
        return Spa::render('Admin/Chats/Show', [
            'customer' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
        ]);
    }
}
