<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Support\Spa;

class GuideController extends Controller
{
    public function index()
    {
        return Spa::render('User/Guide/Index');
    }
}
