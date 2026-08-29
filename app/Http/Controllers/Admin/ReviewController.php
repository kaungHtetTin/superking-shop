<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Review;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use App\Support\Spa;

class ReviewController extends Controller
{
    public function index(Request $request)
    {
        $query = Review::query()->with(['user:id,name,email', 'product:id,name,slug']);

        if ($request->filled('status')) {
            $query->where('is_approved', $request->status === 'approved');
        }

        if ($request->filled('q')) {
            $term = '%'.trim($request->q).'%';
            $query->where(function ($q) use ($term) {
                $q->where('comment', 'like', $term)
                    ->orWhereHas('product', fn ($p) => $p->where('name', 'like', $term))
                    ->orWhereHas('user', fn ($u) => $u->where('name', 'like', $term)->orWhere('email', 'like', $term));
            });
        }

        return Spa::render('Admin/Reviews/Index', [
            'reviews' => $query->latest()->paginate(15)->withQueryString(),
            'filters' => [
                'q' => $request->string('q')->toString(),
                'status' => $request->string('status')->toString(),
            ],
        ]);
    }

    public function update(Request $request, Review $review, AuditLogService $auditLogService)
    {
        $validated = $request->validate([
            'is_approved' => ['required', 'boolean'],
        ]);

        $review->update($validated);
        $this->refreshProductRating($review->product_id);
        $auditLogService->record('review.moderated', $review, [
            'is_approved' => $review->is_approved,
        ], $request);

        return back()->with('success', 'Review status updated.');
    }

    public function destroy(Request $request, Review $review, AuditLogService $auditLogService)
    {
        $productId = $review->product_id;
        $auditLogService->record('review.deleted', $review, [
            'product_id' => $review->product_id,
            'user_id' => $review->user_id,
        ], $request);
        $review->delete();
        $this->refreshProductRating($productId);

        return back()->with('success', 'Review deleted.');
    }

    private function refreshProductRating(int $productId): void
    {
        $stats = Review::query()
            ->where('product_id', $productId)
            ->where('is_approved', true)
            ->selectRaw('COALESCE(AVG(rating), 0) as avg_rating, COUNT(*) as review_count')
            ->first();

        Product::whereKey($productId)->update([
            'rating' => round((float) ($stats->avg_rating ?? 0), 2),
            'review_count' => (int) ($stats->review_count ?? 0),
        ]);
    }
}
