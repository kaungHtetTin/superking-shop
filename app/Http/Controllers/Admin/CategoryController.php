<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Category;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use App\Support\Spa;

class CategoryController extends Controller
{
    public function index()
    {
        return Spa::render('Admin/Categories/Index', [
            'categories' => Category::with('parent')->latest()->paginate(15)->withQueryString(),
            'parentCategories' => Category::whereNull('parent_id')->where('is_active', true)->get()
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'parent_id' => 'nullable|exists:categories,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'icon' => 'nullable|string',
            'icon_image' => 'nullable|file|max:2048',
            'metadata' => 'nullable|array',
            'sort_order' => 'nullable|integer',
            'homepage_featured' => 'nullable|boolean',
        ]);

        $this->ensureAllowedUpload($request, 'icon_image');

        $validated['slug'] = Str::slug($validated['name']);
        $metadata = $validated['metadata'] ?? [];
        $metadata['homepage_featured'] = (bool) ($validated['homepage_featured'] ?? true);
        unset($validated['icon_image'], $validated['homepage_featured']);
        $validated['metadata'] = $metadata;

        $category = Category::create($validated);
        if ($request->hasFile('icon_image')) {
            $metadata['icon_image_path'] = $this->storeIconImage($request, $category);
            $category->update(['metadata' => $metadata]);
        }

        return redirect()->back()->with('success', 'Category created successfully.');
    }

    public function update(Request $request, Category $category)
    {
        $validated = $request->validate([
            'parent_id' => 'nullable|exists:categories,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'icon' => 'nullable|string',
            'icon_image' => 'nullable|file|max:2048',
            'remove_icon_image' => 'nullable|boolean',
            'metadata' => 'nullable|array',
            'is_active' => 'required|boolean',
            'sort_order' => 'nullable|integer',
            'homepage_featured' => 'nullable|boolean',
        ]);

        $this->ensureAllowedUpload($request, 'icon_image');

        $validated['slug'] = Str::slug($validated['name']);
        $metadata = array_merge($category->metadata ?? [], $validated['metadata'] ?? []);
        $metadata['homepage_featured'] = (bool) ($validated['homepage_featured'] ?? false);

        if ($request->boolean('remove_icon_image')) {
            $this->deletePublicFile($metadata['icon_image_path'] ?? null);
            unset($metadata['icon_image_path']);
        }

        if ($request->hasFile('icon_image')) {
            $this->deletePublicFile($metadata['icon_image_path'] ?? null);
            $metadata['icon_image_path'] = $this->storeIconImage($request, $category);
        }

        unset($validated['icon_image'], $validated['remove_icon_image'], $validated['homepage_featured']);
        $validated['metadata'] = $metadata;

        $category->update($validated);

        return redirect()->back()->with('success', 'Category updated successfully.');
    }

    public function destroy(Category $category)
    {
        $category->delete();

        return redirect()->back()->with('success', 'Category deleted successfully.');
    }

    private function ensureAllowedUpload(Request $request, string $fileKey): void
    {
        if (! $request->hasFile($fileKey)) {
            return;
        }

        $extension = strtolower($request->file($fileKey)->getClientOriginalExtension());
        $allowed = ['jpg', 'jpeg', 'png', 'webp', 'svg'];

        if (! in_array($extension, $allowed, true)) {
            throw ValidationException::withMessages([
                $fileKey => 'The category image must be a '.implode(', ', $allowed).' file.',
            ]);
        }
    }

    private function storeIconImage(Request $request, Category $category): string
    {
        $file = $request->file('icon_image');
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension());

        return $file->storeAs('categories', 'category-'.$category->id.'-'.time().'.'.$extension, 'public');
    }

    private function deletePublicFile(?string $path): void
    {
        if (! $path || str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return;
        }

        Storage::disk('public')->delete($path);
    }
}
