<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BlogCategory;
use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use App\Support\Spa;

class BlogController extends Controller
{
    public function index(Request $request)
    {
        $query = BlogPost::query()
            ->with(['category', 'tags', 'author:id,name'])
            ->latest('updated_at');

        if ($request->filled('q')) {
            $search = trim($request->q);
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', '%'.$search.'%')
                    ->orWhere('excerpt', 'like', '%'.$search.'%');
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('category')) {
            $query->whereHas('category', fn ($q) => $q->where('slug', $request->category));
        }

        return Spa::render('Admin/Blogs/Index', [
            'posts' => $query->paginate(12)->withQueryString(),
            'filters' => [
                'q' => $request->string('q')->toString(),
                'status' => $request->string('status')->toString(),
                'category' => $request->string('category')->toString(),
            ],
            'categories' => BlogCategory::orderBy('sort_order')->orderBy('name')->get(),
            'statuses' => BlogPost::STATUSES,
        ]);
    }

    public function create()
    {
        return Spa::render('Admin/Blogs/Create', $this->formOptions());
    }

    public function edit(BlogPost $blog)
    {
        $blog->load(['category', 'tags', 'author:id,name']);

        return Spa::render('Admin/Blogs/Edit', array_merge($this->formOptions(), [
            'post' => $blog,
        ]));
    }

    public function store(Request $request, AuditLogService $auditLogService)
    {
        $validated = $this->validated($request);

        $post = DB::transaction(function () use ($request, $validated) {
            $post = BlogPost::create(array_merge($this->payload($request, $validated), [
                'user_id' => $request->user()?->id,
            ]));

            if ($request->hasFile('cover_image')) {
                $post->update(['cover_image_path' => $this->storeCoverImage($request, $post)]);
            }

            $this->syncTags($post, $validated['tags'] ?? '');

            return $post;
        });

        $auditLogService->record('blog.created', $post, ['title' => $post->title], $request);

        return redirect()->route('admin.blogs.index')->with('success', 'Blog post created.');
    }

    public function update(Request $request, BlogPost $blog, AuditLogService $auditLogService)
    {
        $validated = $this->validated($request, $blog);

        DB::transaction(function () use ($request, $validated, $blog) {
            $blog->update($this->payload($request, $validated, $blog));

            if ($request->boolean('remove_cover_image')) {
                $this->deletePublicFile($blog->cover_image_path);
                $blog->update(['cover_image_path' => null]);
            }

            if ($request->hasFile('cover_image')) {
                $this->deletePublicFile($blog->cover_image_path);
                $blog->update(['cover_image_path' => $this->storeCoverImage($request, $blog)]);
            }

            $this->syncTags($blog, $validated['tags'] ?? '');
        });

        $auditLogService->record('blog.updated', $blog, ['title' => $blog->title], $request);

        return redirect()->route('admin.blogs.index')->with('success', 'Blog post updated.');
    }

    public function destroy(Request $request, BlogPost $blog, AuditLogService $auditLogService)
    {
        $auditLogService->record('blog.deleted', $blog, ['title' => $blog->title], $request);
        $this->deletePublicFile($blog->cover_image_path);
        $blog->delete();

        return back()->with('success', 'Blog post deleted.');
    }

    private function formOptions(): array
    {
        return [
            'categories' => BlogCategory::orderBy('sort_order')->orderBy('name')->get(),
            'tags' => BlogTag::orderBy('name')->get(),
            'statuses' => BlogPost::STATUSES,
        ];
    }

