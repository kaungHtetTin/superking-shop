# OnlineShop Commerce & POS Platform

## Detailed Software Specification and Marketing Guide

**Document purpose:** Product marketing, sales presentations, customer proposals, onboarding discussions, and internal product communication  
**Product type:** Integrated online store, point-of-sale, inventory, customer, marketing, finance, and business reporting platform  
**Document version:** 1.0  
**Prepared from:** The currently implemented OnlineShop application  
**Last updated:** September 2026

---

## 1. Executive Summary

OnlineShop is an integrated commerce management platform created for businesses that want to sell through both a physical counter and an online storefront without maintaining separate systems for products, stock, customers, orders, promotions, and reporting.

The platform brings together:

- A fast browser-based point-of-sale workspace for in-store sales
- A mobile-first online shopping experience for customers
- Centralized product, unit, price, barcode, and category management
- Warehouse-level inventory control with a complete stock movement history
- Online order payment verification and fulfillment management
- Customer accounts, loyalty points, credit limits, statements, and purchase history
- Coupons, flash sales, product reviews, recommendations, blogs, and storefront content
- Business dashboards, sales analysis, inventory reports, profitability reporting, and CSV exports
- Staff roles, location restrictions, action permissions, account suspension, and audit logs
- Custom branding, configurable currency, English/Myanmar localization, and Progressive Web App support

OnlineShop is designed to solve a common business problem: information is often scattered across notebooks, spreadsheets, chat applications, social media pages, cash registers, and separate ecommerce tools. When these sources do not agree, staff make mistakes, stock becomes unreliable, customers receive inconsistent answers, and owners cannot clearly see whether the business is growing profitably.

OnlineShop creates one connected operational record. A product sold at the POS or ordered online uses the same catalog, pricing structure, customer information, inventory balances, and reporting foundation. This reduces repeated work and gives management a more accurate picture of the business.

### Core marketing message

> **Sell in-store and online, control stock by warehouse, understand every transaction, and grow customer value from one connected platform.**

### Primary value proposition

OnlineShop helps a growing retailer replace disconnected manual processes with a structured daily workflow. Staff can sell faster, managers can control access, warehouse teams can trace every quantity change, marketing teams can run measurable promotions, customers can shop conveniently, and owners can make decisions using current business data.

---

## 2. Product Vision

The vision of OnlineShop is to give small and medium-sized retailers the operational discipline of a larger organization without forcing them to adopt an unnecessarily complex enterprise system.

The software is built around five principles:

1. **One source of truth.** Products, units, selling prices, costs, stock, customers, and orders should not be maintained independently in multiple places.
2. **Practical daily operation.** Common work such as selling, receiving stock, checking inventory, confirming payments, and serving customers should be quick and understandable.
3. **Controlled flexibility.** A business can define different units, price types, staff roles, warehouses, payment accounts, campaigns, and brand settings while keeping rules consistent.
4. **Traceability.** Important changes should leave a record, especially stock movements, sales, credit transactions, financial entries, and administrative actions.
5. **Growth readiness.** The platform should support a business as it moves from one counter to multiple warehouses, from walk-in sales to online sales, and from informal customer relationships to structured loyalty and credit programs.

---

## 3. Who the Software Is For

OnlineShop is suitable for product-based businesses that need to coordinate sales, inventory, customers, and promotions.

Typical users include:

- Retail stores with one or more stock locations
- Wholesalers that sell the same product in pieces, packs, boxes, or other units
- Businesses that use retail, wholesale, VIP, member, or dealer prices
- Stores that accept cash, card, mobile payment, bank transfer, or customer credit
- Social-commerce sellers that want a professional online storefront and a structured back office
- Specialty shops with many product categories and detailed product information
- Musical instrument, electronics, beauty, fashion, gift, lifestyle, hardware, parts, accessories, stationery, and household-goods stores
- Businesses that need English and Myanmar user interfaces
- Growing companies that need to limit what each staff member can view or change
- Owners who want inventory valuation, sales performance, customer behavior, and profit indicators in one system

### Business size and operational fit

The platform is especially valuable when a business has reached one or more of these stages:

- Stock can no longer be reliably managed from memory.
- Different employees give different prices to customers.
- The online team and counter team compete for the same stock.
- The owner cannot quickly calculate sales, costs, discounts, expenses, and gross profit.
- Customer credit is tracked in messages or paper books.
- Management wants to add another warehouse or sales team.
- Promotions are being run, but their results are not measurable.
- Staff need access to the system, but they should not all have administrator authority.

---

## 4. Business Problems Solved

### 4.1 Slow checkout and pricing mistakes

**The problem:** Cashiers may search through paper lists, ask a manager for a price, calculate discounts manually, or struggle when a customer buys a box instead of a single piece.

**How OnlineShop helps:**

- Products can be found by name, product code, unit code, barcode, or category.
- Each product can have multiple selling units and conversion factors.
- Each unit can have retail and additional business-defined price types.
- Totals, discounts, tendered amounts, and cash change are calculated by the system.
- Free-of-charge quantities can be added by authorized staff.
- Completed sales generate a receipt and immediately update stock.

**Business result:** Faster service, fewer calculation errors, more consistent pricing, and better cashier accountability.

### 4.2 Unreliable inventory numbers

**The problem:** A spreadsheet may say an item is available even though it has been sold, reserved online, damaged, moved to another warehouse, or received in a different unit.

**How OnlineShop helps:**

- Inventory is held by warehouse and product.
- The system distinguishes on-hand, reserved, and available quantities.
- All quantities are converted to a base unit before stock is changed.
- Receipts, sales, reservations, releases, returns, adjustments, and transfers create movement records.
- Negative stock is blocked by default.
- Low-stock and out-of-stock conditions can be detected automatically.
- A reconciliation process compares current balances with the movement ledger.

**Business result:** More confident selling, fewer oversold items, easier investigation of discrepancies, and better purchasing decisions.

### 4.3 Separate online and physical-store records

**The problem:** Online orders may be tracked in chat while counter sales are tracked in another application. The same product can appear available in both places even when only one item remains.

**How OnlineShop helps:**

- POS and online orders use the same product and inventory foundation.
- Online checkout reserves stock while payment is awaiting review.
- Confirmed online sales convert reservations into completed stock movements.
- Expired or cancelled reservations release stock for other customers.
- Reports can analyze both online and POS sales while preserving the sales channel.

**Business result:** One operational view across channels and less risk of selling unavailable stock.

### 4.4 Poor visibility into profit

**The problem:** Revenue may look strong while heavy discounting, free products, purchasing costs, delivery expenses, rent, marketing, and other costs reduce actual profit.

**How OnlineShop helps:**

- Each sales line keeps a cost snapshot.
- Reports calculate revenue, cost of goods, gross profit, gross margin, expenses, and an estimated net profit.
- POS income and stock-receipt expenses can be created automatically.
- Manual income and expenses can be categorized by date, location, payment method, and reference.
- Finance and report data can be exported to CSV for further analysis or accounting handoff.

**Business result:** Better pricing decisions, clearer expense control, and less dependence on guesswork.

### 4.5 Customer credit risk

**The problem:** Credit sales recorded in notebooks are easy to forget. Staff may approve more credit than a customer is allowed, and owners may not know which balances are overdue.

**How OnlineShop helps:**

- Credit can be enabled, disabled, or suspended for each customer.
- Each customer can have a credit limit and payment term.
- The system checks available credit before approving a credit sale.
- A deposit can be collected while the remaining amount becomes credit.
- Repayments can be allocated to a selected invoice or to the oldest balances first.
- Aging reports group outstanding debt into current, 1–30, 31–60, 61–90, and over-90-day buckets.
- Customers and administrators can download PDF credit statements.

