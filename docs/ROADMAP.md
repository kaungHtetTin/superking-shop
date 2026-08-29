# LarlarPick: Development Roadmap

A comprehensive roadmap for the **Romantic, Compact, and Professional** Mini Online Shop Application.

---

## Phase 1: Foundation & Core UI Setup (COMPLETED)

- [x] **Project Scaffolding**: Structured directories for Admin and User sides.
- [x] **Theme Engine**: Integrated Material UI (MUI v9) with a custom "Romantic Pink" palette.
- [x] **Compact Design System**: Reduced border-radii (4px) and dense spacing across all components.
- [x] **Responsive Layouts**: Mobile-first architecture with sticky navbars and bottom navigation.
- [x] **Database Schema**: Created migrations for Users, Products, Categories, Orders, Loyalty, and Chat.
- [x] **Initial UI Showcases**:
    - Landing Page with CSS Grid product displays.
    - Admin Dashboard with high-density stat cards.
    - Glassmorphism Login/Register pages.

## Phase 2: Authentication & Security (COMPLETED)

- [x] **Role-Based Access Control (RBAC)**: Implementation of `admin` and `customer` middleware.
- [x] **Granular Admin Roles**: Defined sub-roles (Super Admin, Manager, Cashier, Support).
- [x] **Admin Default Seeding**: Created default accounts for Super Admin and Manager.
- [x] **Admin Staff Management** (Super Admin user administration):
    - **Admin User CRUD**: Role-based access control (Super Admin, Manager, etc.).
    - Account status management (Active/Suspended).
    - Profile & permission management.
    - Role assignment interface in the admin panel.
- [x] **Restricted Admin Auth**: Ensure Admin login is distinct and registration is disabled.
- [x] **Smart Redirection**: Redirect based on role after login.

## Phase 3: Product & Catalog Management (COMPLETED)

- [x] **Admin Product CRUD**:
    - [x] Multi-image gallery management.
    - [x] Category/Sub-category assignment.
    - [x] Product-unit conversions and base-unit inventory tracking.
- [x] **User Browsing Experience**:
    - [x] Infinite scroll or compact pagination.
    - [x] Category-based filtering and smart search.
    - [x] Product Detail Page with romantic aesthetic and compact specifications.

## Phase 4: Shopping Cart & Order Lifecycle (COMPLETED)

- [x] **State Management**: Cart persisted with **Zustand** (`localStorage`); live badge counts in navbar and mobile nav.
- [x] **Guest Cart + Wishlist**: Storefront users can save cart/wishlist without auth (local persistence).
- [x] **Advanced Cart Variant Flow**:
    - [x] Add-to-cart opens selling-unit selection when multiple units are available.
    - [x] Store exact selected unit, conversion, price, and product-code snapshots.
    - [x] Product detail gallery remains product-level while selling-unit selection controls availability and price.
- [x] **Checkout Flow**:
    - [x] Compact multi-step checkout (MUI Stepper: shipping → payment proof → review).
    - [x] Shipping address management (name, phone, address, notes).
    - [x] Order summary with automatic tax / shipping (config-driven; free shipping threshold).
- [x] **Manual payment verification**:
    - [x] Customer uploads transaction screenshot at checkout (required).
    - [x] Order `payment_status: pending_review` until admin confirms; stock deducted only on confirm.
    - [x] Admin orders list + detail with payment screenshot viewer.
    - [x] Super Admin / Manager can confirm (→ `paid`, `processing`) or reject (→ `cancelled`, customer notified on order page).
- [x] **Order history & status display**: Customer orders list/detail with order + payment status labels.
- [x] **Admin order management**: Stats dashboard, search/filters/tabs, payment review, fulfillment (processing → shipped → delivered), cancel with stock restore, internal admin notes, chat shortcut.

## Phase 5: Loyalty & Smart Features

- [ ] **Loyalty Points System**: Logic to earn/redeem points per purchase.
- [ ] **Tier Logic**: Automatic progression between Bronze, Silver, Gold, and Platinum.
- [ ] **Coupon Engine**: Admin-managed promotional codes with usage constraints.
- [~] **Recommendations System** (partially implemented):
    - [x] Category-based "You May Also Like".
    - [x] Personalized "Recommended for you" based on customer order history.
    - [ ] Frequently Bought Together logic.
    - [ ] Ranking quality tuning / analytics feedback loop.
- [x] **Product Ratings & Reviews**:
    - [x] Customer rating submission (1-5) with optional comment.
    - [x] Product rating average + review count auto refresh on save.
    - [x] Ratings and recent reviews shown on product detail.

## Phase 6: Real-time Communication

- [ ] **Live Chat System**:
    - Real-time customer support using Laravel Echo and Pusher.
    - Admin multi-chat dashboard.
    - Notification badges for unread messages.

## Phase 7: Localization & Refinement

- [x] **User Profile Settings Enhancements**:
    - [x] Storefront logout section.
    - [x] Avatar upload with cropper (1:1 profile crop).
    - [x] Default phone + address settings with checkout prefill.
- [ ] **Multi-language (i18n)**: Support for English, Myanmar, and Japanese.
- [ ] **Dark Mode**: AMOLED-friendly "Romantic Pink" dark theme.
- [ ] **Performance Optimization**:
    - Image compression (WebP).
    - API caching for product catalogs.
    - Skeleton loading for all data-heavy components.

## Phase 8: Deployment & MVP Launch

- [ ] **Production Readiness**: Environment variable auditing and security headers.
- [ ] **Hosting**: Deployment to production environment.
- [ ] **UAT**: User Acceptance Testing for mobile and desktop responsiveness.

---

_Last Updated: May 22, 2026_
