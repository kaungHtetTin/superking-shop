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
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:150'],
            'date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $query = AuditLog::query()->with('user:id,name,email')->latest();

        if (! empty($filters['q'])) {
            $value = trim($filters['q']);
            $term = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value).'%';
            $query->where(function ($query) use ($term, $value) {
                $query->where('action', 'like', $term)
                    ->orWhere('subject_type', 'like', $term)
                    ->orWhere('ip_address', 'like', $term)
                    ->orWhere('user_agent', 'like', $term)
                    ->orWhere('created_at', 'like', $term)
                    ->orWhereRaw('CAST(properties AS CHAR) LIKE ?', [$term])
                    ->orWhereHas('user', function ($user) use ($term) {
                        $user->where('name', 'like', $term)->orWhere('email', 'like', $term);
                    });

                if (ctype_digit($value)) {
                    $query->orWhere('id', (int) $value)->orWhere('subject_id', (int) $value);
                }
            });
        }

        if (! empty($filters['date'])) {
            $query->whereDate('created_at', $filters['date']);
        }

        return Spa::render('Admin/AuditLogs/Index', [
            'logs' => $query->paginate(20)->withQueryString(),
            'filters' => [
                'q' => $filters['q'] ?? '',
                'date' => $filters['date'] ?? '',
            ],
        ]);
    }
}
