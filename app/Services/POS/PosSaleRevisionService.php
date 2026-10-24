<?php

namespace App\Services\POS;

use App\Models\FinancialEntry;
use App\Models\Order;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\OrderManagementService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PosSaleRevisionService
{
    public function __construct(
        private OrderManagementService $orders,
        private PosCheckoutService $checkout,
        private AuditLogService $audit,
    ) {}

    public function revise(Order $order, array $payload, User $actor): Order
    {
        if ($order->sales_channel !== 'pos' || $order->status === 'cancelled') {
            throw ValidationException::withMessages(['order' => 'Only an active POS sale can be edited.']);
        }
        if ($order->returns()->exists()) {
            throw ValidationException::withMessages(['order' => 'A sale with returned items cannot be edited.']);
        }

        return DB::transaction(function () use ($order, $payload, $actor) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $order->load(['items', 'payments', 'user', 'server']);
            $originalOrderNumber = $order->order_number;
            $originalReceiptNumber = $order->receipt_number;
            $before = [
                'order_id' => $order->id,
                'total' => (float) $order->final_amount,
                'customer_id' => $order->user_id,
                'items' => $order->items->map->only(['product_unit_id', 'quantity', 'foc_product_unit_id', 'foc_quantity', 'unit_price'])->all(),
                'payments' => $order->payments->map->only(['tender_type', 'amount'])->all(),
            ];

            $this->orders->cancelOrder($order, $actor, "Revised as {$originalOrderNumber}", restoreStock: true);

            // A revision is not a customer refund. Remove only system postings produced
            // by the superseded sale/cancellation; its order, payments and audit trail remain.
            FinancialEntry::query()->where('category', FinancialEntry::CATEGORY_POS_SALE)
                ->where('reference', $originalReceiptNumber)->delete();
            FinancialEntry::query()->where('category', FinancialEntry::CATEGORY_REFUND_PAYABLE)
                ->where('reference', 'order-refund:'.$order->id)->delete();

            $archiveSuffix = '-REV-'.$order->id;
            $order->forceFill([
                'order_number' => substr($originalOrderNumber.$archiveSuffix, 0, 255),
                'receipt_number' => substr($originalReceiptNumber.$archiveSuffix, 0, 255),
                'admin_notes' => trim(($order->admin_notes ? $order->admin_notes."\n" : '')."Superseded by a POS sale revision on ".now()->toDateTimeString().'.'),
            ])->save();

            $replacement = $this->checkout->checkout($payload, $actor);
            $temporaryReceipt = $replacement->receipt_number;
            $replacement->forceFill([
                'order_number' => $originalOrderNumber,
                'receipt_number' => $originalReceiptNumber,
                'register_id' => $order->register_id,
                'shift_id' => $order->shift_id,
                'created_at' => $order->created_at,
                'admin_notes' => "Revision of order ID {$order->id}.",
            ])->save();
            $replacement->payments()->update([
                'register_id' => $order->register_id,
                'shift_id' => $order->shift_id,
            ]);
            $replacement->creditTransactions()->update([
                'register_id' => $order->register_id,
                'shift_id' => $order->shift_id,
            ]);
            FinancialEntry::query()->where('category', FinancialEntry::CATEGORY_POS_SALE)
                ->where('reference', $temporaryReceipt)
                ->update([
                    'reference' => $originalReceiptNumber,
                    'title' => "POS sale {$originalReceiptNumber}",
                    'entry_date' => $order->created_at->toDateString(),
                    'notes' => "Auto-created from revised POS sale in {$replacement->location->name}.",
                ]);
            $replacement->creditTransactions()->where('reference', $temporaryReceipt)->update(['reference' => $originalReceiptNumber]);

            $this->audit->record('pos.sale.revised', $replacement, [
                'superseded_order_id' => $order->id,
                'before' => $before,
                'after' => [
                    'order_id' => $replacement->id,
                    'total' => (float) $replacement->final_amount,
                    'customer_id' => $replacement->user_id,
                    'items' => $replacement->items->map->only(['product_unit_id', 'quantity', 'foc_product_unit_id', 'foc_quantity', 'unit_price'])->all(),
                    'payments' => $replacement->payments->map->only(['tender_type', 'amount'])->all(),
                ],
            ]);

            return $replacement->fresh(['items.product', 'items.unit', 'items.focUnit', 'payments', 'location', 'server', 'user']);
        }, 3);
    }
}