**Business result:** Safer credit decisions, organized collection work, and more professional customer communication.

### 4.6 Promotions that are difficult to control

**The problem:** Manual promotions can be applied outside their valid dates, exceed planned quantities, or continue after the budget is exhausted.

**How OnlineShop helps:**

- Coupons can use fixed or percentage discounts.
- Coupons can require a minimum order and have start dates, expiry dates, usage limits, and active/inactive status.
- Flash sales can be scheduled for specific product units.
- Flash-sale prices can be percentage reductions or specific fixed sale prices.
- Optional flash-sale quantity limits prevent sales beyond the campaign allocation.
- Promotion performance appears in reports.

**Business result:** More controlled campaigns and better visibility into which promotions create revenue.

### 4.7 Weak customer retention

**The problem:** A business may complete a sale but fail to build an ongoing relationship with the customer.

**How OnlineShop helps:**

- Customers have order history, profiles, wishlists, reviews, support conversations, loyalty balances, and credit information.
- Loyalty earning and redemption rules are configurable.
- Bronze, Silver, Gold, and Platinum tiers can apply different earning multipliers.
- Product recommendations use category affinity and past purchase patterns.
- Frequently bought together suggestions are derived from real paid orders.
- Blogs and buying guides help customers make decisions before purchasing.

**Business result:** More reasons for customers to return, improved trust, and opportunities for cross-selling.

### 4.8 Uncontrolled staff access

**The problem:** Sharing one administrator password makes it impossible to know who performed an action and gives every employee excessive authority.

**How OnlineShop helps:**

- Every staff member can have an individual account.
- System roles include Super Admin, Manager, and Staff.
- Custom roles can be created with selected permissions.
- Access can be limited by module and warehouse.
- Staff accounts can be suspended without deleting their history.
- Sensitive actions such as discounts, credit management, payment review, reports, finance, and audit-log access can be restricted.
- Administrative actions record the user, action, subject, time, IP address, browser information, and relevant details.

**Business result:** Stronger internal control, clearer responsibility, and safer delegation as the team grows.

---

## 5. How the Software Can Be Used

OnlineShop supports an end-to-end operating cycle rather than a collection of isolated screens.

### 5.1 Initial business setup

A system owner or implementation partner can prepare the platform in the following sequence:

1. Set the application name, logo, favicon, currency label, primary color, and contact information.
2. Create warehouses and identify the default fulfillment warehouse for online orders.
3. Create categories and subcategories.
4. Add products manually or import them from the provided CSV structure.
5. Define each product's base unit, selling units, conversion factors, cost, retail price, and optional additional price types.
6. Receive opening stock or create stock receipts at the correct warehouse.
7. Configure payment accounts shown during online checkout.
8. Create staff accounts, assign roles, and restrict warehouse access.
9. Configure loyalty earning and redemption rules.
10. Customize storefront banners, promotional blocks, homepage sections, blogs, and buying guides.

After this setup, the same information becomes available to the POS, online store, inventory team, order team, customer service staff, and reports.

### 5.2 Daily in-store selling

A typical POS sale works as follows:

1. The cashier signs in through the separate administrator login.
2. The cashier opens the POS and selects an authorized warehouse.
3. The cashier searches or scans a product.
4. The cashier selects the appropriate unit and price type when alternatives are available.
5. Quantities are added to the current sale.
6. If permitted, the cashier applies a percentage or amount discount or adds a free-of-charge quantity.
7. The cashier selects a walk-in customer, searches for an existing customer, or creates a customer account.
8. The customer pays by cash, card, mobile payment, or approved customer credit.
9. For cash, the system calculates change. For a credit sale, it validates the customer's status, limit, term, and deposit.
10. The sale is saved, stock is deducted, payment and finance records are created, eligible loyalty points are awarded, and a receipt is available.

### 5.3 Daily online selling

A typical online order works as follows:

1. A customer browses products from a phone or computer.
2. The customer searches, filters, sorts, reads product details, selects a selling unit, and adds items to the cart.
3. The customer can save items to a wishlist before signing in.
4. At checkout, the system revalidates the current product, price, promotion, quantity, coupon, loyalty redemption, and shipping charge.
5. The customer selects an active payment account and uploads a payment screenshot.
6. Available stock is reserved while the order waits for staff review.
7. A manager reviews the proof and confirms or rejects payment.
8. Confirmation converts the reservation into a completed sale and moves the order into processing.
9. Staff update the order through processing, shipped, and delivered stages.
10. The customer can see the latest payment and fulfillment status from the order page.

This workflow is particularly useful in markets where mobile-wallet or bank-transfer proof is a common ecommerce payment method.

### 5.4 Receiving new stock

When goods arrive from a supplier:

1. An authorized employee opens stock receiving.
2. The destination warehouse and supplier reference are selected.
3. Products are added using their appropriate units.
4. The received quantity and optional unit cost are entered.
5. When posted, the system converts each line to the product's base quantity.
6. Warehouse balances and the movement ledger are updated.
7. If a unit cost is supplied, the product's base cost is updated.
8. A related stock-purchase expense is created automatically in finance.

This creates a direct connection between purchasing activity, inventory value, and financial reporting.

### 5.5 Performing a physical stock count

When staff count a shelf or warehouse:

1. They select the warehouse, product unit, and adjustment reason.
2. They enter the quantity physically counted.
3. The system converts the count to the base unit and compares it with the current on-hand balance.
4. Only the difference is posted as a gain or loss.
5. A note is required for a stock loss.
6. The movement retains the system quantity, counted quantity, difference, reason, location, user, and time.

This is safer than directly editing a stock number because the reason and before/after quantities remain traceable.

### 5.6 Moving stock between warehouses

For an internal transfer:

1. Staff choose a source warehouse and a different destination warehouse.
2. Products, units, and quantities are entered.
3. The system verifies that the source has enough available stock.
4. The transfer removes stock from the source and adds the same base quantity to the destination in one transaction.
5. A transfer document records both warehouses, product units, quantities, values, staff member, and movement references.

The current workflow is designed for an immediate completed transfer. Businesses requiring a multi-stage dispatch/in-transit/receiving approval workflow should treat that as an optional extension.

### 5.7 Managing customer credit

For a trusted business customer:

1. An authorized manager opens the customer profile.
2. Credit is activated and a limit and term are assigned.
3. At the POS, the cashier selects the customer and credit tender.
4. The customer may pay a deposit by cash, card, or mobile payment.
5. The system records the unpaid balance and due date.
6. Later payments can be recorded against a selected invoice or allocated to the oldest open invoices.
7. The customer's outstanding, overdue, available credit, and transaction history update automatically.
8. A PDF statement can be issued for a selected period.

### 5.8 Running a marketing campaign

A manager can:

1. Schedule a flash sale with a start and end time.
2. Select the exact selling unit included in the sale.
3. Choose a percentage discount or fixed sale price.
4. Optionally limit the number of units that can be sold.
5. Create a coupon with a minimum order, validity period, and total usage limit.
6. Feature the campaign through configurable homepage sections or promotional banners.
7. Publish a blog post or buying guide related to the promoted products.
8. Review coupon use, flash-sale units sold, estimated campaign revenue, top products, product pairs, and customer purchasing segments.

### 5.9 Management review

At the end of a day, week, or month, management can review:

