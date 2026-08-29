<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Models\BlogCategory;
use App\Models\BlogPost;
use App\Models\BlogTag;
use Illuminate\Http\Request;
use App\Support\Spa;

class BlogController extends Controller
{
    public function index(Request $request)
    {
        $query = BlogPost::query()
            ->published()
            ->with(['category', 'tags', 'author:id,name'])
            ->latest('published_at');

        if ($request->filled('q')) {
            $search = trim($request->q);
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', '%'.$search.'%')
                    ->orWhere('excerpt', 'like', '%'.$search.'%');
            });
        }

        if ($request->filled('category')) {
            $query->whereHas('category', fn ($q) => $q->where('slug', $request->category)->active());
        }

        if ($request->filled('tag')) {
            $query->whereHas('tags', fn ($q) => $q->where('slug', $request->tag));
        }

        return Spa::render('User/Blogs/Index', [
            'posts' => $query->paginate(9)->withQueryString(),
            'filters' => [
                'q' => $request->string('q')->toString(),
                'category' => $request->string('category')->toString(),
                'tag' => $request->string('tag')->toString(),
            ],
            'categories' => BlogCategory::active()
                ->withCount(['posts' => fn ($q) => $q->published()])
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
            'tags' => BlogTag::query()
                ->withCount(['posts' => fn ($q) => $q->published()])
                ->orderBy('name')
                ->get()
                ->filter(fn ($tag) => $tag->posts_count > 0)
                ->values(),
        ]);
    }

    public function show(string $slug)
    {
        $post = BlogPost::query()
            ->published()
            ->with(['category', 'tags', 'author:id,name'])
            ->where(fn ($query) => $query
                ->where('slug', $slug)
                ->when(ctype_digit($slug), fn ($query) => $query->orWhere('id', (int) $slug)))
            ->firstOrFail();

        $related = BlogPost::query()
            ->published()
            ->with(['category', 'tags'])
            ->whereKeyNot($post->id)
            ->when($post->blog_category_id, fn ($q) => $q->where('blog_category_id', $post->blog_category_id))
            ->latest('published_at')
            ->take(3)
            ->get();

        return Spa::render('User/Blogs/Show', [
            'post' => $post,
            'related' => $related,
        ]);
    }
}
