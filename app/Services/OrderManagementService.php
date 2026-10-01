<?php

namespace App\Services;

use App\Models\Order;
use App\Models\FlashSaleItem;
use App\Models\FinancialEntry;
use App\Models\InventoryReservation;
use App\Models\User;
use App\Services\Inventory\InventoryService;
use App\Services\Inventory\StockReservationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderManagementService
{
    private LoyaltyService $loyaltyService;

    private AuditLogService $auditLogService;

    public function __construct(
        LoyaltyService $loyaltyService,
        AuditLogService $auditLogService,
        private InventoryService $inventoryService,
        private StockReservationService $stockReservations,
        private CustomerCreditService $creditService
    )
    {
        $this->loyaltyService = $loyaltyService;
        $this->auditLogService = $auditLogService;
    }

    /** @var array<string, list<string>> */
    private const STATUS_TRANSITIONS = [
        'pending' => ['processing', 'cancelled'],
        'processing' => ['shipped', 'cancelled'],
        'shipped' => ['delivered', 'cancelled'],
        'delivered' => [],
        'cancelled' => [],
    ];

    public function updateStatus(Order $order, string $newStatus): Order
    {
        $newStatus = strtolower($newStatus);

        if (! in_array($newStatus, config('orders.statuses'), true)) {
            throw ValidationException::withMessages([
                'status' => 'Invalid order status.',
            ]);
        }

        if ($order->status === $newStatus) {
            return $order;
        }

        if ($order->status === 'cancelled') {
            throw ValidationException::withMessages([
                'status' => 'Cancelled orders cannot be updated.',
            ]);
        }

        if ($order->payment_status === 'pending_review' && $newStatus !== 'cancelled') {
            throw ValidationException::withMessages([
                'status' => 'Confirm or reject payment before changing fulfillment status.',
            ]);
        }

        if ($order->payment_status === 'rejected') {
            throw ValidationException::withMessages([
                'status' => 'This order payment was rejected.',
            ]);
        }

        $allowed = self::STATUS_TRANSITIONS[$order->status] ?? [];

        if (! in_array($newStatus, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => "Cannot change status from {$order->status} to {$newStatus}.",
            ]);
        }

        if (in_array($newStatus, ['processing', 'shipped', 'delivered'], true) && $order->payment_status !== 'paid') {
            throw ValidationException::withMessages([
                'status' => 'Payment must be confirmed before fulfillment updates.',
            ]);
        }

        return DB::transaction(function () use ($order, $newStatus) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();

            if ($newStatus === 'cancelled') {
                return $this->cancelOrder($order, null, restoreStock: $order->payment_status === 'paid' || (float) $order->credit_amount > 0);
            }

            $order->forceFill([
                'status' => $newStatus,
                'status_updated_at' => now(),
            ])->save();

            $this->auditLogService->record('order.status_updated', $order, [
                'status' => $newStatus,
                'order_number' => $order->order_number,
            ]);

            return $order->fresh(['items.product', 'items.unit', 'items.focUnit', 'user', 'paymentReviewer']);
        });
    }

    public function cancelOrder(
        Order $order,
        ?User $actor = null,
        ?string $reason = null,
        bool $restoreStock = true,
        string $reservationStatus = InventoryReservation::STATUS_RELEASED
    ): Order
    {
        if ($order->status === 'cancelled') {
            throw ValidationException::withMessages([
                'order' => 'Order is already cancelled.',
            ]);
        }

        return DB::transaction(function () use ($order, $actor, $reason, $restoreStock, $reservationStatus) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $order->load(['location', 'items.product', 'items.unit', 'items.focUnit', 'user', 'server', 'returns']);
            $wasPaid = $order->payment_status === 'paid';

            if ($order->status === 'cancelled') {
                throw ValidationException::withMessages([
                    'order' => 'Order is already cancelled.',
                ]);
            }

            if ($order->payment_status === 'pending_review') {
                $this->stockReservations->releaseOrder(
                    $order,
                    $actor,
                    $reason ?: 'Order cancelled',
                    $reservationStatus
                );
            }

            if ($restoreStock && ($order->payment_status === 'paid' || (float) $order->credit_amount > 0)) {
                if (! $order->location) {
                    throw ValidationException::withMessages(['order' => 'This order has no inventory location.']);
                }

                foreach ($order->items as $item) {
                    if ($item->product && ! $item->is_preorder) {
                        $alreadyRestocked = (float) $order->returns
                            ->filter(fn ($return) => (int) $return->order_item_id === (int) $item->id && $return->restocked_at)
                            ->sum('quantity');
                        $quantityToRestore = max(0, (float) $item->quantity - $alreadyRestocked);
                        if ($quantityToRestore > 0) {
                            $this->inventoryService->returnSale(
                                $order->location,
                                $item->product,
                                round($quantityToRestore * (float) $item->conversion_factor, 4),
                                $actor,
                                "order:return:item:{$item->id}:paid",
                                $order,
                                $item->unit,
                                $quantityToRestore,
                                (float) $item->cost_price / max((float) $item->conversion_factor, 0.000001)
                            );
                        }
                        if ($item->focUnit && (float) $item->foc_base_quantity > 0) {
                            $this->inventoryService->returnSale(
                                $order->location,
                                $item->product,
                                (float) $item->foc_base_quantity,
                                $actor,
                                "order:return:item:{$item->id}:foc",
                                $order,
                                $item->focUnit,
                                (float) $item->foc_quantity,
                                (float) $item->foc_cost_price / max((float) $item->foc_base_quantity, 0.000001)
                            );
                        }
                    }
                }
            }


            if ((float) $order->credit_amount > 0 && $order->user) {
                $this->creditService->reverseOrderBalance(
                    $order->user,
                    $order,
                    $actor ?: $order->server ?: $order->user,
                    $reason ?: 'Credit order cancelled'
                );
            }

            foreach ($order->items as $item) {
                $flashSaleItemId = $item->promotion_snapshot['flash_sale_item_id'] ?? null;
                if ($flashSaleItemId) {
                    FlashSaleItem::query()
                        ->whereKey($flashSaleItemId)
                        ->where('sold_count', '>=', $item->quantity)
                        ->decrement('sold_count', $item->quantity);
                }
            }

            $updates = [
                'status' => 'cancelled',
                'status_updated_at' => now(),
                'payment_status' => 'cancelled',
            ];
            if ($order->payment_status === 'pending_review') {
                $updates['payment_status'] = 'rejected';
                $updates['payment_rejection_reason'] = $reason ?: 'Order cancelled by admin.';
                $updates['payment_reviewed_at'] = now();
                if ($actor) {
                    $updates['payment_reviewed_by'] = $actor->id;
                }
            } elseif ($reason) {
                $updates['payment_rejection_reason'] = $reason;
            }

            $order->forceFill($updates)->save();

            // Cancellation reverses the sale, not the physical movement of cash.
            // Keep original payments and record the obligation to refund them.
            // Never label cash/card money refunded without a refund transaction.
            $collected = max((float) $order->paid_amount, (float) $order->payments()->where('status', 'paid')->sum('amount'), $wasPaid ? (float) $order->final_amount : 0);
            if ($collected > 0) {
                FinancialEntry::firstOrCreate([
                    'category' => FinancialEntry::CATEGORY_REFUND_PAYABLE,
                    'reference' => 'order-refund:'.$order->id,
                ], [
                    'recorded_by' => $actor?->id ?? $order->served_by ?? $order->payment_reviewed_by,
                    'location_id' => $order->location_id,
                    'type' => 'expense',
                    'title' => "Refund due for cancelled order {$order->order_number}",
                    'amount' => round($collected, 2),
                    'entry_date' => now()->toDateString(),
                    'status' => 'pending',
                    'notes' => 'Refund payable only; no cash or provider refund has been executed. '.($reason ?? ''),
                ]);
            }

            $this->loyaltyService->restoreRedeemedPoints($order->fresh('user'), 'Order cancelled');
            $this->auditLogService->record('order.cancelled', $order, [
                'reason' => $reason,
                'restored_stock' => $restoreStock,
                'order_number' => $order->order_number,
            ]);

            return $order->fresh(['items.product', 'items.unit', 'user', 'paymentReviewer']);
        });
    }

    public function expireReservation(Order $order): Order
    {
        return $this->cancelOrder(
            $order,
            null,
            'Inventory reservation expired before payment review.',
            restoreStock: false,
            reservationStatus: InventoryReservation::STATUS_EXPIRED
        );
    }

    public function deleteOrderAsReturn(Order $order, ?User $actor = null, ?string $reason = null): void
    {
        if ((float) $order->credit_amount > 0) {
            throw ValidationException::withMessages([
                'order' => 'Credit orders must be cancelled and retained for ledger audit; they cannot be deleted.',
            ]);
        }
        DB::transaction(function () use ($order, $actor, $reason) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $order->load(['location', 'items.product', 'items.unit', 'items.focUnit', 'returns', 'user']);

            // Paid sales must retain their payment/refund audit trail. A delete
            // request returns/cancels the sale instead of erasing that evidence.
            if ($order->payment_status === 'paid' || (float) $order->paid_amount > 0 || $order->payments()->exists()) {
                if ($order->status !== 'cancelled') {
                    $this->cancelOrder($order, $actor, $reason ?: 'Order returned by admin');
                }
                return;
            }

            $financialReferences = array_values(array_filter([
                $order->receipt_number,
                $order->order_number,
            ]));

            $deletedFinancialEntries = $financialReferences
                ? FinancialEntry::query()
                    ->where('type', 'income')
                    ->where('category', FinancialEntry::CATEGORY_POS_SALE)
                    ->whereIn('reference', $financialReferences)
                    ->delete()
                : 0;

            $restoredStock = 0;

            if ($order->payment_status === 'pending_review') {
                $this->stockReservations->releaseOrder(
                    $order,
                    $actor,
                    $reason ?: 'Order deleted as return'
                );
            }


            foreach ($order->items as $item) {
                $flashSaleItemId = $item->promotion_snapshot['flash_sale_item_id'] ?? null;
                if ($flashSaleItemId) {
                    FlashSaleItem::query()
                        ->whereKey($flashSaleItemId)
                        ->where('sold_count', '>=', $item->quantity)
                        ->decrement('sold_count', $item->quantity);
                }
            }

            $this->loyaltyService->restoreRedeemedPoints($order, 'Order deleted as return');
            $this->auditLogService->record('order.deleted_as_return', $order, [
                'reason' => $reason,
                'order_number' => $order->order_number,
                'receipt_number' => $order->receipt_number,
                'restored_stock' => $restoredStock,
                'deleted_financial_entries' => $deletedFinancialEntries,
            ]);

            $order->delete();
        }, 3);
    }

    public function updateAdminNotes(Order $order, ?string $notes): Order
    {
        $order->forceFill(['admin_notes' => $notes ?: null])->save();

        $this->auditLogService->record('order.notes_updated', $order, [
            'order_number' => $order->order_number,
        ]);

        return $order->fresh(['items.product', 'items.unit', 'user', 'paymentReviewer']);
    }

    /**
     * @return array{total: int, pending_payment: int, processing: int, shipped: int, delivered: int, cancelled: int, revenue_paid: float}
     */
    public function stats(?array $locationIds = null): array
    {
        $orders = Order::query()->when($locationIds !== null, fn ($query) => $query->whereIn('location_id', $locationIds));
        return [
            'total' => (clone $orders)->count(),
            'pending_payment' => (clone $orders)->where('payment_status', 'pending_review')->count(),
            'processing' => (clone $orders)->where('status', 'processing')->where('payment_status', 'paid')->count(),
            'shipped' => (clone $orders)->where('status', 'shipped')->count(),
            'delivered' => (clone $orders)->where('status', 'delivered')->count(),
            'cancelled' => (clone $orders)->where('status', 'cancelled')->count(),
            'revenue_paid' => (float) (clone $orders)->where('payment_status', 'paid')->sum('final_amount'),
        ];
    }
}
