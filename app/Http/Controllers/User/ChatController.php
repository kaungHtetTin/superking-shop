<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Support\Spa;

class ChatController extends Controller
{
    /**
     * Customer support chat (data loaded via REST + React Query).
     */
    public function index(Request $request)
    {
        return Spa::render('User/Chat/Show');
    }
}
