# Product and Unit Management

This application uses one product record for one sellable product. Products do not have variants or separate stock-keeping records.

## Product model

The products table owns the generated product code, one optional unique barcode, category, name, description, base-unit minimum quantity, base-unit original cost, catalog status, metadata, ratings, and images.

The original price is used for inventory valuation and copied into sales as a cost snapshot. Reports use that snapshot to calculate cost of goods and gross profit.

## Units and conversions

The product_units table defines how a product is counted and sold:

- Every product has exactly one base unit with a conversion factor of 1.
- Every product has exactly one default selling unit.
- A conversion factor is the number of base units contained in one unit. A box containing 12 pieces has a factor of 12.
- Additional active units can be selected in the storefront, POS, receipts, adjustments, and transfers.
- Units with transaction history cannot be deleted; deactivate them instead.

Inventory balances and movement quantities are always stored in base units. Transaction rows also save the selected unit, unit quantity, and conversion factor for audit history.

When stock is displayed, the default selling unit is used only when at least one complete unit is available. Otherwise the base unit is shown.

## Dynamic selling prices

The product_unit_prices table stores any number of named prices for each unit:

- Retail is required for every unit and is the default.
- Other names such as wholesale, VIP, or member are dynamic records.
- POS staff can select an available price type.
- Online checkout uses retail pricing.
- Flash sales target a specific product unit and discount its retail price.

## Inventory contract

The source of truth is inventory_balances, unique by warehouse and product. inventory_movements is the append-only audit ledger.

Receiving, adjustments, transfers, reservations, POS sales, online sales, cancellations, and returns all convert their selected unit quantity to base quantity before changing inventory. Order items keep the product and unit IDs plus unit quantity, base quantity, conversion, unit name, price type, selling price, and cost snapshots.

## Product administration flow

1. Choose a category and enter the product identity.
2. Leave the barcode empty to generate one, or enter the product's existing barcode.
3. Enter base-unit cost and base-unit minimum quantity.
4. Define units and their conversion factors.
5. Select one base unit and one default selling unit.
6. Enter the required retail price and any additional prices for each unit.
7. Upload product images and save.

Stock is never edited directly from the product form. Use receipts, adjustments, or transfers so every quantity change has an audit movement.

## Deletion and history

A product cannot be deleted after it has inventory movements or sales. Units with transaction history follow the same rule. Deactivation preserves historical orders, valuations, receipts, and reports.
