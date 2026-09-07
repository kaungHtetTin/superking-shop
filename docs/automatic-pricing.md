# Automatic product pricing

## Use

Open **Settings → Prices** (`/admin/settings/prices`) with `settings.manage` permission. Edit Retail or create a type, choose Automatic, and configure markup, a whole-currency rounding increment, and minimum profit. The sample cost previews the result without changing any product cost.

Ordinary saves recalculate existing Automatic rows only. To enroll all active products, check **Apply to all active products**, review the impact counts, then confirm. This replaces Manual overrides and creates missing rows. A changed rule, cost or catalog scope invalidates the review; review again before committing. Existing inactive Automatic rows still follow ordinary rule edits, but bulk enrollment excludes inactive products and units.

Product editors choose Automatic or Manual separately for each unit/type. Automatic inputs are read-only previews; the server ignores submitted Automatic amounts and calculates again. Product versions prevent stale forms overwriting changes. Switching to Manual allows an exception; purchase and rule saves preserve it. Switching a shared rule to Manual preserves amounts and makes its rows Manual.

Receipts include paid quantity, free quantity, purchase unit and effective base-unit cost. Positive Manual prices below cost trigger a warning before submission and are rechecked transactionally by the server. **Review items** or acknowledge **Save anyway**. Successful posting displays changed-row counts and a committed old/new-price detail table on the receipt. Deletion also reports updated-price and missing-cost counts; its details remain in `price_changes` using `receipt-delete:<id>`.

## Cost and calculation contract

`ceil(max(cost × (1 + markup / 100), cost + minimum profit) / increment) × increment`

- Server arithmetic uses BCMath, not binary floats. Client previews use BigInt fixed-decimal arithmetic.
- Buying cost uses the latest **posted** receipt, ordered by receipt creation timestamp, receipt ID, then line ID descending. Posting an older draft does not make it the latest-created purchase.
- Effective base cost is `(paid quantity × unit cost) / ((paid + free quantity) × conversion factor)`, persisted to six decimal places, half up.
- With no posted purchase, pricing uses the product's opening pricing cost (`pricing_base_cost`).
- The rule computes a base-unit price. Other unit prices are the rounded base result × conversion factor, rounded upward to cents if needed. Selling amounts retain the app's two-decimal precision.
- `original_price` remains the weighted-average accounting/valuation cost. Pricing does not replace it with latest buying cost. Free quantity affects physical stock, but purchase expense uses paid quantity only.
- Zero cost retains the saved selling amount and marks an Automatic row **Cost required**. A new zero-valued Automatic row cannot be sold through POS or online checkout until it has positive cost or an explicit Manual price.
- Completed sales, payment history and sale-time cost snapshots are never repriced.
- Existing products' accounting cost is read-only in the editor and direct API changes are rejected. Opening cost can be set on creation; inventory operations manage subsequent accounting cost.
- Price previews show markup over buying cost, not accounting profit. The rule's minimum profit is a catalog-price floor before discounts and free items, not a guaranteed final margin.
- POS rejects a whole sale below its accounting-cost snapshots after discounts, including free-item cost. Online checkout applies the same break-even check to merchandise after discounts, excluding shipping collected. There is no below-cost override; reduce discounts/free items or review selling prices. This is a whole-order guard, not a per-line minimum-profit guarantee.
- Existing host safeguards remain: only draft receipts can be edited; posted receipt deletion requires cost snapshots and no dependent later stock/cost activity. Use documented corrections when deletion is blocked.

## Compatibility and safety

- This installation is single-business; shared rules span its warehouse catalog. No fictional tenant IDs were added. Existing role and warehouse access controls remain in effect.
- Shared rule IDs and local product price-type IDs are stable. Rule display names can change; immutable `code` retains existing integrations such as `retail`. Retail remains the required primary type and cannot be deleted. Active product associations, including zero-price rows, block deletion of other types.
- Existing local custom types remain supported as Manual prices. CSV imports treat an explicitly imported retail amount as a Manual override and enroll other Automatic rules for the new product.
- Migration `2026_09_07_000002_add_automatic_pricing.php` seeds legacy rules and all existing rows as Manual. It snapshots the current accounting cost as the opening pricing fallback, without changing existing selling prices, inventory quantities or financial entries. Review that fallback for legacy products if their true opening cost differs. Enabling Automatic with bulk apply is a separate manager action.
- A database pricing-state lock serializes rule/product/receipt pricing changes. Transactions roll back stock, cost, finance and pricing together if recalculation fails. Bulk processing is synchronous, not a background job; very large catalogs should be applied during a quiet period.
- Audit table `price_changes` records only actual changed amounts with cost, rule snapshot/version, trigger, actor and operation ID. Shared rule saves/deletes also use the existing audit log.
- POS fetches current cart prices when the payment dialog opens. Checkout checks expected amounts against current server prices and rejects stale totals; changing pricing never silently charges a different displayed POS amount.
- PHP 8.2+ and BCMath are required. The release lock is resolved against PHP 8.2.12 and uses Laravel 12. Run `composer check-platform-reqs --no-dev` on the deployment host; use a currently patched PHP release.

## Verification

Run:

```text
php artisan test --filter="AutomaticPricingTest|ProductCrudTest|ProductCsvImportTest|ProductUnitArchitectureTest|InventoryFinancialConsistencyTest"
node --test tests/js/automaticPricing.test.mjs
npm run build
```

Tests cover exact formula examples, free-quantity costing, missing-cost behavior, overrides, stale reviews/forms, active/inactive scope, immutable identity, product writes, purchase posting/deletion, rollback, permissions and amount overflow.

Browser visual verification was unavailable in this environment because the browser connection failed. Desktop/mobile layouts reuse the LaLaPick admin design system; settings use a table on desktop, stacked records on small screens and full-page editing. Existing unrelated oversized-upload regression expects HTTP 413 but receives 422.
