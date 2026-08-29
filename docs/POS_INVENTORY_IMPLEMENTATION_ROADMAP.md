# POS and Inventory Architecture

Status: implemented for the product-unit architecture.

## Core decisions

- A product has no variants and no separate stock-keeping model.
- One barcode identifies one product.
- Product codes are generated automatically.
- Inventory is owned by location and product, and stored in base units.
- Product units provide conversions for purchasing, counting, selling, and display.
- Retail is the required default price; additional price types are dynamic per unit.
- Product original price is the base-unit cost used for valuation and profit reporting.

## Data flow

Selected selling unit and quantity → conversion-factor snapshot → base quantity → product/location inventory balance → append-only inventory movement.

Orders keep both the selling-unit quantity and base quantity. Historical orders and returns therefore remain accurate if a unit conversion is later deactivated.

## Inventory operations

- Receipts convert the received unit to base stock and can update the product's base-unit cost.
- Adjustments compare a counted unit quantity with the stored base balance.
- Transfers post equal base-unit movements at the source and destination.
- Online checkout reserves base stock while payment is reviewed.
- Payment approval converts the reservation to a sale.
- Rejection and expiry release the reservation.
- Paid cancellation and returns restore base stock through idempotent movements.
- Low-stock checks compare available base quantity with the product minimum quantity.

## POS and storefront

- POS search supports product name, product code, barcode, and unit code.
- Results are shown per active product unit, with price choices built from dynamic price records.
- Checkout validates aggregate base stock per product.
- Storefront cards prefer the default selling unit only when a complete unit is available.
- Customers can choose another available unit; online pricing defaults to retail.
- Cart and checkout payloads use product_unit_id.

## Reporting

- Inventory valuation uses base stock multiplied by product original price.
- Paid-order cost of goods uses the saved order-item cost snapshot.
- Gross profit is paid revenue less cost of goods.
- Sell-through and low-stock reports aggregate by product and warehouse.

## Verification

- Fresh migrations and seed data must succeed.
- Tests cover conversion math, base stock, idempotency, display fallback, dynamic pricing, barcode uniqueness, promotion targeting, and removal of legacy identifiers.
- The production frontend build must succeed.
- Product, inventory, and POS screens must be inspected at desktop and phone widths.