- Paid orders and sales revenue
- Average order value
- Units sold and units per order
- Top products and category performance
- Repeat-customer rate
- Discounts and discount rate
- Cost of goods, gross profit, and gross margin
- Manual income, operating expenses, and estimated net profit
- Sales by day, warehouse, cashier, register, tender type, and channel
- On-hand, reserved, and available stock
- Stock cost value and retail value
- Low-stock and out-of-stock items
- Adjustment reasons and estimated loss value
- Sell-through rate
- Customer credit aging and recent collections
- System health, failed jobs, backup freshness, and inventory reconciliation results

---

## 6. Detailed Functional Specification

### 6.1 Point-of-Sale Module

The POS module is optimized for fast sales entry in a browser and can be used on desktop, laptop, or tablet-sized screens.

#### Product discovery

- Search by product name, product code, barcode, or unit code
- Filter products by category
- Show active products and active units only
- Display product imagery when available
- Show stock available at the selected warehouse
- Prioritize exact barcode and unit-code matches
- Support paginated product loading for larger catalogs

#### Cart management

- Add products using the selected selling unit
- Increase, decrease, or directly edit quantity
- Prevent checkout when requested stock exceeds available stock
- Choose from available price types, such as retail, wholesale, VIP, member, or dealer
- Add free-of-charge quantities using any active unit belonging to the same product
- Apply an order-level fixed amount or percentage discount
- Show subtotal, discount, final total, and stock warnings

#### Customer handling

- Sell to a walk-in customer without creating a customer account
- Search existing customers
- Create a customer during POS checkout
- Attach a registered customer to the sale for loyalty, order history, or credit
- Keep customer credit disabled by default until an authorized employee activates it

#### Tender and payment handling

- Cash payment with amount tendered and calculated change
- Card payment
- Mobile payment
- Customer credit with optional deposit
- Credit deposit method selection
- Validation that non-cash immediate payments equal the final amount
- Payment transaction number generation
- Paid, unpaid, and partially-paid status support
- Payment detail storage for future reference

#### Sale completion

- Unique order and receipt numbers
- Automatic inventory deduction from the selected warehouse
- Separate stock deduction for free-of-charge quantities
- Cost snapshots for margin reporting
- Automatic payment record creation
- Automatic finance income entry for the amount received
- Customer credit transaction creation when applicable
- Loyalty-point award for eligible fully paid customer orders
- Audit event recording
- Browser-viewable receipt

#### Business controls

- Warehouse access is checked before a sale is permitted.
- The current stock row is locked during checkout to reduce overselling under concurrent use.
- Discounts and free-of-charge quantities require the POS discount permission.
- Credit sales require the credit-management permission.
- The system rejects missing prices, invalid units, unavailable products, insufficient stock, over-limit credit, and underpayment.

### 6.2 Product and Category Management

The catalog module stores the commercial identity of every item sold online or in-store.

#### Product information

- Automatically generated immutable product code
- Optional existing barcode or automatic barcode generation
- Product name and URL-friendly slug
- Category and subcategory relationship
- Detailed description
- Base-unit cost/original price
- Minimum stock quantity
- Active, inactive, and draft status
- Featured-product flag
- Product rating and review count
- Multiple images with a selectable cover image
- Safe deactivation when transaction history must be preserved

#### Category management

- Category and subcategory structure
- Active/inactive control
- Sort ordering
- Category-based storefront browsing
- Category use in POS and product administration filters

#### Product lifecycle

A product can be prepared as a draft, made active for selling, temporarily deactivated, or retained for transaction history. Products with stock movements or sales history are protected from destructive deletion so past reports and documents remain meaningful.

### 6.3 Units, Conversions, and Dynamic Pricing

Unit conversion is a central feature of OnlineShop.

For example, a beverage can have:

- Piece — conversion factor 1
- Pack — conversion factor 6
- Carton — conversion factor 24

Inventory remains stored in pieces, but customers and staff can transact using packs or cartons. The selected transaction preserves both the entered unit quantity and the calculated base quantity.

#### Unit rules

- Every product has exactly one base unit with a conversion factor of 1.
- Every product has one default selling unit.
- Additional active units can be used in POS, online sales, receipts, counts, and transfers.
- Units keep a name, short code, conversion factor, status, and sort order.
- Units with transaction history should be deactivated rather than removed.

#### Price rules

- Retail is the required default price type.
- Additional price types can be created per product.
- Every price type has a price for every product unit.
- POS staff can choose an allowed available price type.
- Online checkout uses the retail price, adjusted by an active flash sale when applicable.
- Each order line records the unit, price type, unit price, conversion, and cost used at the time of sale.

#### Business value

This structure is useful for wholesalers, distributors, hardware stores, groceries, beverage businesses, cosmetics suppliers, and any retailer that purchases, counts, or sells the same item in more than one packaging unit.

### 6.4 Barcode and Bulk Product Tools

- Automatic unique barcode generation
- Acceptance of existing barcodes
- Barcode-oriented product search
- Dedicated barcode listing for product-label workflows
- Product CSV template download
- CSV product import for up to 10,000 product rows per file
- Optional automatic creation of missing categories as inactive categories
- Row-by-row validation with clear failure reporting
- Duplicate-barcode validation
- Product CSV export
- Spreadsheet-safe export formatting to reduce formula-injection risk

The import workflow creates the product, base unit, retail price, and initial warehouse balance structure. Complex additional units and price types can then be added through product administration.

### 6.5 Inventory and Warehouse Management

#### Warehouse structure

- Create and manage multiple warehouses
- Store code, name, address, phone, timezone, and active status
- Identify the default online fulfillment warehouse
- Assign staff to selected warehouses
- Give administrators global warehouse access when required

#### Inventory balance model

For each product and warehouse, the system stores:

- **On-hand quantity:** physical quantity currently recorded
- **Reserved quantity:** stock temporarily committed to active online orders
- **Available quantity:** on-hand minus reserved
- **Version:** internal change counter used to support reliable updates

All three business quantities are represented in the product's base unit.

#### Inventory movement ledger

The ledger supports these movement types:

- Opening balance
- Stock receipt
- Adjustment gain
- Adjustment loss
- Online-order reservation
- Reservation release
- Completed sale
- Sale return/restoration
- Transfer out
- Transfer in

Each movement can retain the warehouse, product, selected unit, entered unit quantity, conversion factor, base-quantity change, reserved-quantity change, before and after balances, reference document, reason, notes, user, time, and idempotency key.

This movement history provides stronger traceability than a system that stores only the latest stock number.

#### Stock receiving

- Destination warehouse selection
- Supplier or external reference
- Multiple products per receipt
- Unit-based received quantity
- Optional expected quantity
- Optional unit cost
- Line and document notes
- Automatic base-unit conversion
- Automatic inventory movement creation
- Product base-cost update from the supplied unit cost
- Automatic finance expense for receipts with cost values
- Receipt history and detailed receipt view
- Controlled deletion with compensating stock adjustments and finance cleanup

#### Stock adjustment

- Physical count, damage, write-off, data correction, and other reasons
- Unit-based counted quantity
- Automatic comparison with the current system quantity
- Posting of only the difference
- Mandatory explanation for losses
- Adjustment number, user, warehouse, reason, and timestamp

#### Stock transfer

- Source and destination validation
- Warehouse-access validation
- Unit-based transfer quantity
- Available-stock validation at the source
- Automatic transfer-out and transfer-in movements
- Transfer value based on product cost
- Transfer document and history

#### Reservations and overselling protection

- Online non-preorder items reserve stock at order submission.
- Reserved stock is excluded from available stock.
- Payment confirmation converts active reservations into sales.
- Cancellation or payment rejection releases reservations.
- Pending reservations expire after a configurable period, which is 120 minutes by default.
- A scheduled command checks expired reservations every five minutes.
- Negative stock is disabled by default.

#### Inventory monitoring

