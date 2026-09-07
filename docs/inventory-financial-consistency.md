# Inventory and financial consistency

## Posting rules

- Finance, Sales, POS and sales CSV reports share `Order::recognizedSale()`: non-cancelled paid orders and delivered POS credit orders count as sales. The existing order-date reporting convention is retained. Credit deposits and later repayments are collections, not additional revenue. COGS includes the sale-time cost of paid and free quantities.
- Internal transfers create paired stock movements and a valued transfer document, not external income or purchases. Reports and finance CSV exclude legacy transfer entries by category, transfer ID and known transfer reference; existing rows are not rewritten.
- Receipts require an explicit unit cost before posting (zero is valid for free goods). The product-wide cost uses the weighted average of existing on-hand stock across all warehouses plus the receipt, at the application's two-decimal cost precision. Posting snapshots the previous/applied base costs. Deletion restores the previous cost only when there is no later quantity movement or cost change. Legacy receipts without snapshots require reconciliation rather than a guessed reversal.
- Counted-stock adjustments snapshot cost and value, and post protected gain/loss entries in the same transaction as inventory. Future product-cost changes cannot revalue these historical losses.
- Generated POS, receipt, transfer, adjustment and refund-payable financial entries cannot be manually edited/deleted or impersonated through manual-entry categories.

## Cancellation, deletion and refunds

Cancelling a completed sale excludes its revenue/COGS, restores stock (net of recorded item returns), reverses outstanding credit, and retains original payment receipts. Cancelling an already cancelled order is rejected. A delete request for a paid order cancels and retains it rather than deleting its payment audit trail; repeating the request does not restore stock again. Credit documents remain non-deletable.

Collected money is not automatically refunded. Cancellation records a protected pending `refund_payable` entry and exposes the amount due in Finance. This is an obligation, not an expense in the profit calculation and not evidence that cash/card money has been returned. Original cash-shift receipts remain unchanged. Actual payouts still need a separately authorized refund/settlement workflow; this change does not execute provider refunds or move money.

## Historical records and deployment

Run only `php artisan migrate --path=database/migrations/2026_09_07_000001_add_inventory_cost_snapshots.php` to install the additive snapshot columns. No historical values are fabricated or backfilled. Existing adjustment lines without snapshots are flagged in Finance/Reports as incomplete. Reconcile these against source documents before treating historical profit as final. Previously duplicated stock, wrong purchase costs and missing refund obligations likewise need a record-by-record reconciliation; changing code cannot establish their correct historical amounts.

Regression coverage lives in `tests/Feature/InventoryFinancialConsistencyTest.php`, together with the existing product-unit/POS and transfer-deletion tests. Tests run only against `music_store_testing` via `phpunit.xml`.

## Verification (2026-09-07)

- Focused suite: 41 passing tests, including 16 new financial-consistency regressions.
- Frontend production build succeeds (existing dependency directive/chunk-size warnings remain).
- Broader checks also found two failures outside the changed paths: oversized checkout upload expects HTTP 413 but receives 422, and credit-statement PDF generation lacks `Dompdf\Options` in this environment.
- Browser verification could not run because the browser connection failed. UI changes reuse existing LaLaPick controls, metric cards and feedback text; no new visual system was introduced.
