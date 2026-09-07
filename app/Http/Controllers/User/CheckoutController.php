<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\PaymentMethod;
use App\Models\ProductUnit;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\CouponService;
use App\Services\FlashSalePricingService;
use App\Services\Inventory\StockReservationService;
use App\Services\Inventory\StorefrontInventoryService;
use App\Services\LoyaltyService;
use App\Services\LoyaltySettingsService;
use App\Support\Spa;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class CheckoutController extends Controller
{
    public function create(LoyaltySettingsService $loyaltySettings)
    {
        return Spa::render('User/Checkout/Index', [
            'shop' => config('shop'),
            'paymentMethods' => PaymentMethod::active()->ordered()->get(),
            'loyalty' => [
                'isEnabled' => $loyaltySettings->isEnabled(),
                'points' => (int) auth()->user()->loyalty_points,
                'tier' => auth()->user()->tier,
                'redeemCurrencyPerPoint' => $loyaltySettings->redeemCurrencyPerPoint(),
                'minimumRedeemPoints' => $loyaltySettings->minimumRedeemPoints(),
            ],
        ]);
    }

    public function quote(Request $request, CouponService $couponService, LoyaltyService $loyaltyService, FlashSalePricingService $flashSalePricing)
    {
        $validated = $request->validate([
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_unit_id' => ['required', 'integer', 'exists:product_units,id'],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0', 'max:9999'],
            'coupon_code' => ['nullable', 'string', 'max:50'],
            'redeem_points' => ['nullable', 'integer', 'min:0'],
        ]);

        return response()->json($this->calculateTotals($validated, $request->user(), config('shop'), $couponService, $loyaltyService, $flashSalePricing));
    }

    public function store(Request $request, CouponService $couponService, LoyaltyService $loyaltyService, FlashSalePricingService $flashSalePricing, AuditLogService $auditLogService, StorefrontInventoryService $storefrontInventory, StockReservationService $stockReservations)
    {
        $validated = $request->validate([
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_unit_id' => ['required', 'integer', 'exists:product_units,id'],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0', 'max:9999'],
            'lines.*.is_preorder' => ['nullable', 'boolean'],
            'receiver_name' => ['required', 'string', 'max:255'],
            'receiver_phone' => ['required', 'string', 'max:50'],
            'shipping_address' => ['required', 'string', 'max:2000'],
            'order_notes' => ['nullable', 'string', 'max:2000'],
            'payment_method_id' => ['required', 'integer', 'exists:payment_methods,id'],
            'payment_proof' => ['required', 'image', 'max:10240', 'mimes:jpg,jpeg,png,webp'],
            'coupon_code' => ['nullable', 'string', 'max:50'],
            'redeem_points' => ['nullable', 'integer', 'min:0'],
        ]);

        $paymentMethod = PaymentMethod::active()->whereKey($validated['payment_method_id'])->first();
        if (! $paymentMethod) {
            throw ValidationException::withMessages(['payment_method_id' => 'Please choose an active payment method.']);
        }
        $fulfillmentLocation = $storefrontInventory->fulfillmentLocation();
        $proofPath = $request->file('payment_proof')->store('payment-proofs', 'public');

        try {
            $order = DB::transaction(function () use ($validated, $request, $proofPath, $couponService, $loyaltyService, $flashSalePricing, $auditLogService, $paymentMethod, $fulfillmentLocation, $stockReservations) {
                app(\App\Services\AutomaticPricingService::class)->lock();
                $user = User::query()->whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
                $lines = collect($validated['lines'])->keyBy('product_unit_id');
                $unitIds = $lines->keys()->map(fn ($id) => (int) $id)->all();
                $units = ProductUnit::query()
                    ->whereIn('id', $unitIds)
                    ->where('is_active', true)
                    ->with(['prices', 'product' => fn ($query) => $query
                        ->where('status', 'active')
                        ->where('is_active', true)
                        ->inActiveCategory()])
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');
                $saleItems = $flashSalePricing->activeItemsForUnitIds($unitIds, true);
                $itemPayloads = [];

                foreach ($lines as $unitId => $row) {
                    $unit = $units->get((int) $unitId);
                    if (! $unit || ! $unit->product) {
                        throw ValidationException::withMessages(['lines' => 'One or more items are no longer available.']);
                    }
                    $quantity = round((float) $row['quantity'], 4);
                    $saleItem = $saleItems->get($unit->id);
                    if ($saleItem && $saleItem->remainingQuantity() !== null && $saleItem->remainingQuantity() < $quantity) {
                        throw ValidationException::withMessages(['lines' => "Flash sale quantity is no longer available for \"{$unit->product->name}\"."]);
                    }
                    $unitPrice = $flashSalePricing->effectivePrice($unit, $saleItem);
                    if ($unit->hasUnavailableAutomaticPrice()) {
                        throw ValidationException::withMessages(['lines' => 'A product needs a buying cost before it can be sold. Remove it from the cart and try again.']);
                    }
                    $itemPayloads[] = [
                        'unit' => $unit,
                        'quantity' => $quantity,
                        'base_quantity' => $unit->toBaseQuantity($quantity),
                        'is_preorder' => (bool) ($row['is_preorder'] ?? false),
                        'unit_price' => $unitPrice,
                        'total_price' => round($unitPrice * $quantity, 2),
                        'sale_item' => $saleItem,
                    ];
                }

                $totals = $this->calculateTotals($validated, $user, config('shop'), $couponService, $loyaltyService, $flashSalePricing);
                $accountingCost = round(array_sum(array_map(fn ($item) => round((float) $item['unit']->product->original_price * (float) $item['unit']->conversion_factor, 2) * $item['quantity'], $itemPayloads)), 2);
                if (round($totals['final'] - $totals['shipping'], 2) < $accountingCost) {
                    throw ValidationException::withMessages(['lines' => 'The current prices and discounts cannot be applied to this order. Please remove discounts or contact the store.']);
                }
                $coupon = $couponService->findValid($validated['coupon_code'] ?? null, $totals['subtotal']);
                if ($coupon) {
                    $coupon = Coupon::query()->whereKey($coupon->id)->lockForUpdate()->firstOrFail();
                    $coupon = $couponService->findValid($coupon->code, $totals['subtotal']);
                }

                $order = Order::create([
                    'user_id' => $user->id,
                    'coupon_id' => $coupon?->id,
                    'coupon_code' => $coupon?->code,
                    'order_number' => $this->makeOrderNumber(),
                    'sales_channel' => 'online',
                    'location_id' => $fulfillmentLocation->id,
                    'total_amount' => $totals['subtotal'],
                    'discount_amount' => $totals['discount'],
                    'redeemed_points' => $totals['redeemed_points'],
                    'tax_amount' => 0,
                    'shipping_fee' => $totals['shipping'],
                    'final_amount' => $totals['final'],
                    'status' => 'pending',
                    'payment_status' => 'pending_review',
                    'payment_method' => $paymentMethod->banking_service,
                    'payment_method_id' => $paymentMethod->id,
                    'payment_method_snapshot' => $paymentMethod->snapshot(),
                    'payment_proof_path' => $proofPath,
                    'shipping_address' => $validated['shipping_address'],
                    'receiver_name' => $validated['receiver_name'],
                    'receiver_phone' => $validated['receiver_phone'],
                    'order_notes' => $validated['order_notes'] ?? null,
                ]);

                foreach ($itemPayloads as $row) {
                    $unit = $row['unit'];
                    $saleItem = $row['sale_item'];
                    $orderItem = $order->items()->create([
                        'product_id' => $unit->product_id,
                        'product_unit_id' => $unit->id,
                        'quantity' => $row['quantity'],
                        'base_quantity' => $row['base_quantity'],
                        'conversion_factor' => $unit->conversion_factor,
                        'unit_name' => $unit->name,
                        'price_type' => 'retail',
                        'unit_price' => $row['unit_price'],
                        'cost_price' => round((float) $unit->product->original_price * (float) $unit->conversion_factor, 2),
                        'total_price' => $row['total_price'],
                        'is_preorder' => $row['is_preorder'],
                        'promotion_snapshot' => $saleItem ? ['flash_sale_item_id' => $saleItem->id, 'flash_sale_id' => $saleItem->flash_sale_id] : null,
                    ]);
                    if (! $row['is_preorder']) {
                        $stockReservations->reserveOrderItem($orderItem, $fulfillmentLocation, $user);
                    }
                    if ($saleItem) {
                        $saleItem->increment('sold_count', $row['quantity']);
                    }
                }

                if ($coupon) {
                    $coupon->increment('used_count');
                }
                $loyaltyService->redeemForOrder($user, $order, $totals['redeemed_points']);
                $auditLogService->record('order.created', $order, ['order_number' => $order->order_number, 'coupon_code' => $coupon?->code, 'redeemed_points' => $totals['redeemed_points']], $request);

                return $order;
            });
        } catch (\Throwable $exception) {
            Storage::disk('public')->delete($proofPath);
            throw $exception;
        }

        return redirect()->route('orders.show', $order)->with('success', 'Order submitted. We will verify your payment screenshot and confirm your order soon.');
    }

    private function calculateTotals(array $validated, User $user, array $shop, CouponService $couponService, LoyaltyService $loyaltyService, FlashSalePricingService $flashSalePricing): array
    {
        $lines = collect($validated['lines'])->keyBy('product_unit_id');
        $units = ProductUnit::query()
            ->whereIn('id', $lines->keys())
            ->where('is_active', true)
            ->with(['prices', 'product' => fn ($query) => $query
                ->where('status', 'active')
                ->where('is_active', true)
                ->inActiveCategory()])
            ->get()
            ->keyBy('id');
        $saleItems = $flashSalePricing->activeItemsForUnitIds($lines->keys()->map(fn ($id) => (int) $id)->all());
        $subtotal = 0.0;

        foreach ($lines as $unitId => $row) {
            $unit = $units->get((int) $unitId);
            if (! $unit || ! $unit->product) {
                throw ValidationException::withMessages(['lines' => 'One or more items are no longer available.']);
            }
            $quantity = round((float) $row['quantity'], 4);
            $saleItem = $saleItems->get($unit->id);
            if ($saleItem && $saleItem->remainingQuantity() !== null && $saleItem->remainingQuantity() < $quantity) {
                throw ValidationException::withMessages(['lines' => "Flash sale quantity is no longer available for \"{$unit->product->name}\"."]);
            }
            $subtotal += $flashSalePricing->effectivePrice($unit, $saleItem) * $quantity;
        }

        $subtotal = round($subtotal, 2);
        $coupon = $couponService->findValid($validated['coupon_code'] ?? null, $subtotal);
        $couponDiscount = $couponService->discountFor($coupon, $subtotal);
        $redeemedPoints = (int) ($validated['redeem_points'] ?? 0);
        $pointsValue = $loyaltyService->redemptionValue($user, $redeemedPoints);
        $shipping = $subtotal >= (float) $shop['free_shipping_minimum'] ? 0.0 : (float) $shop['shipping_flat'];
        $maxPointsValue = max(0, round($subtotal - $couponDiscount + $shipping, 2));
        if ($pointsValue > $maxPointsValue) {
            throw ValidationException::withMessages(['redeem_points' => 'Redeemed points exceed this order total.']);
        }
        $discount = round($couponDiscount + $pointsValue, 2);

        return [
            'subtotal' => $subtotal,
            'coupon_code' => $coupon?->code,
            'coupon_discount' => $couponDiscount,
            'redeemed_points' => $redeemedPoints,
            'points_value' => $pointsValue,
            'discount' => $discount,
            'shipping' => $shipping,
            'final' => round($subtotal + $shipping - $discount, 2),
        ];
    }

    private function makeOrderNumber(): string
    {
        do {
            $number = 'LP-'.now()->format('ymd').'-'.strtoupper(bin2hex(random_bytes(3)));
        } while (Order::where('order_number', $number)->exists());

        return $number;
    }
}