    private function validated(Request $request, ?BlogPost $post = null): array
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:180'],
            'slug' => ['nullable', 'string', 'max:200'],
            'excerpt' => ['nullable', 'string', 'max:600'],
            'content' => ['nullable', 'string'],
            'blog_category_id' => ['nullable', 'integer', 'exists:blog_categories,id'],
            'category_name' => ['nullable', 'string', 'max:120'],
            'tags' => ['nullable', 'string', 'max:700'],
            'youtube_url' => ['nullable', 'url', 'max:500'],
            'status' => ['required', Rule::in(BlogPost::STATUSES)],
            'published_at' => ['nullable', 'date'],
            'cover_image' => ['nullable', 'file', 'max:4096'],
            'remove_cover_image' => ['nullable', 'boolean'],
        ]);

        if ($request->hasFile('cover_image')) {
            $extension = strtolower($request->file('cover_image')->getClientOriginalExtension());
            $allowed = ['jpg', 'jpeg', 'png', 'webp'];

            if (! in_array($extension, $allowed, true)) {
                throw ValidationException::withMessages([
                    'cover_image' => 'The cover image must be a '.implode(', ', $allowed).' file.',
                ]);
            }
        }

        if (! empty($validated['youtube_url']) && ! $this->youtubeVideoId($validated['youtube_url'])) {
            throw ValidationException::withMessages([
                'youtube_url' => 'Enter a valid YouTube video URL.',
            ]);
        }

        return $validated;
    }

    private function payload(Request $request, array $validated, ?BlogPost $post = null): array
    {
        $youtubeUrl = $validated['youtube_url'] ?? null;
        $status = $validated['status'];
        $publishedAt = $validated['published_at'] ?? null;

        if ($status === BlogPost::STATUS_PUBLISHED && ! $publishedAt) {
            $publishedAt = now();
        }

        return [
            'blog_category_id' => $this->categoryId($validated),
            'title' => trim($validated['title']),
            'slug' => $this->uniqueSlug($validated['slug'] ?: $validated['title'], $post),
            'excerpt' => $validated['excerpt'] ? trim($validated['excerpt']) : null,
            'content' => $this->cleanContent($validated['content'] ?? ''),
            'youtube_url' => $youtubeUrl,
            'youtube_video_id' => $youtubeUrl ? $this->youtubeVideoId($youtubeUrl) : null,
            'status' => $status,
            'published_at' => $publishedAt,
        ];
    }

    private function categoryId(array $validated): ?int
    {
        if (! empty($validated['category_name'])) {
            $name = trim($validated['category_name']);
            $baseSlug = Str::slug($name) ?: 'category';
            $existing = BlogCategory::where('slug', $baseSlug)->first();

            if ($existing) {
                return $existing->id;
            }

            return BlogCategory::firstOrCreate(
                ['slug' => $this->uniqueCategorySlug($name)],
                ['name' => $name, 'is_active' => true]
            )->id;
        }

        return $validated['blog_category_id'] ?? null;
    }

    private function syncTags(BlogPost $post, string $tags): void
    {
        $tagIds = collect(explode(',', $tags))
            ->map(fn ($tag) => trim($tag))
            ->filter()
            ->unique(fn ($tag) => Str::lower($tag))
            ->take(12)
            ->map(function ($name) {
                $slug = Str::slug($name);
                if (! $slug) {
                    return null;
                }

                return BlogTag::firstOrCreate(['slug' => $slug], ['name' => $name])->id;
            })
            ->filter()
            ->values()
            ->all();

        $post->tags()->sync($tagIds);
    }

    private function uniqueSlug(string $value, ?BlogPost $ignore = null): string
    {
        $base = Str::slug($value) ?: 'blog-post';
        $slug = $base;
        $counter = 2;

        while (BlogPost::withTrashed()
            ->where('slug', $slug)
            ->when($ignore, fn ($query) => $query->whereKeyNot($ignore->id))
            ->exists()
        ) {
            $slug = $base.'-'.$counter++;
        }

        return $slug;
    }

    private function uniqueCategorySlug(string $value): string
    {
        $base = Str::slug($value) ?: 'category';
        $slug = $base;
        $counter = 2;

        while (BlogCategory::where('slug', $slug)->exists()) {
            $slug = $base.'-'.$counter++;
        }

        return $slug;
    }

    private function youtubeVideoId(string $url): ?string
    {
        $patterns = [
            '/youtu\.be\/([A-Za-z0-9_-]{11})/',
            '/youtube\.com\/watch\?.*v=([A-Za-z0-9_-]{11})/',
            '/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/',
            '/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $url, $matches)) {
                return $matches[1];
            }
        }

        return null;
    }

    private function cleanContent(string $content): string
    {
        $content = preg_replace('#<(script|style)\b[^>]*>.*?</\1>#is', '', $content) ?? '';
        $content = strip_tags($content, '<p><br><strong><b><em><i><u><s><ul><ol><li><blockquote><h2><h3><h4><a>');
        $content = preg_replace('/\s+on[a-z]+\s*=\s*(["\']).*?\1/i', '', $content) ?? '';
        $content = preg_replace('/href\s*=\s*(["\'])\s*javascript:.*?\1/i', 'href="#"', $content) ?? '';

        return trim($content);
    }

    private function storeCoverImage(Request $request, BlogPost $post): string
    {
        $file = $request->file('cover_image');
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'jpg');

        return $file->storeAs('blogs', 'blog-'.$post->id.'-'.time().'.'.$extension, 'public');
    }

    private function deletePublicFile(?string $path): void
    {
        if (! $path || str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return;
        }

        Storage::disk('public')->delete($path);
    }
}