- Inventory balance overview
- Product-level movement history
- Warehouse and product filters
- Low-stock and out-of-stock prioritization
- CSV balance export
- Product movement export
- Daily low-stock scanning
- Email notification digest for authorized staff
- Automatic resolution when stock recovers
- Daily ledger-to-balance reconciliation
- Inventory cost and retail valuation
- Sell-through analysis

### 6.6 Online Storefront

The storefront provides a mobile-first ecommerce experience connected directly to the administrative platform.

#### Public shopping experience

- Responsive home page
- Category and subcategory browsing
- Product search
- Filter by category, price range, minimum rating, and flash-sale participation
- Sort by newest, price, best selling, and rating
- Product image galleries
- Product descriptions
- Selling-unit selection
- Live effective pricing from active flash sales
- Availability across active warehouses
- Related products
- Personalized recommendations for signed-in customers
- Frequently bought together suggestions
- Approved ratings and reviews
- Blog and buying-guide content

#### Cart and wishlist

- Add an exact product unit and quantity to the cart
- Update or remove lines
- Store unit, conversion, product code, and price context
- Persist guest cart data in the browser
- Persist guest wishlist data in the browser
- Display cart and wishlist counts in navigation
- Continue from browsing to checkout after authentication

#### Checkout

- Authenticated customer checkout
- Server-side quote recalculation before order placement
- Shipping recipient name and phone
- Shipping address and order notes
- Configurable flat shipping charge
- Configurable free-shipping threshold
- Coupon application
- Loyalty-point redemption
- Active payment-account selection
- Payment-proof image upload
- Final server-side validation of price, promotion, unit, and quantity

#### Order tracking

- Customer order list and detail page
- Search by order or receipt number
- Filter by fulfillment and payment status
- Pending, processing, shipped, delivered, and cancelled fulfillment stages
- Pending review, unpaid, partially paid, paid, and rejected payment states
- Visible payment rejection reason
- Purchase line, unit, quantity, free-of-charge quantity, and price history
- Credit-order indicator and outstanding-order access

### 6.7 Progressive Web App Experience

The storefront includes Progressive Web App capabilities:

- Installable app manifest
- Standalone app-like display on supported devices
- Configurable application name, theme color, and icon
- Shortcuts to products, categories, and cart
- Caching of recently opened public pages and static assets
- Offline fallback page
- Locally persisted cart information
- Protection against caching administrative, API, authentication, checkout, order, profile, and chat pages as public content

The PWA improves repeat access and the mobile shopping experience. It does not make checkout or POS fully offline; transactions still require a connection to the server.

### 6.8 Payment Method Management

Administrators can configure the payment accounts presented to online customers.

Each method can contain:

- Banking or wallet service name
- Account holder name
- Account number
- Icon
- Display order
- Active/inactive status

The selected account is copied into the order as a snapshot. This means an old order can continue to show the account details that were used even if the current payment method is later changed.

OnlineShop currently uses a manual payment-proof verification model for online checkout. This is appropriate for bank transfers and mobile-wallet payments that require screenshot confirmation. Automated Stripe, PayPal, or card-gateway capture is not part of the current implementation and would require an integration project.

### 6.9 Order and Fulfillment Management

#### Unified order administration

- Online and POS orders in one order data structure
- Sales-channel identification
- Search, status filters, and payment filters
- Order statistics
- Detailed customer, line, unit, cost, payment, fulfillment, and stock information
- Internal administrator notes
- Customer chat shortcut
- CSV order export

#### Online payment review

- View the submitted payment screenshot
- Confirm payment with authorized permission
- Reject payment with an optional customer-visible reason
- Prevent fulfillment progression before payment confirmation
- Convert reserved stock into a sale only when payment is approved
- Release reservation and restore redeemed loyalty points when payment is rejected
- Award loyalty points after a paid order becomes eligible

#### Fulfillment lifecycle

The controlled progression is:

`Pending -> Processing -> Shipped -> Delivered`

An order can be cancelled from permitted stages, but invalid backward or skipped transitions are rejected. Cancelled and delivered orders are treated as terminal states for normal fulfillment updates.

#### Cancellation and deletion controls

- Cancelling a pending-review online order releases reserved stock.
- Cancelling a paid order can restore sold stock.
- Redeemed points can be restored once.
- Credit balances can be reversed when no collected payment prevents cancellation.
- A protected administrative deletion workflow treats removal as a return-style reversal and can reverse stock and related POS finance data.

The current product does not expose a complete partial-return, exchange, or partial-refund interface. Businesses requiring partial returns should plan that as an extension rather than describing it as a current standard feature.

### 6.10 Receipts, Vouchers, and Invoices

- POS receipt view
- Order voucher with product, unit, quantity, price, discount, shipping, payment, and customer information
- Printable HTML voucher
- Downloadable PDF voucher
- Public invoice link protected by a long random token
- QR code linking to the public invoice
- Configured logo, business name, currency, and payment account details
- PDF customer credit statements

PDF vouchers use a browser-rendering process for consistent visual output. Credit statements use server-side PDF generation.

### 6.11 Customer Management

#### Customer records

- Name, email, phone, avatar, and default address
- Active account and authentication information
- Order, review, loyalty, and credit relationships
- Customer creation from administration or directly inside POS
- Customer search and filters
- Customer editing and controlled deletion
- Release of deleted customer contact details for future reuse

#### Customer profile intelligence

The administrator customer view can show:

- Total orders
- Paid, cancelled, and pending-payment order counts
- Total spend
- Average order value
- Last order time
- Recent orders
- Top purchased categories
- Reviews
- Loyalty-point history
- Credit status, limit, balance, available amount, and overdue amount
- Open credit invoices and credit transactions

#### Customer self-service

- Profile details
- Avatar upload and crop
- Default phone and address
- Password update
- Order history
- Credit dashboard
- Credit transaction history
- Credit statement download
- Wishlist
- Support chat
- Account deletion protected by password confirmation

### 6.12 Loyalty Program

The loyalty module turns completed purchases into a structured retention program.

#### Configurable rules

- Enable or disable loyalty globally
- Points earned per currency unit
- Currency value per redeemed point
- Minimum points required for redemption
- Tier thresholds and earning multipliers

#### Standard tiers

- Bronze
- Silver
- Gold
- Platinum

The default configuration increases the earning multiplier at higher tiers. Thresholds and multipliers can be changed in configuration to match the business strategy.

#### Loyalty transactions

- Earn points from eligible paid orders
- Redeem points during online checkout
- Restore redeemed points after qualifying cancellation or rejection
- Manual point addition or subtraction by a Super Admin
- Reason recorded for manual changes
- Per-customer reward history
- Automatic tier refresh after balance changes
- Protection against duplicate awards and duplicate restoration

### 6.13 Coupons

- Uppercase unique coupon code
- Percentage or fixed-value discount
- Minimum order amount
- Optional start date and time
- Optional expiry date and time
- Optional total usage limit
- Used-count tracking
- Active/inactive control
- Active, scheduled, expired, exhausted, and inactive status views
- Server-side validation during quote and checkout
- Coupon snapshot on the order
- Safe deactivation instead of deletion after usage history exists
- Coupon-performance reporting

### 6.14 Flash Sales

- Campaign name
- Required start and end times
- Active/inactive control
- Scheduled, live, ended, and inactive states
- Selection of exact product units
- Percentage discount or fixed sale price
- Optional quantity allocation per unit
- Sold-count and remaining-quantity tracking
- Prevention of overlapping active campaigns for the same unit and period
- Prevention of reducing a quantity limit below the amount already sold
- Automatic effective pricing in catalog, cart quote, and checkout
- Sale-price snapshot on the order line
- Performance reporting

