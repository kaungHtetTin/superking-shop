<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OperationsHealthCheck extends Model
{
    use HasFactory;

    protected $fillable = ['check_name', 'status', 'summary', 'details', 'checked_at'];

    protected $casts = [
        'details' => 'array',
        'checked_at' => 'datetime',
    ];
}
