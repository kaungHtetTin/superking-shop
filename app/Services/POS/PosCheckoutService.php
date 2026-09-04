<?php

namespace App\Services\POS;

use App\Models\FinancialEntry;
use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\Order;
use App\Models\Payment;
use App\Models\ProductUnit;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\CustomerCreditService;
use App\Services\Inventory\InventoryService;
use App\Services\LoyaltyService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PosCheckoutService
{
    public function __construct(private InventoryService $inventoryService, private AuditLogService $auditLogService, private LoyaltyService $loyaltyService, private CustomerCreditService $creditService, private PosShiftService $shiftService)
    {
    }

    public function checkout(array $payload, User $cashier): Order
    {
        if (empty($payload['customer_id'])) {
            throw ValidationException::withMessages([
                'customer_id' => 'Choose a registered customer before completing the sale.',
            ]);
        }

        return DB::transaction(function () use ($payload, $cashier) {
            $location = Location::query()->where('is_active', true)->findOrFail((int) $payload['location_id']);
            if (! $cashier->canAccessLocation($location)) {
                throw ValidationException::withMessages(['location_id' => 'You cannot sell from this warehouse.']);
            }
            $shift = $this->shiftService->lockForSale((int) ($payload['shift_id'] ?? 0), $cashier, $location);
            $customer = User::query()
                ->where('role', User::CUSTOMER_ROLE)
                ->lockForUpdate()
                ->find((int) $payload['customer_id']);
            if (! $customer) {
                throw ValidationException::withMessages([
                    'customer_id' => 'Choose a registered customer before completing the sale.',
                ]);
            }

            $lines = collect($payload['items']);
            $unitIds = $lines->pluck('product_unit_id')
                ->merge($lines->pluck('foc_product_unit_id')->filter())
                ->unique();
            $units = ProductUnit::query()
                ->whereIn('id', $unitIds)
                ->where('is_active', true)
                ->with([
                    'prices',
                    'product' => fn ($query) => $query->where('status', 'active')->where('is_active', true),
                    'product.baseUnit.prices',
                ])
                ->get()
                ->keyBy('id');
            $subtotal = 0.0;
            $items = [];

            foreach ($lines as $line) {
                $unit = $units->get((int) $line['product_unit_id']);
                if (! $unit || ! $unit->product) {
                    throw ValidationException::withMessages(['items' => 'One or more POS items are unavailable.']);
                }
                $quantity = round((float) $line['quantity'], 4);
                if ($quantity <= 0) {
                    throw ValidationException::withMessages(['items' => 'Every POS quantity must be greater than zero.']);
                }
                $priceType = strtolower((string) ($line['price_type'] ?? 'retail'));
                $price = $unit->priceFor($priceType);
                if (! $price) {
                    throw ValidationException::withMessages(['items' => "{$unit->product->name} has no {$priceType} price for {$unit->name}."]);
                }
                $focQuantity = round((float) ($line['foc_quantity'] ?? 0), 4);
                if ($focQuantity < 0) {
                    throw ValidationException::withMessages(['items' => 'FOC quantity cannot be negative.']);
                }
                $focUnit = null;
                $focBaseQuantity = 0.0;
                if ($focQuantity > 0) {
                    if (! $cashier->hasAdminPermission('pos.discount')) {
                        throw ValidationException::withMessages(['items' => 'You cannot add free-of-charge quantities.']);
                    }
                    $focUnit = $units->get((int) ($line['foc_product_unit_id'] ?? 0));
                    if (! $focUnit || ! $focUnit->product || (int) $focUnit->product_id !== (int) $unit->product_id) {
                        throw ValidationException::withMessages(['items' => "FOC unit for {$unit->product->name} must belong to the same product."]);
                    }
                    $focBaseQuantity = $focUnit->toBaseQuantity($focQuantity);
                }
                $configuredPrice = (float) $price->price;
                $basePrice = (float) ($unit->product->baseUnit?->priceFor($priceType)?->price ?? 0);
                $unitPrice = round(
                    $configuredPrice > 0
                        ? $configuredPrice
                        : ($basePrice > 0 ? $basePrice * (float) $unit->conversion_factor : 0),
                    2
                );
                if ($unitPrice <= 0) {
                    throw ValidationException::withMessages([
                        'items' => "{$unit->product->name} has no positive {$priceType} selling price for {$unit->name} or its base unit.",
                    ]);
                }
                $lineTotal = round($unitPrice * $quantity, 2);
                $baseQuantity = $unit->toBaseQuantity($quantity);
                $subtotal += $lineTotal;
                $items[] = compact('unit', 'quantity', 'baseQuantity', 'priceType', 'unitPrice', 'lineTotal', 'focUnit', 'focQuantity', 'focBaseQuantity');
            }

            $requiredByProduct = collect($items)->groupBy(fn ($item) => $item['unit']->product_id)
                ->map(fn ($rows) => $rows->sum(fn ($item) => $item['baseQuantity'] + $item['focBaseQuantity']));
            foreach ($requiredByProduct as $productId => $required) {
                $balance = InventoryBalance::query()->where('location_id', $location->id)->where('product_id', $productId)->lockForUpdate()->first();
                if (! $balance || $balance->available_qty + 0.00005 < $required) {
                    $product = collect($items)
                        ->first(fn ($item) => (int) $item['unit']->product_id === (int) $productId)['unit']
                        ->product;
                    throw ValidationException::withMessages(['items' => "Not enough warehouse stock for {$product->name} ({$product->product_code})."]);
                }
            }

            $discount = $this->discountAmount($payload, $subtotal, $cashier);
            $final = round(max(0, $subtotal - $discount), 2);
            $tenderType = $payload['tender_type'] ?? 'cash';
            $amountTendered = round((float) ($payload['amount_tendered'] ?? 0), 2);
            $isCredit = $tenderType === 'credit';
            $creditAmount = 0.0;
            $depositMethod = $payload['credit_deposit_method'] ?? 'cash';

            if ($isCredit) {
                if (! $cashier->hasAdminPermission('credit.manage')) {
                    throw ValidationException::withMessages(['tender_type' => 'You cannot create credit sales.']);
                }
                if (empty($payload['customer_id'])) {
                    throw ValidationException::withMessages(['customer_id' => 'Choose a registered customer for a credit sale.']);
                }
                if ($amountTendered < 0 || $amountTendered >= $final) {
                    throw ValidationException::withMessages(['amount_tendered' => 'Credit deposit must be zero or less than the sale total.']);
                }
                if (! in_array($depositMethod, ['cash', 'card', 'mobile'], true)) {
                    throw ValidationException::withMessages(['credit_deposit_method' => 'Choose a valid deposit payment method.']);
                }
                $creditAmount = round($final - $amountTendered, 2);
                $this->creditService->assertCanBorrow($customer, $creditAmount);
            } elseif ($amountTendered < $final) {
                throw ValidationException::withMessages(['amount_tendered' => 'Amount tendered must cover the sale total.']);
            }
            if (! $isCredit && $tenderType !== 'cash' && abs($amountTendered - $final) > 0.009) {
                throw ValidationException::withMessages(['amount_tendered' => 'Card and mobile payments must equal the sale total.']);
            }
            $changeDue = ! $isCredit && $tenderType === 'cash' ? round($amountTendered - $final, 2) : 0.0;
            $paymentStatus = $isCredit ? ($amountTendered > 0 ? 'partially_paid' : 'unpaid') : 'paid';
            $dueDate = $isCredit ? now()->addDays(max(1, (int) $customer->credit_terms_days))->toDateString() : null;
            $order = Order::create([
                'user_id' => $payload['customer_id'],
                'order_number' => $this->number('POS'),
                'receipt_number' => $this->number('RCT'),
                'sales_channel' => 'pos',
                'location_id' => $location->id,
                'register_id' => $shift->pos_register_id,
                'shift_id' => $shift->id,
                'served_by' => $cashier->id,
                'total_amount' => round($subtotal, 2),
                'discount_amount' => $discount,
                'admin_discount_type' => $payload['discount_type'] ?? null,
                'admin_discount_value' => round((float) ($payload['discount_value'] ?? 0), 2),
                'admin_discount_amount' => $discount,
                'tax_amount' => 0,
                'shipping_fee' => 0,
                'final_amount' => $final,
                'status' => 'delivered',
                'payment_status' => $paymentStatus,
                'credit_due_date' => $dueDate,
                'credit_amount' => $creditAmount,
                'paid_amount' => $isCredit ? $amountTendered : $final,
                'payment_method' => $tenderType,
                'pos_tender_summary' => ['tender_type' => $tenderType, 'amount_tendered' => $amountTendered, 'change_due' => $changeDue, 'credit_amount' => $creditAmount, 'deposit_method' => $isCredit ? $depositMethod : null],
                'receiver_name' => $customer->name,
                'receiver_phone' => $customer->phone,
                'order_notes' => $payload['notes'] ?? null,
                'status_updated_at' => now(),
            ]);

            foreach ($items as $item) {
                $unit = $item['unit'];
                $orderItem = $order->items()->create([
                    'product_id' => $unit->product_id,
                    'product_unit_id' => $unit->id,
                    'foc_product_unit_id' => $item['focUnit']?->id,
                    'quantity' => $item['quantity'],
                    'foc_quantity' => $item['focQuantity'],
                    'base_quantity' => $item['baseQuantity'],
                    'foc_base_quantity' => $item['focBaseQuantity'],
                    'conversion_factor' => $unit->conversion_factor,
                    'unit_name' => $unit->name,
                    'price_type' => $item['priceType'],
                    'unit_price' => $item['unitPrice'],
                    'cost_price' => round((float) $unit->product->original_price * (float) $unit->conversion_factor, 2),
                    'foc_cost_price' => round((float) $unit->product->original_price * $item['focBaseQuantity'], 2),
                    'total_price' => $item['lineTotal'],
                ]);
                $this->inventoryService->completeSale($location, $unit->product, $item['baseQuantity'], 0, $cashier, "pos:order:{$order->id}:item:{$orderItem->id}:paid", $order, $unit, $item['quantity']);
                if ($item['focUnit'] && $item['focQuantity'] > 0) {
                    $this->inventoryService->completeSale($location, $unit->product, $item['focBaseQuantity'], 0, $cashier, "pos:order:{$order->id}:item:{$orderItem->id}:foc", $order, $item['focUnit'], $item['focQuantity']);
                }
            }

            $payment = null;
            $paidNow = $isCredit ? $amountTendered : $final;
            $actualTender = $isCredit ? $depositMethod : $tenderType;
            if ($paidNow > 0) {
                $payment = Payment::create([
                'order_id' => $order->id,
                'register_id' => $shift->pos_register_id,
                'shift_id' => $shift->id,
                'received_by' => $cashier->id,
                'transaction_id' => $this->paymentTransactionId(),
                'amount' => $paidNow,
                'amount_tendered' => $amountTendered,
                'change_due' => $changeDue,
                'method' => $actualTender,
                'tender_type' => $actualTender,
                'status' => 'paid',
                'payment_details' => array_merge($payload['payment_details'] ?? [], $isCredit ? ['credit_deposit' => true] : []),
                ]);
            }
            if ($isCredit) {
                $this->creditService->recordSale($customer, $order, $creditAmount, $cashier);
            }
            if ($paidNow > 0) {
                FinancialEntry::create([
                'recorded_by' => $cashier->id,
                'location_id' => $location->id,
                'type' => 'income',
                'category' => FinancialEntry::CATEGORY_POS_SALE,
                'title' => "POS sale {$order->receipt_number}",
                'amount' => $paidNow,
                'entry_date' => now()->toDateString(),
                'payment_method' => $actualTender,
                'reference' => $order->receipt_number,
                'status' => 'approved',
                'notes' => "Auto-created from POS sale in {$location->name}.",
                ]);
            }
            $this->auditLogService->record('pos.sale.completed', $order, [
                'receipt_number' => $order->receipt_number,
                'location_id' => $location->id,
                'total' => $final,
                'paid_now' => $paidNow,
                'credit_amount' => $creditAmount,
                'foc_line_count' => collect($items)->where('focQuantity', '>', 0)->count(),
                'foc_base_quantity' => round((float) collect($items)->sum('focBaseQuantity'), 4),
            ]);
            if (! $isCredit) {
                $this->loyaltyService->awardForPaidOrder($order->fresh('user'));
            }

            return $order->fresh(['items.product', 'items.unit', 'items.focUnit', 'payments', 'location', 'server', 'user']);
        }, 3);
    }

    private function discountAmount(array $payload, float $subtotal, User $cashier): float
    {
        $type = $payload['discount_type'] ?? null;
        $value = round((float) ($payload['discount_value'] ?? 0), 2);
        if (! $type || $value <= 0) {
            return 0.0;
        }
        if (! $cashier->hasAdminPermission('pos.discount')) {
            throw ValidationException::withMessages(['discount_value' => 'You cannot apply POS discounts.']);
        }
        if (! in_array($type, ['percent', 'amount'], true)) {
            throw ValidationException::withMessages(['discount_type' => 'Choose a valid discount mode.']);
        }
        $amount = $type === 'percent' ? round($subtotal * ($value / 100), 2) : $value;
        if ($amount > $subtotal) {
            throw ValidationException::withMessages(['discount_value' => 'Discount cannot exceed subtotal.']);
        }

        return $amount;
    }

    private function number(string $prefix): string
    {
        do {
            $number = $prefix.'-'.now()->format('ymd').'-'.strtoupper(Str::random(6));
        } while (Order::query()->where('order_number', $number)->orWhere('receipt_number', $number)->exists());

        return $number;
    }

    private function paymentTransactionId(): string
    {
        do {
            $id = 'PAY-'.now()->format('ymd').'-'.strtoupper(Str::random(8));
        } while (Payment::query()->where('transaction_id', $id)->exists());

        return $id;
    }
}