### 6.15 Product Reviews and Ratings

- Signed-in customer rating from one to five stars
- Optional written comment
- One current review per customer and product, with update behavior
- Approved review display on product pages
- Average rating and review count calculation
- Administration search and status filtering
- Approve, hide, or delete a review
- Automatic product-rating recalculation after moderation
- Audit record for moderation and deletion

### 6.16 Recommendations and Cross-Selling

OnlineShop uses understandable, data-driven recommendation rules rather than requiring an external AI service.

- **Related products:** other available products from the same category
- **Recommended for you:** products from categories favored in the signed-in customer's order history
- **Frequently bought together:** products appearing together with the current product in paid orders
- **Best sellers:** products ranked by paid sales quantity

These features help customers discover relevant products and help the business increase basket size. Recommendation quality naturally improves as the system collects more paid-order history.

### 6.17 Blog and Buying-Guide Content

- Blog categories
- Tags
- Draft, published, and archived content status
- Title, slug, excerpt, body, cover media, author, and publication time
- Search and filtering in administration
- Public blog list and article pages
- Buying-guide page for educational content
- Homepage blog section
- Audit records for content management

This module allows the business to support content marketing, product education, organic search visibility, and pre-sale customer confidence without maintaining a separate publishing system.

### 6.18 Storefront Content Management

Administrators can change important homepage content without editing source code.

- Main hero title, subtitle, button, link, color, image, and status
- Promotional cards with title, subtitle, button, link, image, color, status, and order
- Homepage section titles, subtitles, order, and visibility
- Category section
- Flash-sale section
- Promotional section
- Best-seller section
- Blog section

This allows seasonal homepage changes, campaign landing messages, and merchandising updates to be managed by authorized business users.

### 6.19 Customer Support Chat

- One support conversation per customer
- Automatic assignment to an available staff member with chat permission
- Customer and administrator chat interfaces
- Multi-customer administrator inbox
- Search by customer
- Message history and pagination
- Unread counts
- Seen status
- Text messages up to 8,000 characters
- JPEG, PNG, and WebP image attachments
- Client-side image compression
- Upload progress
- Optimistic message display and retry behavior
- Duplicate-send protection using a client message identifier
- Customer context shown to support staff

The current chat refreshes through frequent secure API polling. The project includes broadcasting libraries and configuration hooks, but true push-based WebSocket messaging should be presented as configuration/integration work rather than a guaranteed current behavior.

### 6.20 Finance Management

#### Automatic financial entries

- POS amounts received create income entries.
- Customer credit repayments create income entries by warehouse.
- Posted stock receipts with costs create expense entries.
- Deleting a stock receipt removes its system-managed purchase expense.

#### Manual entries

- Income or expense type
- Warehouse
- Category
- Title
- Amount
- Date
- Payment method
- External reference
- Pending, approved, or void status
- Notes
- Recorded-by user

#### Standard income categories

- POS sales
- Other income
- Service fee
- Adjustment

#### Standard expense categories

- Stock receipts
- Inventory
- Delivery
- Marketing
- Salary
- Rent
- Utilities
- Software
- Bank fee
- Refund
- Other expense

Additional active financial categories can be defined in the database configuration. System-managed stock-receipt entries are protected from ordinary editing so the financial record remains aligned with its source inventory document.

#### Finance analysis

- Date-range filtering
- Warehouse filtering
- Type, status, category, reference, title, and note search
- Income, expenses, cost of goods, and net trend indicators
- CSV export with UTF-8 support
- Location-level access control

OnlineShop provides operational finance visibility but is not marketed as a statutory double-entry accounting, tax filing, payroll, or audited general-ledger product. It can provide structured source data to an accountant or accounting platform.

### 6.21 Dashboard and Business Reporting

#### Management dashboard

- Current order statistics
- Today's revenue and order count
- Current-month revenue
- Product and customer counts
- Active and draft product counts
- Sales trend by day
- Top products by revenue
- Low-stock count and priority items
- Recent orders

#### Sales report

- Paid order count
- Revenue
- Customer count
- Products in stock
- Average order value
- Units sold
- Units per order
- Repeat-customer rate
- Discount rate
- Cost of goods
- Gross profit
- Gross margin
- Manual income
- Expenses
- Estimated net profit
- Sales by day
- Top products
- Category performance
- Basket-size segments
- Common product pairs
- Coupon performance
- Flash-sale performance
- CSV order-level export with revenue, cost, and gross profit

#### Inventory report

- Total on hand
- Total reserved
- Total available
- Inventory cost value
- Estimated retail value
- Low-stock and out-of-stock counts
- Warehouse/product stock rows
- Movement activity by type
- Adjustment volume and loss value by reason
- Recent transfers
- Product sell-through rate
- CSV inventory export

#### POS report

- POS order count
- POS revenue
- Discounts
- Average sale
- Performance by warehouse
- Performance by configured register reference
- Performance by cashier
- Tender summary
- Optional own-sales-only restriction for the basic Staff role
- CSV tender export

#### Credit report

- Outstanding credit total
- Overdue total
- Aging buckets
- Customer credit limits and status
- Oldest due date
- Open invoice count
- Recent collection history
- Customer search
- CSV export

#### Operational health report

- Queue condition
- Broadcasting configuration condition
- Expired workflow detection
- Backup freshness
- Application log writability
- Inventory-ledger reconciliation result
- Open low-stock alerts
- Failed-job count

### 6.22 CSV and PDF Exports

The application supports practical handoff and analysis outside the system:

- Product CSV template
- Product CSV import
- Product CSV export
- Order CSV export
- Sales report CSV
- Inventory report CSV
- POS tender CSV
- Finance CSV
- Credit-aging CSV
- Inventory balance CSV
- Product movement CSV
- Order voucher PDF
- Customer credit statement PDF

Large CSV exports use streaming or chunked data access where appropriate to reduce memory pressure.

---

## 7. User Roles and Access Control

### Super Admin

The Super Admin is the system owner and can access all permissions. Typical responsibilities include:

- Application and brand settings
- Staff and custom-role administration
- Sensitive loyalty configuration and manual point adjustment
- Audit-log access
- All warehouses and business reports
- High-risk operational actions

The system prevents a user from deleting or suspending themselves and protects the last remaining Super Admin.

### Manager

The default Manager role is designed for broad daily operational control, including sales, inventory, reports, customers, promotions, and staff. Selected owner-level controls such as system-role management, application settings, and audit logs remain restricted by default.

### Staff

The default Staff role is designed for daily work such as:

- Dashboard access
- Catalog viewing
- POS access
- Order viewing and fulfillment
- Customer lookup
- Chat handling
- Warehouse and inventory viewing

It does not receive sensitive discount, payment-review, finance, credit, or advanced inventory-change permissions by default.

### Custom roles

Authorized administrators can create additional roles and select permissions from grouped areas such as:

- Overview
- Access control
- Catalog
- Sales
- Reports
- Finance
- Marketing
- Support
- Inventory
- POS

Examples include Warehouse Clerk, Senior Cashier, Customer Support Agent, Marketing Manager, Accountant, or Branch Supervisor.

### Warehouse restrictions

Staff can be assigned to selected warehouses. Product availability, POS selling, receiving, adjustments, transfers, finance, and reports check these assignments where applicable. Users with location-management authority can access all active warehouses.

---

## 8. Security, Reliability, and Data-Control Specification

### Authentication security

