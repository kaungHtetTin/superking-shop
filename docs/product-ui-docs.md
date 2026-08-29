# Product UI Reference

The product form is a compact admin workspace with three responsibilities: product identity, unit conversions, and selling prices.

## Identity and stock rules

- Product name and category are required.
- Product code is generated and read-only.
- One barcode belongs to the product; leaving it empty generates a unique value.
- Original price is the cost of one base unit.
- Minimum quantity is the low-stock threshold in base units.
- Description and multiple product images remain supported.

## Unit editor

Each unit card contains a unit name, short code, conversion factor, base-unit selector, default-selling-unit selector, active toggle, and dynamic list of named prices.

Exactly one base unit and one default selling unit are required. The base factor is fixed at 1. Retail is always present and cannot be removed. Other price rows can be added or removed.

## Responsive behavior

Desktop layouts keep unit fields and price rows compact and aligned. At phone widths, cards and price rows stack into one column, destructive buttons remain at least 44 pixels, and the sticky save actions stay reachable.

## Inventory and sales behavior

- Inventory screens show product code, barcode, warehouse balance, base unit, and converted display quantity.
- Receiving, adjustments, and transfers ask for a product unit and show the resulting base quantity.
- POS search returns one row per active product unit and offers every configured price type.
- Storefront product cards prefer the default selling unit when a complete unit is available.
- Cart and order views show the selected unit and retain the conversion snapshot.
