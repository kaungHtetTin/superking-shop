<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\StorefrontBlock;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use App\Support\Spa;

class StorefrontController extends Controller
{
    public function edit()
    {
        $this->ensureDefaults();

        return Spa::render('Admin/Storefront/Index', [
            'hero' => StorefrontBlock::where('type', StorefrontBlock::TYPE_HERO)->orderBy('id')->first(),
            'promos' => StorefrontBlock::where('type', StorefrontBlock::TYPE_PROMO)->orderBy('sort_order')->orderBy('id')->get(),
            'sections' => StorefrontBlock::where('type', StorefrontBlock::TYPE_SECTION)->where('key', '!=', 'newsletter')->orderBy('sort_order')->orderBy('id')->get(),
        ]);
    }

    public function update(Request $request, AuditLogService $auditLogService)
    {
        $this->ensureDefaults();

        $validated = $request->validate([
            'hero' => ['required', 'array'],
            'hero.id' => ['nullable', 'integer', 'exists:storefront_blocks,id'],
            'hero.title' => ['nullable', 'string', 'max:120'],
            'hero.subtitle' => ['nullable', 'string', 'max:255'],
            'hero.button_label' => ['nullable', 'string', 'max:60'],
            'hero.link_url' => ['nullable', 'string', 'max:255'],
            'hero.accent_color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'hero.is_active' => ['nullable', 'boolean'],
            'hero.remove_image' => ['nullable', 'boolean'],
            'hero.image' => ['nullable', 'file', 'max:5120'],
            'promos' => ['nullable', 'array'],
            'promos.*.id' => ['nullable', 'integer', 'exists:storefront_blocks,id'],
            'promos.*.title' => ['nullable', 'string', 'max:120'],
            'promos.*.subtitle' => ['nullable', 'string', 'max:255'],
            'promos.*.button_label' => ['nullable', 'string', 'max:60'],
            'promos.*.link_url' => ['nullable', 'string', 'max:255'],
            'promos.*.accent_color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'promos.*.sort_order' => ['nullable', 'integer'],
            'promos.*.is_active' => ['nullable', 'boolean'],
            'promos.*.remove_image' => ['nullable', 'boolean'],
            'promos.*.image' => ['nullable', 'file', 'max:5120'],
            'sections' => ['nullable', 'array'],
            'sections.*.id' => ['nullable', 'integer', 'exists:storefront_blocks,id'],
            'sections.*.key' => ['required', 'string', Rule::in(['categories', 'flash_sale', 'promos', 'best_sellers', 'blogs'])],
            'sections.*.title' => ['nullable', 'string', 'max:120'],
            'sections.*.subtitle' => ['nullable', 'string', 'max:255'],
            'sections.*.sort_order' => ['nullable', 'integer'],
            'sections.*.is_active' => ['nullable', 'boolean'],
        ]);

        $this->ensureAllowedUpload($request, 'hero.image');
        foreach (array_keys($request->input('promos', [])) as $index) {
            $this->ensureAllowedUpload($request, "promos.{$index}.image");
        }

        $hero = StorefrontBlock::where('type', StorefrontBlock::TYPE_HERO)->orderBy('id')->firstOrFail();
        $this->fillBlock($hero, $validated['hero'], StorefrontBlock::TYPE_HERO, 'home');
        $hero->image_path = $this->resolveUpload($request, 'hero.image', (bool) ($validated['hero']['remove_image'] ?? false), $hero->image_path, 'hero');
        $hero->save();

        foreach ($validated['promos'] ?? [] as $index => $promoData) {
            $promo = StorefrontBlock::where('type', StorefrontBlock::TYPE_PROMO)
                ->whereKey($promoData['id'] ?? null)
                ->first() ?: new StorefrontBlock(['type' => StorefrontBlock::TYPE_PROMO]);

            $this->fillBlock($promo, $promoData, StorefrontBlock::TYPE_PROMO, $promo->key ?: 'promo-'.$index);
            $promo->image_path = $this->resolveUpload(
                $request,
                "promos.{$index}.image",
                (bool) ($promoData['remove_image'] ?? false),
                $promo->image_path,
                'promo-'.$index,
            );
            $promo->save();
        }

        foreach ($validated['sections'] ?? [] as $sectionData) {
            $section = StorefrontBlock::where('type', StorefrontBlock::TYPE_SECTION)
                ->where('key', $sectionData['key'])
                ->firstOrFail();

            $section->forceFill([
                'title' => $sectionData['title'] ?? null,
                'subtitle' => $sectionData['subtitle'] ?? null,
                'sort_order' => (int) ($sectionData['sort_order'] ?? $section->sort_order),
                'is_active' => (bool) ($sectionData['is_active'] ?? false),
            ])->save();
        }

        $auditLogService->record('storefront.updated', null, [
            'hero' => $hero->only(['title', 'is_active']),
            'promos' => count($validated['promos'] ?? []),
        ], $request);

        return back()->with('success', 'Storefront decoration updated.');
    }