- Separate staff and customer login experiences
- Separate administrator session cookie so staff and customer sessions can coexist in one browser
- Password hashing through the Laravel authentication framework
- Password reset by email
- Password confirmation for sensitive profile actions
- Email verification routes
- Optional Google sign-in when valid Google credentials are configured
- Customer registration using email or phone
- Staff registration disabled from the public interface
- Active/suspended staff status enforcement
- Automatic session invalidation for suspended administrators

### Request and application security

- CSRF protection for state-changing web requests
- Fresh CSRF token handling for the single-page interface
- Encrypted cookies
- Server-side validation for forms, transactions, dates, amounts, units, permissions, and file types
- Laravel Sanctum protection for authenticated chat APIs
- Signed and rate-limited email-verification links
- Restricted upload types and file-size limits
- Database transactions around critical sale, checkout, stock, credit, and payment workflows
- Row locking during sensitive stock, credit, coupon, and order operations

### Authorization security

- Role-based permissions
- Per-route permission enforcement
- Per-action policy checks for inventory documents
- Warehouse assignment checks
- Super-Admin-only controls
- Payment-review permission
- Discount and free-of-charge permission
- Credit-management permission
- Report and audit-log permissions

### Data integrity controls

- Unique generated product, order, receipt, transfer, adjustment, and credit-transaction identifiers
- Unique barcodes and coupon codes
- Inventory idempotency keys to prevent accidental duplicate movements
- Before and after stock balances on movement records
- Cost, price, unit, payment-account, and promotion snapshots on transactions
- Negative-stock protection by default
- Reservation expiration and release
- Ledger reconciliation
- Safe deactivation when history exists
- Compensating movements for selected destructive inventory operations

### Audit logging

Recorded administrative events include many high-value operations, such as:

- Staff creation, update, status change, and deletion
- Role creation, permission update, and deletion
- POS sales
- Order creation, payment review, status changes, cancellation, and deletion
- Product, coupon, flash-sale, review, storefront, finance, credit, loyalty, inventory, and settings changes

Each audit record can include the acting user, action name, affected subject, relevant properties, IP address, user agent, and time.

### Deployment responsibilities

The application provides security controls, but production security also depends on deployment. A production installation should use:

- HTTPS/TLS
- Strong production credentials
- A unique application encryption key
- A production database user with limited privileges
- Secure file and directory permissions
- Regular off-server backups
- Queue and scheduler supervision
- Log monitoring
- Firewall and server patching
- Secure email and optional broadcasting credentials

Multi-factor authentication, enterprise single sign-on, formal tax compliance, and payment-card data processing are not included in the current standard product scope.

---

## 9. Branding, Language, and User Experience

### Brand configuration

- Application/store name
- Currency label, with MMK as the default
- Primary theme color
- Logo
- Favicon and PWA icon fallback
- Email addresses
- Phone numbers
- Facebook links
- TikTok links

These settings flow into customer-facing pages, administrative branding, PWA metadata, and vouchers where applicable.

### Localization

- English interface
- Myanmar interface
- Language switcher
- Session-persisted language choice
- Myanmar-compatible font stack
- Localization support in both storefront and administration navigation

Japanese and other languages are not part of the current standard language set but can be added through the application's translation structure.

### Administrative user experience

- Responsive compact dashboard
- Permission-aware collapsible navigation
- Searchable administration menu
- Light and dark themes
- Compact and comfortable density modes
- Persistent user preference in the browser
- Configurable brand color
- High-density tables and filters for business users
- Mobile-responsive layouts for many administrative workflows

### Storefront user experience

- Mobile-first layout
- Touch-friendly navigation and controls
- Bottom navigation on smaller screens
- Product imagery and responsive grids
- App-like PWA mode
- Persistent cart and wishlist
- Loading states and paginated data
- Brand-color-driven visual theme

The current storefront uses a light theme. The administrator supports both light and dark themes.

---

## 10. Technical Specification

### Application stack

- **Backend:** PHP 8+ and Laravel 9
- **Frontend:** React 18
- **Component system:** Material UI with custom administration styles
- **State management:** Zustand for cart and wishlist persistence
- **Server-state management:** TanStack React Query in interactive modules
- **API authentication:** Laravel Sanctum
- **Database:** MySQL-compatible relational database
- **Build system:** Vite
- **HTTP client:** Axios
- **PDF generation:** Puppeteer-based voucher rendering and Dompdf for credit statements
- **Optional social login:** Laravel Socialite with Google
- **Optional broadcasting foundation:** Laravel Echo, Pusher JavaScript, and Pusher server library

### Architecture

The application uses a modular monolithic architecture:

- Laravel controllers validate requests and coordinate workflows.
- Service classes contain inventory, POS, payment, loyalty, coupon, credit, reporting, chat, and settings logic.
- Eloquent models represent products, units, orders, stock, customers, roles, finance, campaigns, and content.
- React pages provide the customer and administrative single-page experiences.
- A shared relational database maintains transactional consistency across modules.

This architecture is practical for a small or medium-sized business because it is easier to deploy and operate than a distributed microservice system while still separating important business logic into clear services.

### Core data areas

- Users, roles, permissions, and warehouse assignments
- Products, categories, images, units, price types, and unit prices
- Warehouses, balances, movements, reservations, receipts, adjustments, and transfers
- Orders, order lines, payments, returns data foundation, coupons, and vouchers
- POS registers, held carts, and shift data foundation
- Customer credit transactions and loyalty histories
- Reviews, conversations, and messages
- Flash sales and campaign items
- Blog posts, categories, and tags
- Storefront blocks and application settings
- Finance entries and categories
- Audit logs, stock alerts, and operations health checks

### Scheduled operations

- Every five minutes: expire old online stock reservations
- Every fifteen minutes: record operations health checks
- Daily at 02:00: reconcile inventory balances with the movement ledger
- Daily at a configurable time: scan and notify low-stock conditions

These tasks require the Laravel scheduler to be running in production.

### Storage

The current implementation supports local/public application storage for:

- Product images
- Payment proofs
- Chat images
- Avatars
- Payment-method icons
- Store logos, favicons, and storefront banners
- Temporary voucher PDF generation

Cloud object storage can be added through Laravel's filesystem abstraction when required.

### Browser and device compatibility

The application is designed for modern browsers, including current versions of Chrome, Edge, Firefox, and Safari. It can operate on:

- Desktop computers
- Laptops
- Tablets
- Modern smartphones
- Touch-enabled POS devices with a standards-compliant browser

USB barcode scanners that operate as keyboard input can normally use the barcode search field without a proprietary integration. Receipt printing uses browser/PDF workflows. Direct cash-drawer, weighing-scale, fiscal-printer, payment-terminal, and proprietary barcode-printer integrations are outside the current standard scope.

---

## 11. Configuration Options

The platform can be adapted without changing its fundamental business logic.

### Store configuration

- Store name
- Currency label
- Brand color
- Logo and favicon
- Contact channels
- Shipping flat rate
- Free-shipping threshold

### Inventory configuration

- Default opening warehouse
- Default fulfillment warehouse
- Negative-stock policy
- Online reservation timeout
- Low-stock notification time
- Backup path and stale-backup threshold
- POS and inventory feature flags

### Loyalty configuration

- Enabled status
- Earn rate
- Redemption value
- Minimum redemption
- Tier thresholds
- Tier multipliers

### Infrastructure configuration

- Database connection
- Application URL
- Session behavior
- Mail service
- Queue driver
- Cache driver
- Filesystem disk
- Google authentication credentials
- Pusher-compatible broadcasting credentials

---

## 12. Current Product Boundaries

Clear product positioning builds customer trust. The following boundaries describe the current standard implementation:

