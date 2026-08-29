<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use App\Support\Spa;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $query = AuditLog::query()->with('user:id,name,email')->latest();

        if ($request->filled('q')) {
            $term = '%'.trim($request->q).'%';
            $query->where(function ($q) use ($term) {
                $q->where('action', 'like', $term)
                    ->orWhereHas('user', fn ($u) => $u->where('name', 'like', $term)->orWhere('email', 'like', $term));
            });
        }

        return Spa::render('Admin/AuditLogs/Index', [
            'logs' => $query->paginate(20)->withQueryString(),
            'filters' => [
                'q' => $request->string('q')->toString(),
            ],
        ]);
    }
}
