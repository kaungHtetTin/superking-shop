<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\HeldCart;
use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\Order;
use App\Models\PosRegister;
use App\Models\PosShift;
use App\Models\ProductUnit;
use App\Models\ProductPriceType;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\POS\PosCheckoutService;
use App\Services\POS\PosShiftService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use App\Support\Spa;

class PosController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->hasAdminPermission('pos.access') && config('inventory.pos_enabled', true), 403);

        $locationIds = $request->user()->accessibleLocationIds();
        $locations = Location::query()
            ->whereIn('id', $locationIds)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'type']);

        $categories = Category::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'parent_id', 'name']);

        return Spa::render('Admin/POS/Index', [
            'locations' => $locations,
            'categories' => $categories,
            'priceTypes' => ProductPriceType::query()
                ->whereHas('product', fn ($query) => $query->where('status', 'active')->where('is_active', true))
                ->orderBy('name')
                ->pluck('name')
                ->unique()
                ->sortBy(fn ($name) => $name === 'retail' ? '0' : '1'.$name)
                ->values(),
            'can' => [
                'discount' => $request->user()->hasAdminPermission('pos.discount'),
                'credit' => $request->user()->hasAdminPermission('credit.manage'),
                'manageRegisters' => $request->user()->hasAdminPermission('registers.manage'),
            ],
            'registers' => PosRegister::query()->whereIn('location_id', $locationIds)->where('is_active', true)
                ->orderBy('name')->get(['id', 'location_id', 'code', 'name']),
        ]);
    }

    public function activeShift(Request $request, PosShiftService $service)
    {
        $validated = $request->validate(['location_id' => ['required', 'integer', 'exists:locations,id']]);
        $location = Location::query()->where('is_active', true)->findOrFail($validated['location_id']);
        abort_unless($request->user()->canAccessLocation($location), 403);
        $shift = $service->active($request->user(), $location);

        return response()->json(['shift' => $shift ? $service->summary($shift) : null]);
    }

    public function shiftHistory(Request $request, PosShiftService $service)
    {
        $user = $request->user();
        $locationIds = $user->accessibleLocationIds();
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['open', 'closed'])],
            'location_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $canViewAllCashiers = $user->hasAdminPermission('registers.manage')
            || $user->hasAdminPermission('locations.manage')
            || $user->hasAdminPermission('reports.sales')
            || $user->hasAdminPermission('view_reports');

        $query = PosShift::query()
            ->with([
                'cashier:id,name,email',
                'closedBy:id,name',
                'register:id,location_id,code,name',
                'location:id,code,name',
            ])
            ->whereIn('location_id', $locationIds)
            ->when(! $canViewAllCashiers, fn ($builder) => $builder->where('cashier_id', $user->id))
            ->when($filters['status'] ?? null, fn ($builder, $status) => $builder->where('status', $status))
            ->when($filters['location_id'] ?? null, function ($builder, $locationId) use ($locationIds) {
                $builder->where('location_id', in_array((int) $locationId, array_map('intval', $locationIds), true) ? $locationId : -1);
            })
            ->when($filters['from'] ?? null, fn ($builder, $date) => $builder->whereDate('opened_at', '>=', $date))
            ->when($filters['to'] ?? null, fn ($builder, $date) => $builder->whereDate('opened_at', '<=', $date))
            ->when($filters['q'] ?? null, function ($builder, $search) {
                $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], trim($search)).'%';
                $builder->where(function ($nested) use ($like) {
                    $nested->whereHas('cashier', fn ($cashier) => $cashier->where('name', 'like', $like)->orWhere('email', 'like', $like))
                        ->orWhereHas('register', fn ($register) => $register->where('name', 'like', $like)->orWhere('code', 'like', $like));
                });
            });

        $summaryQuery = clone $query;
        $shifts = $query->latest('opened_at')->paginate(20)->withQueryString();
        $shifts->through(function (PosShift $shift) use ($service) {
            $shift->setAttribute('calculated_summary', $service->summary($shift));
            return $shift;
        });

        return Spa::render('Admin/POS/Shifts/Index', [
            'shifts' => $shifts,
            'locations' => Location::query()->whereIn('id', $locationIds)->orderBy('name')->get(['id', 'code', 'name']),
            'filters' => [
                'q' => $filters['q'] ?? '',
                'status' => $filters['status'] ?? '',
                'location_id' => $filters['location_id'] ?? '',
                'from' => $filters['from'] ?? '',
                'to' => $filters['to'] ?? '',
            ],
            'stats' => [
                'total' => (clone $summaryQuery)->count(),
                'open' => (clone $summaryQuery)->where('status', 'open')->count(),
                'closed' => (clone $summaryQuery)->where('status', 'closed')->count(),
                'variance' => (float) (clone $summaryQuery)->where('status', 'closed')->sum('variance'),
            ],
            'canViewAllCashiers' => $canViewAllCashiers,
        ]);
    }

    public function openShift(Request $request, PosShiftService $service, AuditLogService $audit)
    {
        $validated = $request->validate([
            'location_id' => ['required', 'integer', 'exists:locations,id'],
            'register_id' => ['required', 'integer', 'exists:pos_registers,id'],
            'opening_cash' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);
        $location = Location::query()->where('is_active', true)->findOrFail($validated['location_id']);
        abort_unless($request->user()->canAccessLocation($location), 403);
        $register = PosRegister::query()->findOrFail($validated['register_id']);
        $shift = $service->open($request->user(), $location, $register, (float) $validated['opening_cash'], $validated['notes'] ?? null);
        $audit->record('pos.shift.opened', $shift, ['location_id' => $location->id, 'register_id' => $register->id], $request);

        return response()->json(['shift' => $service->summary($shift)], 201);
    }

    public function closeShift(Request $request, PosShift $shift, PosShiftService $service, AuditLogService $audit)
    {
        $validated = $request->validate([
            'counted_cash' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);
        $closed = $service->close($shift, $request->user(), (float) $validated['counted_cash'], $validated['notes'] ?? null);
        $audit->record('pos.shift.closed', $closed, ['variance' => $closed->variance], $request);

        return response()->json(['message' => 'Shift closed successfully.', 'shift' => $closed]);
    }

    public function products(Request $request)
    {
        abort_unless($request->user()->hasAdminPermission('pos.access'), 403);
        $validated = $request->validate([
            'location_id' => ['required', 'integer', 'exists:locations,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'q' => ['nullable', 'string', 'max:120'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:12', 'max:60'],
        ]);

        $location = Location::query()->where('is_active', true)->findOrFail($validated['location_id']);
        abort_unless($request->user()->canAccessLocation($location), 403);

        $term = trim($validated['q'] ?? '');
        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 24);

        $products = ProductUnit::query()
            ->where('is_active', true)
            ->where('is_default_selling', true)
            ->with([
                'prices',
                'product:id,product_code,barcode,name,status,is_active,category_id',
                'product.primaryImage:id,product_id,image_path',
                'product.inventoryBalances' => fn ($query) => $query->where('location_id', $location->id),
                'product.units' => fn ($query) => $query
                    ->where('is_active', true)
                    ->with('prices')
                    ->orderByDesc('is_default_selling')
                    ->orderBy('sort_order'),
            ])
            ->withSum([
                'orderItems as pos_sold_qty' => fn ($query) => $query->whereHas('order', fn ($order) => $order
                    ->where('sales_channel', 'pos')
                    ->where('location_id', $location->id)),
            ], 'quantity')
            ->when(! empty($validated['category_id']), function ($query) use ($validated) {
                $query->whereHas('product', fn ($product) => $product->where('category_id', $validated['category_id']));
            })
            ->when($term !== '', function ($query) use ($term) {
                $query->where(function ($inner) use ($term) {
                    $inner->where('code', 'like', "%{$term}%")
                        ->orWhereHas('product', fn ($product) => $product
                            ->where('name', 'like', "%{$term}%")
                            ->orWhere('product_code', 'like', "%{$term}%")
                            ->orWhere('barcode', 'like', "%{$term}%")
                            ->orWhereHas('units', fn ($units) => $units->where('is_active', true)->where(fn ($unit) => $unit
                                ->where('name', 'like', "%{$term}%")
                                ->orWhere('code', 'like', "%{$term}%"))));
                });
            })
            ->whereHas('product', fn ($product) => $product->where('status', 'active')->where('is_active', true))
            ->when($term !== '', function ($query) use ($term) {
                $query->orderByRaw(
                    'CASE WHEN EXISTS (SELECT 1 FROM products WHERE products.id = product_units.product_id AND products.barcode = ?) AND product_units.is_default_selling = 1 THEN 0 WHEN product_units.code = ? THEN 1 ELSE 2 END',
                    [$term, $term]
                );
            })
            ->orderByDesc('pos_sold_qty')
            ->orderByDesc('is_default_selling')
            ->orderBy('sort_order')
            ->offset(($page - 1) * $perPage)
            ->limit($perPage + 1)
            ->get()
            ->map(function (ProductUnit $unit) {
                $balance = $unit->product->inventoryBalances->first();
                $availableBaseQuantity = (float) ($balance?->available_qty ?? 0);
                $factor = max((float) $unit->conversion_factor, 0.000001);
                $baseUnit = $unit->product->units->firstWhere('is_base', true);
                $basePrices = $baseUnit?->prices?->keyBy('price_type') ?? collect();
                $effectivePrices = function (ProductUnit $option) use ($basePrices) {
                    $factor = max((float) $option->conversion_factor, 0.000001);

                    return $option->prices->map(function ($price) use ($basePrices, $factor) {
                        $configured = (float) $price->price;
                        $basePrice = (float) ($basePrices->get($price->price_type)?->price ?? 0);

                        return [
                            'price_type' => $price->price_type,
                            'price' => ! $price->is_manual && $price->calculation_status === 'cost_required' && $configured <= 0 ? 0 : ($configured > 0 ? $configured : round($basePrice * $factor, 2)),
                            'display_name' => $price->typeDefinition?->pricingRule?->name ?? $price->price_type,
                            'is_derived' => $configured <= 0 && $basePrice > 0,
                        ];
                    })->values();
                };
                $unitPrices = $effectivePrices($unit);

                return [
                    'id' => $unit->id,
                    'product_unit_id' => $unit->id,
                    'product_id' => $unit->product_id,
                    'product_code' => $unit->product->product_code,
                    'barcode' => $unit->product->barcode,
                    'unit_name' => $unit->name,
                    'unit_code' => $unit->code,
                    'conversion_factor' => (float) $unit->conversion_factor,
                    'is_base' => (bool) $unit->is_base,
                    'is_default_selling' => $unit->is_default_selling,
                    'product_name' => $unit->product->name,
                    'image_path' => $unit->product->primaryImage?->image_path,
                    'prices' => $unitPrices,
                    'price' => (float) ($unitPrices->firstWhere('price_type', 'retail')['price'] ?? 0),
                    'available_base_qty' => $availableBaseQuantity,
                    'available_qty' => floor((($availableBaseQuantity / $factor) + 0.0000001) * 10000) / 10000,
                    'unit_options' => $unit->product->units->map(function (ProductUnit $option) use ($availableBaseQuantity, $effectivePrices) {
                        $optionFactor = max((float) $option->conversion_factor, 0.000001);

                        return [
                            'id' => $option->id,
                            'name' => $option->name,
                            'code' => $option->code,
                            'conversion_factor' => (float) $option->conversion_factor,
                            'is_base' => $option->is_base,
                            'is_default_selling' => $option->is_default_selling,
                            'available_qty' => floor((($availableBaseQuantity / $optionFactor) + 0.0000001) * 10000) / 10000,
                            'prices' => $effectivePrices($option),
                        ];
                    })->values(),
                    'sold_qty' => (float) ($unit->pos_sold_qty ?? 0),
                ];
            });

        $hasMore = $products->count() > $perPage;

        return [
            'data' => $products->take($perPage)->values(),
            'meta' => [
                'page' => $page,
                'per_page' => $perPage,
                'has_more' => $hasMore,
                'next_page' => $hasMore ? $page + 1 : null,
                'mode' => $term === '' ? 'popular' : 'search',
            ],
        ];
    }

    public function customers(Request $request)
    {
        abort_unless($request->user()->hasAdminPermission('pos.access'), 403);
        $term = trim($request->string('q')->toString());

        return User::query()
            ->where('role', User::CUSTOMER_ROLE)
            ->when($term !== '', function ($query) use ($term) {
                $like = "%{$term}%";
                $query->where(fn ($inner) => $inner->where('name', 'like', $like)->orWhere('email', 'like', $like)->orWhere('phone', 'like', $like));
            })
            ->orderBy('name')
            ->limit(20)
            ->select(['id', 'name', 'email', 'phone', 'credit_limit', 'credit_terms_days', 'credit_status'])
            ->withSum('creditTransactions as credit_balance', 'amount')
            ->get()
            ->each(function (User $customer) {
                $customer->setAttribute('available_credit', max(0, round((float) $customer->credit_limit - (float) ($customer->credit_balance ?? 0), 2)));
            });
    }

    public function storeCustomer(Request $request, AuditLogService $audit): \Illuminate\Http\JsonResponse
    {
        abort_unless($request->user()->hasAdminPermission('pos.access'), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email:rfc', 'max:255', Rule::unique('users', 'email')],
            'phone' => ['nullable', 'string', 'max:30', Rule::unique('users', 'phone')],
        ]);

        $customer = User::create([
            'name' => trim($validated['name']),
            'email' => strtolower(trim($validated['email'])),
            'phone' => filled($validated['phone'] ?? null) ? trim($validated['phone']) : null,
            'password' => Hash::make(Str::random(40)),
            'role' => User::CUSTOMER_ROLE,
            'status' => 'active',
            'auth_provider' => 'email',
            'credit_status' => 'disabled',
        ]);

        $audit->record('customer.created_from_pos', $customer, [
            'email' => $customer->email,
            'phone' => $customer->phone,
        ], $request);

        $customer->setAttribute('credit_balance', 0);
        $customer->setAttribute('available_credit', 0);

        return response()->json(['customer' => $customer->only([
            'id', 'name', 'email', 'phone', 'credit_limit', 'credit_terms_days',
            'credit_status', 'credit_balance', 'available_credit',
        ])], 201);
    }

    public function prices(Request $request)
    {
        $validated = $request->validate(['unit_ids' => ['required', 'array', 'max:200'], 'unit_ids.*' => ['integer']]);
        return ProductUnit::whereIn('id', $validated['unit_ids'])->where('is_active', true)
            ->whereHas('product', fn ($q) => $q->where('status', 'active')->where('is_active', true))
            ->with(['prices', 'product.baseUnit.prices'])->get()->map(fn ($unit) => [
                'id' => $unit->id,
                'prices' => $unit->prices->map(function ($price) use ($unit) {
                    $base = (float) ($unit->product->baseUnit?->priceFor($price->price_type)?->price ?? 0);
                    $amount = $unit->hasUnavailableAutomaticPrice($price->price_type) ? 0 : ((float) $price->price > 0 ? (float) $price->price : round($base * (float) $unit->conversion_factor, 2));
                    return ['price_type' => $price->price_type, 'price' => $amount, 'display_name' => $price->typeDefinition?->pricingRule?->name ?? $price->price_type];
                })->values(),
            ])->values();
    }

    public function checkout(Request $request, PosCheckoutService $service)
    {
        abort_unless($request->user()->hasAdminPermission('pos.access'), 403);
        $validated = $request->validate([
            'location_id' => ['required', 'integer', 'exists:locations,id'],
            'shift_id' => ['required', 'integer', 'exists:pos_shifts,id'],
            'customer_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('role', User::CUSTOMER_ROLE)],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:50'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_unit_id' => ['required', 'integer', 'exists:product_units,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0', 'max:9999'],
            'items.*.price_type' => ['required', 'string', 'max:60'],
            'items.*.expected_unit_price' => ['sometimes', 'numeric', 'min:0'],
            'items.*.foc_quantity' => ['sometimes', 'numeric', 'min:0', 'max:9999'],
            'items.*.foc_product_unit_id' => ['nullable', 'integer', 'exists:product_units,id'],
            'discount_type' => ['nullable', 'string', Rule::in(['percent', 'amount'])],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'tender_type' => ['required', 'string', Rule::in(['cash', 'mmqr', 'credit'])],
            'credit_deposit_method' => ['nullable', 'string', Rule::in(['cash', 'mmqr'])],
            'amount_tendered' => ['required', 'numeric', 'min:0'],
            'payment_details' => ['nullable', 'array'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            $order = $service->checkout($validated, $request->user());
        } catch (ValidationException $exception) {
            return response()->json(['errors' => $exception->errors()], 422);
        }

        return response()->json([
            'order' => $order,
            'receipt_url' => route('admin.pos.orders.receipt', $order),
        ]);
    }

    public function holdCart(Request $request, AuditLogService $audit)
    {
        abort_unless($request->user()->hasAdminPermission('pos.hold'), 403);
        $validated = $request->validate([
            'location_id' => ['required', 'integer', 'exists:locations,id'],
            'register_id' => ['required', 'integer', 'exists:pos_registers,id'],
            'customer_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('role', User::CUSTOMER_ROLE)],
            'label' => ['nullable', 'string', 'max:80'],
            'cart_payload' => ['required', 'array'],
        ]);

        $register = PosRegister::query()->with('location')->findOrFail($validated['register_id']);
        abort_unless((int) $register->location_id === (int) $validated['location_id'] && $request->user()->canAccessLocation($register->location), 403);

        $cart = HeldCart::create([
            'location_id' => $register->location_id,
            'pos_register_id' => $register->id,
            'cashier_id' => $request->user()->id,
            'customer_id' => $validated['customer_id'] ?? null,
            'label' => $validated['label'] ?: 'Held cart',
            'cart_payload' => $validated['cart_payload'],
            'expires_at' => now()->addDay(),
        ]);

        $audit->record('pos.cart.held', $cart, ['register_id' => $register->id], $request);

        return response()->json(['heldCart' => $cart, 'heldCarts' => $this->heldCarts($request)]);
    }

    public function deleteHeldCart(Request $request, HeldCart $heldCart)
    {
        abort_unless($request->user()->hasAdminPermission('pos.hold'), 403);
        abort_unless((int) $heldCart->cashier_id === (int) $request->user()->id || $request->user()->hasAdminPermission('pos.void'), 403);

        $heldCart->delete();

        return response()->json(['heldCarts' => $this->heldCarts($request)]);
    }

    public function receipt(Request $request, Order $order)
    {
        abort_unless($request->user()->hasAdminPermission('pos.access') || $request->user()->hasAdminPermission('orders.view'), 403);
        abort_unless($order->sales_channel === 'pos', 404);

        $order->load(['items.product', 'items.unit', 'items.focUnit', 'payments', 'location', 'register', 'server', 'user']);

        return Spa::render('Admin/POS/Receipt', ['order' => $order]);
    }

    private function heldCarts(Request $request)
    {
        return HeldCart::query()
            ->where('cashier_id', $request->user()->id)
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->with(['register:id,code,name', 'location:id,code,name', 'customer:id,name,email,phone'])
            ->latest()
            ->get();
    }
}