- Online payments use administrator-verified payment screenshots; automated card capture and settlement are not included.
- POS requires a live connection to the application server. It is not an offline-first POS.
- The PWA can cache public pages and assets, but secure transactions remain online.
- Held-cart data and API foundations exist, but the current POS workspace does not expose a complete hold-and-resume user workflow.
- Formal POS shift opening, closing, cash counting, and variance reconciliation are not exposed as a complete current workflow, although register and shift data foundations exist.
- Register records can be configured, but current direct POS checkout records sales at the warehouse level and does not require an active shift.
- Stock transfers are completed immediately; a multi-step submitted/approved/in-transit/received workflow is not exposed in the current interface.
- Stock adjustments post immediately; a maker-checker approval workflow is not exposed in the current interface.
- Preorder fields exist in the order data foundation, but the current public catalog sells available products and does not expose a customer-selectable preorder workflow.
- A full partial-return, item exchange, store-credit, and partial-refund workspace is not currently exposed.
- Tax fields exist in the order structure, but current checkout sets tax to zero and does not provide a general configurable tax engine.
- Shipping uses a flat charge and free-shipping threshold; carrier-rate calculation and shipment-label integrations are not included.
- Customer chat uses secure polling; complete WebSocket push requires additional event integration and infrastructure configuration.
- The system provides operational finance and profitability information, not statutory double-entry accounting or automated tax filing.
- English and Myanmar are the current supported languages.
- The storefront currently uses a light theme; dark mode is available in administration.
- Backup health can be monitored when a backup path is configured, but the application does not itself replace a complete off-server backup system.
- Multi-vendor marketplace, subscription billing, native mobile applications, and marketplace seller payouts are not included.

These boundaries can also be used as a product-extension roadmap for enterprise customers with additional requirements.

---

## 13. Implementation and Onboarding Approach

### Phase 1: Business discovery

- Identify sales channels
- Identify warehouses
- Review product units and price types
- Review customer-credit policy
- Review staff responsibilities
- Review payment methods
- Define reports and management KPIs

### Phase 2: Environment and branding

- Prepare hosting, database, domain, and SSL
- Configure application and database credentials
- Set application URL, mail, queue, cache, and storage
- Upload logo and favicon
- Configure store name, currency, theme, and contact information

### Phase 3: Master data

- Create warehouses
- Create categories
- Import or enter products
- Verify unit conversions and prices
- Receive opening stock
- Configure payment accounts

### Phase 4: Users and controls

- Create staff accounts
- Assign roles
- Assign warehouses
- Test permission boundaries
- Configure loyalty and customer-credit policies

### Phase 5: Storefront and marketing

- Configure homepage hero and promotional blocks
- Prepare product photography and descriptions
- Publish key buying guides
- Configure coupons or launch campaigns
- Test customer registration, cart, checkout, and payment proof

### Phase 6: User acceptance testing

- Test POS cash, non-cash, discount, FOC, customer, and credit scenarios
- Test online reservation, confirmation, rejection, cancellation, and fulfillment
- Test receipt, voucher, public invoice, and PDF generation
- Test receiving, adjustment, transfer, and low-stock scenarios
- Test staff access restrictions
- Test reports and exports
- Test mobile layouts and PWA installation

### Phase 7: Go-live

- Confirm production backups
- Confirm HTTPS and mail delivery
- Start queue workers and scheduler
- Train users by role
- Load final opening balances
- Perform supervised initial transactions
- Review inventory and finance reports after the first trading day

---

## 14. Expected Business Benefits

### Operational efficiency

- Less repeated data entry
- Faster product and price lookup
- Faster order and payment handling
- Easier warehouse receiving and stock counting
- More organized customer service
- Fewer manual calculations

### Inventory control

- Better visibility into stock by warehouse
- Reduced overselling
- Clear separation of physical, reserved, and available quantities
- Traceable adjustments and transfers
- Faster identification of low and unavailable products
- More reliable inventory valuation

### Revenue growth

- Ability to sell online and in-store from one catalog
- Targeted coupons and flash sales
- Loyalty-based repeat purchase incentives
- Personalized recommendations
- Frequently bought together cross-selling
- Better content marketing through blogs and guides
- Faster checkout and improved customer experience

### Financial insight

- Revenue and cost captured from the same transactions
- Gross profit and margin visibility
- Categorized expense tracking
- Promotion and discount measurement
- Customer credit aging
- CSV data for further analysis

### Management control

- Individual staff accounts
- Permission-based delegation
- Warehouse restrictions
- Audit history
- Consistent workflows
- Scheduled health and reconciliation checks

### Customer experience

- Convenient mobile shopping
- Clear product information and unit selection
- Saved cart and wishlist
- Order and payment status visibility
- Support chat
- Loyalty and credit self-service
- Professional vouchers and statements

---

## 15. Marketing Positioning

### One-sentence description

OnlineShop is an integrated ecommerce, POS, inventory, customer, marketing, and reporting platform that helps retailers manage in-store and online sales from one reliable system.

### Short marketing description

Run your counter, online shop, warehouses, customers, promotions, credit, and reports from one connected platform. OnlineShop helps your team sell faster, protect stock accuracy, control staff access, reward loyal customers, and understand business performance without relying on disconnected spreadsheets and manual records.

### Extended marketing description

OnlineShop gives growing retailers the tools to manage the complete sales journey—from product setup and stock receiving to POS checkout, online payment verification, fulfillment, loyalty, customer credit, and profit reporting. Products can be sold in multiple units and price levels, inventory is controlled by warehouse, online orders reserve stock, and every important transaction contributes to a traceable operational history. With a mobile-first storefront, configurable branding, English/Myanmar interfaces, coupons, flash sales, reviews, recommendations, blogs, customer chat, and detailed management reports, OnlineShop helps businesses improve both customer experience and internal control.

### Suggested website headline

> **One platform for every sale, every product, and every warehouse.**

### Suggested website subheading

> Sell at the counter and online, keep inventory accurate, manage customers and promotions, and see how your business is performing—all from one connected commerce platform.

### Alternative campaign headlines

- Turn daily sales into clear business intelligence.
- Stop guessing what is in stock.
- From barcode to balance sheet insight.
- Your online store and physical counter, finally connected.
- Sell by piece, pack, or box without losing inventory accuracy.
- Reward loyal customers and control customer credit with confidence.
- Give every employee the access they need—and nothing more.
- Grow beyond spreadsheets with a complete retail operating system.

### Key selling points

- POS and ecommerce connected to one inventory source
- Multiple units and dynamic prices for real-world selling
- Warehouse-aware stock, reservations, receipts, counts, and transfers
- Customer loyalty and controlled credit management
- Coupons, flash sales, reviews, recommendations, and content marketing
- Detailed sales, inventory, credit, finance, and profitability reports
- English and Myanmar interface
- Custom brand, currency, logo, colors, and homepage content
- Permission-based staff and warehouse access
- Mobile-friendly storefront with installable PWA experience

---

## 16. Sales Demonstration Script

A strong product demonstration can follow this story:

1. Begin on the management dashboard and show revenue, recent orders, top products, and low-stock alerts.
2. Open a product and demonstrate pieces, packs, boxes, conversion factors, retail price, and wholesale price.
3. Open the inventory screen and show the same product in two warehouses with on-hand, reserved, and available quantities.
4. Enter the POS, scan or search the product, select a unit and price type, add a permitted discount, and complete a cash sale.
5. Open the receipt and show that inventory and finance updated automatically.
6. Visit the mobile storefront, add the same product to the cart, apply a coupon or loyalty points, and submit an online payment screenshot.
7. Return to administration, review the proof, confirm payment, and show the order moving to processing.
8. Show the customer's order status, loyalty balance, purchase history, and support chat.
9. Create a stock receipt and show the warehouse balance and purchase expense update.
10. Finish with sales, profit, inventory, promotion, POS, and credit reports.

