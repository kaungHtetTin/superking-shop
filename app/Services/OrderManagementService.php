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
        private StockReservationService $stockReservations
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
                return $this->cancelOrder($order, null, restoreStock: $order->payment_status === 'paid');
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
            $order->load(['location', 'items.product', 'items.unit', 'items.focUnit']);

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

            if ($restoreStock && $order->payment_status === 'paid') {
                if (! $order->location) {
                    throw ValidationException::withMessages(['order' => 'This order has no inventory location.']);
                }

                foreach ($order->items as $item) {
                    if ($item->product) {
                        $this->inventoryService->returnSale(
                            $order->location,
                            $item->product,
                            (float) $item->base_quantity,
                            $actor,
                            "order:return:item:{$item->id}",
                            $order,
                            $item->unit,
                            (float) $item->quantity
                        );
                        if ($item->focUnit && (float) $item->foc_base_quantity > 0) {
                            $this->inventoryService->returnSale(
                                $order->location,
                                $item->product,
                                (float) $item->foc_base_quantity,
                                $actor,
                                "order:return:item:{$item->id}:foc",
                                $order,
                                $item->focUnit,
                                (float) $item->foc_quantity
                            );
                        }
                    }
                }
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
        DB::transaction(function () use ($order, $actor, $reason) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $order->load(['location', 'items.product', 'items.unit', 'items.focUnit', 'returns', 'user']);

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

            if ($order->payment_status === 'paid') {
                if (! $order->location) {
                    throw ValidationException::withMessages(['order' => 'This order has no inventory location.']);
                }

                foreach ($order->items as $item) {
                    if (! $item->product) {
                        continue;
                    }

                    $alreadyRestocked = (float) $order->returns
                        ->filter(fn ($return) => (int) $return->order_item_id === (int) $item->id && $return->restocked_at)
                        ->sum('quantity');
                    $unitQuantityToRestore = max(0, (float) $item->quantity - $alreadyRestocked);
                    $baseQuantityToRestore = round($unitQuantityToRestore * (float) $item->conversion_factor, 4);

                    if ($baseQuantityToRestore > 0) {
                        $this->inventoryService->returnSale(
                            $order->location,
                            $item->product,
                            $baseQuantityToRestore,
                            $actor,
                            "order:return:item:{$item->id}:paid",
                            $order,
                            $item->unit,
                            $unitQuantityToRestore
                        );
                        $restoredStock += $baseQuantityToRestore;
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
                            (float) $item->foc_quantity
                        );
                        $restoredStock += (float) $item->foc_base_quantity;
                    }
                }
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
    public function stats(): array
    {
        return [
            'total' => Order::count(),
            'pending_payment' => Order::where('payment_status', 'pending_review')->count(),
            'processing' => Order::where('status', 'processing')->where('payment_status', 'paid')->count(),
            'shipped' => Order::where('status', 'shipped')->count(),
            'delivered' => Order::where('status', 'delivered')->count(),
            'cancelled' => Order::where('status', 'cancelled')->count(),
            'revenue_paid' => (float) Order::where('payment_status', 'paid')->sum('final_amount'),
        ];
    }
}