    private function fillBlock(StorefrontBlock $block, array $data, string $type, string $key): void
    {
        $block->forceFill([
            'type' => $type,
            'key' => $block->key ?: $key,
            'title' => $data['title'] ?? null,
            'subtitle' => $data['subtitle'] ?? null,
            'button_label' => $data['button_label'] ?? null,
            'link_url' => $data['link_url'] ?? null,
            'accent_color' => strtolower($data['accent_color'] ?? '#087f74'),
            'sort_order' => (int) ($data['sort_order'] ?? 0),
            'is_active' => (bool) ($data['is_active'] ?? false),
        ]);
    }

    private function ensureDefaults(): void
    {
        StorefrontBlock::firstOrCreate(
            ['type' => StorefrontBlock::TYPE_HERO, 'key' => 'home'],
            [
                'title' => 'Fresh picks for every occasion',
                'subtitle' => 'Discover customer favorites, seasonal gifts, and new arrivals curated for today.',
                'button_label' => 'Shop now',
                'link_url' => '/products',
                'accent_color' => '#087f74',
                'sort_order' => 1,
                'is_active' => true,
            ],
        );

        $promos = [
            ['key' => 'editors-picks', 'title' => "Editor's Picks", 'subtitle' => 'Handpicked favorites', 'link_url' => '/products', 'button_label' => 'Explore', 'accent_color' => '#fce4ec', 'sort_order' => 1],
            ['key' => 'new-arrivals', 'title' => 'New Arrivals', 'subtitle' => 'Latest drops', 'link_url' => '/products?sort=newest', 'button_label' => 'View new', 'accent_color' => '#f3e5f5', 'sort_order' => 2],
        ];

        foreach ($promos as $promo) {
            StorefrontBlock::firstOrCreate(
                ['type' => StorefrontBlock::TYPE_PROMO, 'key' => $promo['key']],
                array_merge($promo, ['is_active' => true]),
            );
        }

        $sections = [
            ['key' => 'categories', 'title' => 'Categories', 'subtitle' => null, 'sort_order' => 1, 'is_active' => true],
            ['key' => 'flash_sale', 'title' => null, 'subtitle' => null, 'sort_order' => 2, 'is_active' => true],
            ['key' => 'promos', 'title' => null, 'subtitle' => null, 'sort_order' => 3, 'is_active' => true],
            ['key' => 'best_sellers', 'title' => 'Best Sellers', 'subtitle' => null, 'sort_order' => 4, 'is_active' => true],
            ['key' => 'blogs', 'title' => 'Ideas and guides', 'subtitle' => 'Fresh shopping inspiration from our team.', 'sort_order' => 5, 'is_active' => true],
        ];

        foreach ($sections as $section) {
            StorefrontBlock::firstOrCreate(
                ['type' => StorefrontBlock::TYPE_SECTION, 'key' => $section['key']],
                $section,
            );
        }
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
                $fileKey => 'The image must be a '.implode(', ', $allowed).' file.',
            ]);
        }
    }

    private function resolveUpload(Request $request, string $fileKey, bool $remove, ?string $currentPath, string $name): ?string
    {
        if ($remove) {
            $this->deletePublicFile($currentPath);

            return null;
        }

        if (! $request->hasFile($fileKey)) {
            return $currentPath;
        }

        $this->deletePublicFile($currentPath);
        $file = $request->file($fileKey);
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension());

        return $file->storeAs('storefront', $name.'-'.time().'.'.$extension, 'public');
    }

    private function deletePublicFile(?string $path): void
    {
        if (! $path || str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return;
        }

        Storage::disk('public')->delete($path);
    }
}