This demonstration communicates the main value of the product: every department is working with the same transaction data.

---

## 17. Frequently Asked Questions

### Can the software be used for both a physical store and an online shop?

Yes. POS and online sales use the same products, units, customers, inventory balances, and reporting structure. Each order records its sales channel.

### Can one product be sold in different units?

Yes. A product can have a base unit and multiple selling units with conversion factors. For example, one product can be sold by piece, pack, and carton.

### Can we have retail and wholesale prices?

Yes. Retail is standard, and additional price types such as wholesale, VIP, member, or dealer can be defined for every unit of a product.

### Can it support multiple warehouses?

Yes. Inventory is recorded by warehouse. Staff can be restricted to selected warehouses, and products can be received, counted, sold, reserved, and transferred by location.

### Does it prevent selling stock that is not available?

Yes, negative stock is blocked by default. POS validates available stock, and online orders reserve stock during payment review.

### What happens if an online customer does not complete payment verification?

The order's reservation has a configurable expiry time. A scheduled process can cancel expired pending orders and release stock for other customers.

### Does it accept mobile-wallet or bank-transfer payments?

Yes. The business can configure payment accounts and customers can upload payment proof. Authorized staff then confirm or reject the payment.

### Does it connect directly to Stripe, PayPal, or a card terminal?

Not in the current standard implementation. Those services can be considered as custom integrations.

### Can customers buy on credit?

Yes, at the POS when credit is activated for the selected customer. The system enforces the credit limit and terms and supports deposits, repayments, aging, and PDF statements.

### Can it manage loyalty points?

Yes. Paid customer orders can earn points, online checkout can redeem points, and tier multipliers can reward higher-value customers.

### Can staff apply discounts freely?

Only staff with the appropriate permission can apply POS discounts or free-of-charge quantities.

### Can the owner see who changed something?

Important administrative actions are recorded in audit logs with the acting user and contextual information. Inventory movements also retain their user, reason, reference, and before/after quantities.

### Can products be imported from Excel?

Products can be imported using CSV, which can be prepared in Excel or another spreadsheet application. The system provides a fixed template and validates the rows before importing.

### Can reports be exported?

Yes. Products, orders, sales, inventory, POS tenders, finance, credit aging, balances, and movement data have CSV export workflows. Vouchers and credit statements can be downloaded as PDFs.

### Does it work on phones?

The storefront is mobile-first and installable as a PWA on supported devices. Many administration pages are responsive, and the POS includes mobile-oriented layouts, although a larger screen is recommended for sustained back-office work.

### Does it work without internet?

Public storefront pages and assets previously opened may be available from PWA cache, and the cart remains on the device. Checkout, POS, inventory changes, chat, and other secure transactions require a connection to the application server.

### Can we change the brand and currency?

Yes. The application name, currency label, primary color, logo, favicon, and contact links are configurable.

### Which languages are included?

English and Myanmar are included in the current application.

### Is it an accounting system?

It includes operational income, expenses, cost of goods, gross profit, margin, and estimated net-profit reporting. It is not a replacement for statutory double-entry accounting, tax filing, payroll, or an audited general ledger.

---

## 18. Recommended Success Metrics

After implementation, a business can evaluate the product using measurable outcomes.

### Sales metrics

- Average checkout time
- Average order value
- Units per order
- Repeat-customer rate
- Online conversion from cart to submitted order
- Revenue by sales channel
- Sales by cashier and warehouse

### Inventory metrics

- Stock discrepancy rate
- Number of overselling incidents
- Low-stock response time
- Inventory turnover
- Sell-through rate
- Adjustment loss value
- Reservation expiration rate

### Customer metrics

- Registered customer growth
- Loyalty participation
- Loyalty redemption rate
- Review volume and average rating
- Support response time
- Customer credit collection time
- Overdue credit percentage

### Marketing metrics

- Coupon redemptions
- Revenue per coupon
- Discount cost as a percentage of gross sales
- Flash-sale units and revenue
- Cross-sell basket growth
- Best-selling category growth

### Control metrics

- Percentage of staff using individual accounts
- Audit exceptions
- Failed scheduled jobs
- Backup freshness
- Inventory reconciliation mismatches
- Number of unauthorized-action attempts prevented by permissions

---

## 19. Product Differentiators

### One catalog for POS and ecommerce

Many small-business systems treat the online shop and physical counter as separate products. OnlineShop uses a common product, unit, inventory, customer, and order foundation.

### Real multi-unit inventory logic

The software does not simply display different packaging labels. It converts quantities into a base unit for receipts, sales, reservations, counts, and transfers while preserving the unit used in the transaction.

### Operational traceability

Stock is supported by an append-oriented movement ledger, administrative work is supported by audit logs, and transaction lines keep historical price, cost, unit, payment, and promotion context.

### Customer credit built into commerce

Credit limits, terms, deposits, repayments, aging, and statements are connected to real orders and payment records rather than maintained in an unrelated ledger.

### Marketing and reporting in the same platform

Coupons, flash sales, loyalty, reviews, recommendations, and blogs are connected to the sales and customer data used in reporting.

### Local-market readiness

The application supports English and Myanmar interfaces, configurable MMK labeling, mobile-wallet/bank-transfer proof workflows, and a mobile-first shopping experience.

---

## 20. Glossary

**Available stock:** On-hand stock minus stock reserved for active orders.  
**Base unit:** The smallest inventory unit in which a product is stored.  
**Conversion factor:** The number of base units contained in another unit.  
**Cost of goods:** The captured product cost associated with items sold.  
**Credit aging:** Grouping unpaid balances by the length of time they have been outstanding.  
**FOC:** Free of charge; products supplied without a selling price as part of a deal or service decision.  
**Fulfillment warehouse:** The warehouse used to reserve and supply online orders.  
**Gross margin:** Gross profit expressed as a percentage of revenue.  
**Gross profit:** Revenue minus captured cost of goods.  
**Inventory ledger:** The chronological record of events that increase, decrease, reserve, or release stock.  
**On-hand stock:** The physical quantity recorded at a warehouse before reservations are deducted.  
**PWA:** Progressive Web App; a website that can provide app-like installation and caching features.  
**Reserved stock:** On-hand stock temporarily committed to active online orders.  
**Selling unit:** A unit customers can purchase, such as a piece, pack, or box.  
**Sell-through rate:** The proportion of available and sold quantity that has been sold in a period.  
**Tender:** The form of payment used for a sale, such as cash, card, mobile, or credit.  
**Transaction snapshot:** Historical information copied into an order so later master-data changes do not rewrite the original transaction context.

---

## 21. Final Product Statement

OnlineShop is more than an online product catalog and more than a cash-register screen. It is a connected retail operations platform designed to improve how a business sells, controls stock, serves customers, manages staff, runs promotions, handles credit, and understands performance.

For a growing retailer, its most important benefit is operational connection. The same product definition powers the barcode, POS, website, warehouse, order, invoice, promotion, and report. The same customer record connects purchases, loyalty, reviews, chat, and credit. The same transaction contributes to stock history, financial visibility, and management analysis.

By replacing fragmented manual records with a controlled and traceable workflow, OnlineShop helps a business operate with greater speed, consistency, confidence, and readiness for growth.

---

## 22. Marketing Use Notice

This document describes the current standard application and separates implemented behavior from configuration-dependent capabilities and possible extensions. Before using individual claims in a contract, quotation, or public advertisement, confirm that the customer's selected hosting environment, email service, scheduler, queue, storage, Google login, broadcasting service, and operational configuration have been installed and tested.
