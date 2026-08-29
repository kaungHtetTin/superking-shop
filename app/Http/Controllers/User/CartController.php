<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Support\Spa;

class CartController extends Controller
{
    public function index()
    {
        return Spa::render('User/Cart/Index');
    }
}
