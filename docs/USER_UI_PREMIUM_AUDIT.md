# User-side UI polish audit

Audit date: 2026-08-05  
Visual reference: <https://www.k2softwarestudio.com/onlineshop/public/>  
Codebase: `C:\xampp\htdocs\musical-store`

## Scope and confidence

The public storefront was visually reviewed on desktop (1440 px), tablet (768 px), and compact mobile (500 px), then matched to the local React/MUI source. Public routes reviewed live: Home, Products, Product detail, Categories, Category detail, Cart, Wishlist, Blog index, Login, Register, and Forgot Password.

Checkout, Orders, Profile, and Support Chat require a signed-in customer and were reviewed from their source implementations without changing live data. Populated Cart/Wishlist states, Blog detail, and the public invoice were also source-reviewed because the live deployment did not expose suitable sample state or a public token.

Priority meanings:

- **P0 — broken:** visibly unfinished, unstyled, or damaging customer trust.
- **P1 — high:** major readability, conversion, responsive, or consistency issue.
- **P2 — medium:** meaningful polish that makes the interface feel more deliberate.
- **P3 — low:** finishing detail after the design system is stable.

## Executive summary

The storefront has a solid foundation: the palette is distinctive, the live Home hero has strong imagery, the responsive product grids work, the main calls to action are clear, and the fixed mobile navigation is useful. The main reason it does not yet feel premium is density. Text, controls, card padding, and vertical section spacing are consistently undersized while many headings use extremely heavy synthetic weights.

The most important findings are:

1. **P0: Password recovery is visibly unstyled.** The live Forgot Password page shows an oversized default Laravel logo, raw browser input/button controls, and no card layout. Reset Password, Confirm Password, and Verify Email use the same legacy layout and are at the same risk.
2. **P1: The 4 px global MUI spacing unit compresses almost every page.** Much of the JSX uses values such as `p: 2`, `mt: 4`, and `gap: 2` as though the default MUI unit were 8 px. With `spacing: 4`, these become 8 px, 16 px, and 8 px respectively.
3. **P1: Font weights do not match the loaded font.** Poppins is loaded only through weight 800, but the UI repeatedly requests 850, 900, and 950. Browsers synthesize these weights, producing the blunt, uneven bold appearance visible on the live site.
4. **P1: Important commerce text is too small.** Product metadata is approximately 11–13 px; mobile navigation drops as low as 9.3 px; chat timestamps are approximately 9 px; many secondary labels use default 12 px captions.
5. **P1: The shopper experience uses two competing background systems.** Home, Products, Product detail, Cart, Checkout, and Categories index use the themed storefront gradient, while Wishlist, Category detail, Orders, Blogs, Profile, and Chat use `background.default` (`#FFF7FA`). This creates a noticeable beige/pink shift between routes.
6. **P1: Product detail is weak above the fold on mobile.** A 3:4 gallery consumes roughly 635 px at the reviewed compact width, leaving only the start of the product name visible before the fixed bottom navigation.
7. **P1: The live tablet Home hero hides its image at 768 px but keeps a tall, wide hero.** This leaves a large empty right-hand area and makes the composition feel unfinished.
8. **P1: Empty and low-content pages rely on large blank areas.** Categories, Cart, Wishlist, and Blogs place small content at the top, followed by hundreds of pixels of unused space before the footer.
9. **P1: Live catalog content and storefront language conflict.** The live store sells cosmetics, clothes, electronics, and music items, but the shell says “Musical instrument store,” “Shop by sound,” and “Instruments, gear & studio essentials.” This weakens brand credibility even when the layout itself is polished.
10. **P2: Product imagery lacks a consistent merchandising standard.** The live catalog mixes studio photography, cut-outs, lifestyle photos, screenshots, Chinese text overlays, and different subject scales. UI styling alone cannot make this grid feel premium until image direction is normalized.

## Recommended design tokens

Do not simply change `theme.spacing` from 4 to 8 globally; that would also double intentionally compact values. Introduce explicit storefront tokens and migrate shared components first.

| Token | Mobile | Tablet/Desktop | Use |
|---|---:|---:|---|
| Page gutter | 16 px | 24 / 32 px | Main containers |
| Page top padding | 24 px | 32–40 px | Below sticky header |
| Section gap | 32 px | 48–64 px | Home and detail sections |
| Panel padding | 20 px | 24–32 px | Forms, summaries, empty states |
| Card padding | 14–16 px | 16–20 px | Product/category/blog/order cards |
| Grid gap | 12 px | 16–20 px | Card grids |
| Control height | 44–48 px | 44–48 px | Inputs, buttons, icon actions |
| Small radius | 8 px | 8 px | Inputs and chips |
| Card radius | 12 px | 12–14 px | Cards and panels |
| Feature radius | 16 px | 16–20 px | Hero and major promotional surfaces |

Updated typography direction (Taobao/Pinduoduo-inspired compact commerce density):

| Role | Recommended size / line height | Weight |
|---|---|---:|
| Hero title | 26–40 px / 1.1 | 700 |
| Page title | 22–28 px / 1.18 | 700 |
| Section title | 19–22 px / 1.2 | 600–700 |
| Card title | 13–14 px / 1.35 | 600 |
| Body | 14–15 px / 1.6 | 400 |
| Secondary body | 13 px / 1.55 | 400 |
| Caption/meta | 11.5–12 px / 1.45 | 400–600 |
| Eyebrow | 10.5–11 px / 1.4, `0.06em` tracking | 700 |

Use the native system sans-serif stack for a cleaner, denser commerce feel. Reserve weight 700 for prices, primary actions, and important headings; use 400–600 elsewhere. Myanmar text should use slightly more line height (at least 1.55 for body copy) and must be checked separately because translated labels are often longer.

Primary foundation targets:

- `resources/js/Theme/UserTheme.js:65-91` — spacing, type scale, control height, and global radii.
- `resources/views/app.blade.php:19-21` — loaded font weights.
- `resources/js/Components/User/musicStoreDesign.js:42-82` — shared panels, eyebrow, shadows, and buttons.
- `resources/css/app.css:1-115` — global overflow, language switcher, and mobile overrides.

## Shared components

### Header / navbar — P1

What works: sticky behavior, dark surface, desktop search, action visibility, and mobile second-row search are clear.

Update:

- Increase the desktop toolbar from 56 px to 64–68 px and give the brand/navigation/actions more breathing room.
- Use 40 px desktop and 44 px mobile icon-button hit areas. Current `size="small"` actions feel delicate and are difficult to tap.
- Increase the search control to 44–46 px high; use 14 px input text and a 15 px placeholder. The current 13.6 px search text is visually subordinate despite being a primary navigation tool.
- Keep the search width around 320–380 px on large screens. The current placeholder truncates on desktop.
- At narrow widths, replace the full language select with a compact `EN / MY` control or move language into the profile menu. The logo, chat, cart, language, and profile controls compete for one row.
- Give the desktop brand tagline a 12–13 px size and normal/medium weight instead of making every line bold.
- Add a visible active state for Shop and Categories, not hover styling only.

Source: `resources/js/Components/User/Navbar.jsx:13-65`, `128-246`.

### Mobile bottom navigation — P1

Update:

- Increase height from 56 px to 62–64 px plus the safe-area inset.
- Increase icons from 19.2 px to 22–24 px.
- Increase labels from `0.65rem` (10.4 px) to 11.5–12 px. Remove the `0.58rem` (~9.3 px) override below 380 px.
- Preserve five equal-width items, but use color plus a small top indicator or filled icon for the active state. The current color-only state is subtle.
- Verify that every page includes matching bottom padding; Chat handles this explicitly, while other pages use a spacer or custom padding.

Source: `resources/js/Components/User/MobileBottomNav.jsx:12-144`, `resources/css/app.css:251-267`.

### Footer — P2

Update:

- Increase link/body copy from caption size to 13–14 px with 1.55 line height.
- Increase desktop vertical padding to 48–56 px and mobile padding to 32–40 px.
- Add customer-confidence links: Contact, Delivery, Returns, Payment, Privacy, and Terms. The present footer reads more like a developer signature than a retail support surface.
- Keep “Developed by” visually tertiary; separate it from the customer-facing copyright and trust content.
- On empty pages, use a richer empty-state region rather than relying on the footer to visually close a mostly blank viewport.

Source: `resources/js/Components/User/Footer.jsx:36-245`.

### Product card — P1

Update:

- Increase `CardContent` from hard-coded 10 px to 14 px mobile / 16 px desktop.
- Increase category text from 10.9 px to 12 px, product title from about 13.2 px to 14.5–15 px, rating/review text from 11.2–11.5 px to 12–12.5 px, and price to 16–18 px.
- Replace “0 No reviews yet” with just “No reviews yet”; do not display a numeric zero next to the empty state.
- Increase floating wishlist/cart actions to 36–40 px hit areas and add a stronger pressed/selected state.
- Consider four columns at `lg` for a more premium merchandising rhythm. Five columns are efficient but make titles and prices look compressed. If five columns remain, enforce a card minimum width around 210–220 px.
- Add an internal image fallback component with a stable neutral background. The local seeded catalog demonstrated that an external placeholder failure exposes alt text and destroys the image surface.
- Define one image policy (preferably 4:5 or 3:4), focal-point cropping, minimum resolution, and no text-overlay rule for product uploads.

Source: `resources/js/Components/User/ProductCard.jsx:182-335`, `resources/js/Utils/productListGrid.js:1-23`.

### Back link, chips, inputs, and buttons — P2

Update:

- Back links should align to the same content edge as the title; Product detail currently uses an extra-wide container and appears detached from the main gallery.
- Keep pill radius for chips and compact back links only. Use 8 px inputs, 10–12 px cards, and 16 px feature panels instead of mixing radius values page by page.
- Ensure all form inputs and primary buttons are at least 44 px high; login/register fields currently inherit compact MUI sizing.
- Normalize focus rings across buttons, cards, icon actions, and custom clickable `Box` elements.

Source: `resources/js/Components/User/BackLink.jsx`, `resources/js/Theme/UserTheme.js:84-121`.

## Page-by-page audit

### 1. Home — Live + source

#### Hero — P1

- Desktop composition is strong and is the best-looking area of the storefront.
- At 768 px the image is hidden (`display: none` below `md`) but the hero remains 320 px tall and wide. Keep a cropped image/texture at `sm`, add a gradient overlay, or reduce the image-less tablet hero to about 260–280 px.
- Mobile buttons are appropriately full width. Increase the space between subtitle and actions from the effective 12 px to 20–24 px.
- Use 800 rather than 950 for the title. The synthetic ultra-bold weight currently makes rounded Poppins letterforms look swollen.
- If the catalog remains general retail, replace the hard-coded musical eyebrow, chips, and support copy with configurable storefront language.

Source: `resources/js/Pages/User/Welcome.jsx:316-426`.

#### Department shortcuts — P2

- Increase label size from 11.2 px to 12–13 px and icon tiles from 48 px to 56 px on mobile.
- The live Home cards work visually, but the section gap is only about 16 px because `mt: 4` uses the 4 px spacing unit. Target 32 px mobile / 48 px desktop.
- Keep category naming singular/plural consistent; the live page mixes “Cosmetic” with “Clothes,” “Electronics,” and “Music.”

Source: `resources/js/Pages/User/Welcome.jsx:429-509`.

#### Flash-sale section — P1

- On compact mobile the title, end-time chip, and “More deals” action break into an awkward multi-row header. Use an explicit two-row layout: title/time on the first row, short supporting copy and action on the second.
- Give the sale panel 20 px mobile / 24 px desktop padding instead of the current effective 6–9 px values.
- Do not show a sale as active when its end date is in the past; this is a trust issue, not only a styling detail.
- Make sale pricing visually consistent: sale price first, original price smaller, discount percentage in a compact badge.

Source: `resources/js/Pages/User/Welcome.jsx:512-546`.

#### Promo, product, blog, and payment sections — P2

- Use a consistent 40–48 px separation between these modules; current `mt: 4`/`mb: 4` resolves to 16 px.
- Standardize `SectionHeader`: 24–28 px title, 14 px supporting copy, and action aligned on the same baseline on desktop.
- Product grids should use the improved Product Card rules above.
- Blog preview padding is currently an effective 6 px (`p: 1.5`). Increase it to 16–20 px.
- Payment method cards should have 16 px padding and 48 px icons; account numbers need clear grouping and copy affordances at checkout rather than being presented like ordinary captions.

Source: `resources/js/Pages/User/Welcome.jsx:103-123`, `154-210`, `548-698`.

### 2. Products / catalog — Live + source

#### Page heading — P1

- The heading panel is clean, but its padding is only 8–10 px. Use 20 px mobile / 24 px desktop.
- On mobile, the title and Filters button fit but feel crowded. Keep the title at 30–34 px and vertically align a 44 px Filters button at the top-right.
- The live initial catalog shows a Filters badge of `1` even though no obvious filter is applied. Correct the backend/default filter comparison so the default view displays no badge.

#### Filter controls — P1

- Desktop presents three dense filter rows before products. Consolidate into a primary toolbar (search, sort, Filters) and move price/rating/flash-sale into a popover or drawer.
- Increase inputs and buttons to 44 px high and group related controls inside one softly bordered toolbar.
- Add an “Active filters” row only when filters exist, with removable chips and a single Clear all action.
- In the mobile drawer, keep the bottom Apply/Reset actions sticky so customers do not need to scroll to submit.

#### Product grid — P1

- Five columns at 1200 px make metadata and pricing too small. Prefer four columns for a premium layout, or enforce a 210–220 px minimum.
- Mobile two-column layout is appropriate. Use 12 px gap and slightly shorter media where products are not fashion-oriented so more than two products can be evaluated per screen.

Source: `resources/js/Pages/User/Products/Index.jsx:121-309`, `321-641`.

### 3. Product detail — Live + source

#### Gallery — P1

- On compact mobile the 3:4 gallery occupies almost the entire first viewport. Use `aspect-ratio: 1 / 1` on mobile, cap it at `min(72vw, 420px)`/`55dvh`, or use a shorter 4:5 surface.
- Keep the name, price, variant status, and Add to Cart visible within the first 1–1.5 viewports.
- Thumbnail controls belong near the gallery on desktop, but on mobile use compact dots or a horizontal thumbnail strip immediately below the image.
- The gallery uses `objectFit: contain`; preserve that for electronics/product cut-outs, but allow a product-level focal/crop mode for lifestyle imagery.

Source: `resources/js/Pages/User/Products/Show.jsx:176-311`.

#### Product information and purchase actions — P1

- Change `maxWidth="xl"` to the same 1200 px content shell used by the storefront, or constrain the review area separately. The live detail page stretches much wider than the catalog and header.
- Reduce name/price weight to 800 and use consistent sizes: name 34–44 px desktop / 28–34 px mobile; price 32–40 px desktop / 26–32 px mobile.
- Make rating text 13 px and use a friendlier empty state (“New — not reviewed yet”) rather than five low-contrast empty stars plus “0 reviews.”
- Variant buttons need at least 44 px height and clearer selected styling. Avoid putting two lines of 12 px text inside a compact toggle.
- On mobile, add a sticky purchase bar containing price and Add to Cart after the user scrolls beyond the product information.
- The full-width mobile wishlist button wastes vertical space; make it a 48 px square next to Add to Cart.

Source: `resources/js/Pages/User/Products/Show.jsx:313-473`.

#### Description, reviews, and recommendations — P2

- “No description available” inside a large card looks unfinished. Hide the section when empty or show structured product specifications instead.
- Constrain reviews to a readable 900–1000 px width and add rating distribution when reviews exist.
- Current recommendation sections use `mt: 10`, which is only 40 px. Standardize them to 56–64 px and reuse the same section header/card grid as Home.

Source: `resources/js/Pages/User/Products/Show.jsx:475-638`.

### 4. Categories index — Live + source

#### Heading and category cards — P1

- Cards are 148–160 px high while their icon, title, and count sit in the top-left, leaving most of each card empty. Either reduce card height to about 116–128 px or use the full surface for imagery/gradient and vertically center the content.
- Increase padding from the effective 8 px to 16–20 px, title to 15–16 px, and count to 13 px.
- Hide empty categories from the public index or make them visibly disabled. The live “Cosmetic — 0 items” card currently looks actionable.
- Increase grid gap to 16 px mobile and 20 px desktop.
- The page has a large blank region before the footer. A short merchandising block (“Popular this week,” “Need help choosing?”) or a richer category card layout would produce better balance.

Source: `resources/js/Pages/User/Categories/Index.jsx:59-227`, especially `93-109`.

### 5. Category detail — Live + source

#### Breadcrumb and category summary — P2

- Showing both a breadcrumb and “All categories” back pill is redundant. Keep breadcrumbs on desktop and the back pill on mobile.
- “Shop this category” is a full-width CTA even though the customer is already viewing the category. Replace it with sorting/filter controls or remove it.
- Increase summary panel padding to 20–24 px and keep product count close to the title.
- Use the same themed background and section shell as Products; this route currently switches to the pink `background.default`.

#### Product list — P1

- Reuse the improved Product Card sizing and 12–16 px gaps.
- Add sort/filter controls when a category has enough products; otherwise keep the header deliberately simple.

Source: `resources/js/Pages/User/Categories/Show.jsx:47-214`.

### 6. Cart — Live empty state + source populated state

#### Empty state — P2

- Add a simple branded illustration/icon, a stronger 18–20 px empty-state title, and 14–15 px body copy.
- Increase panel padding to 28–32 px and cap body text at roughly 520 px.
- Consider a row of recently viewed or popular products to avoid the large blank viewport.

#### Cart lines — P1

- Current line padding is only 5–6 px; use 14–16 px.
- Quantity and delete IconButtons use `p: 0.5` and fall well below a 44 px mobile hit target. Use a 40–44 px segmented control and a separate 40–44 px remove action.
- Keep product image at 80–96 px, but make the title 15 px and the total 16–18 px.
- On desktop, use a two-column layout with a sticky order summary; on mobile, keep the checkout CTA sticky above bottom navigation when the cart is populated.
- Replace the external `via.placeholder.com` fallback with an internal stable asset.

Source: `resources/js/Pages/User/Cart/Index.jsx:44-218`.

### 7. Wishlist — Live empty state + source populated state

- Apply the same richer empty-state pattern as Cart; the current white panel is small relative to the empty page.
- Add item count and a “Move all available to cart” action when populated.
- Use the same themed background as Products instead of `background.default`.
- Reuse the improved Product Card grid and pagination spacing.

Source: `resources/js/Pages/User/Wishlist/Index.jsx:48-94`.

### 8. Checkout — Source-only

#### Stepper — P1

- The three text labels will be crowded on narrow devices. Use numbered compact steps with the current step title shown separately below, or hide inactive labels under 480 px.
- Increase spacing below the stepper to 24 px and make the current/completed states more visually distinct.

#### Customer and payment forms — P1

- Increase panel padding from the effective 8–12 px to 20–24 px.
- Use 48 px input height, 14–16 px text, consistent helper/error spacing, and grouped section headings.
- Payment cards need at least 14–16 px padding, a 48 px provider icon, a stronger selected state, and a copy button for account number.
- Replace the long info alert with a shorter three-step payment instruction list.
- Make upload state feel intentional: dashed drop zone, file requirements, preview, Replace, and Remove actions.

#### Summary and navigation — P1

- On desktop, add a sticky order-summary column visible throughout all steps; the current single `maxWidth="md"` column hides purchase context until Review.
- On mobile, show total immediately above the sticky Continue/Submit action.
- Keep Back visually secondary and ensure the primary action is always the first focus after validation errors.

Source: `resources/js/Pages/User/Checkout/Index.jsx:158-540`.

### 9. Orders list — Source-only

- Increase order-card padding from the effective 8 px to 16–20 px.
- Use 15–16 px order number, 12–13 px date/meta, and 18 px total.
- Keep fulfillment and payment statuses separate, but do not let two chips plus amount compete on one narrow row; stack amount above status chips on mobile.
- Add a small item thumbnail stack or item-count summary to make orders easier to scan.
- Upgrade the empty state with an icon and suggested products.

Source: `resources/js/Pages/User/Orders/Index.jsx:40-105`.

### 10. Order detail — Source-only

- Replace the two status chips alone with a compact order timeline: Placed → Payment review → Processing → Shipped → Delivered.
- Separate delivery address, payment, and order notes into labeled summary blocks; current content is visually flat.
- Give each item a 56–72 px thumbnail and align line totals consistently.
- Use a sticky or emphasized total/payment panel on desktop.
- Payment proof should have a clear thumbnail, file state, and verification explanation rather than appearing late in the page.
- Add practical actions near the title: Download invoice, Contact support, and Continue shopping.

Source: `resources/js/Pages/User/Orders/Show.jsx:57-250`.

### 11. Support Chat — Source-only

#### Header and messages — P1

- Increase support name from 12.8–13.8 px to 15–16 px; status from 9.9 px to 12 px.
- Increase message text from 11.2–11.8 px to 14 px with 1.45 line height.
- Increase timestamps/sent state from 9.1 px to at least 11 px.
- On desktop, constrain the chat surface to about 760–840 px and center it. Message bubbles can remain 64–70% wide with a practical maximum around 520 px.
- Reduce hover motion on messages; premium chat should feel stable, with motion reserved for arrival/sending state.

#### Composer — P1

- Ensure attach, input, and send controls are 44–48 px high with 44 px icon hit targets.
- Maintain the existing safe-area/bottom-nav reservation; it is a good implementation detail.
- Show upload progress and image preview without shrinking the message viewport excessively.

Source: `resources/js/Pages/User/Chat/Show.jsx:320-415`, `460-590`, `645-740`.

### 12. Blog index — Live empty state + source populated state

#### Index heading, search, and filters — P2

- The live heading is clear. Increase its bottom spacing to 24–32 px.
- When there are zero posts, hide the search form and the useless “All” filter chip. Show them once content exists.
- Replace the small empty panel with an illustration/icon, a useful explanation, and links to popular products/categories.

#### Blog cards — P2

- Increase content padding from the effective 8 px to 16–20 px.
- Use 12 px category/date, 16–18 px title, and 14 px excerpt.
- Increase radius from 4 px to the shared 12 px card radius and use the shared hover/focus treatment.

Source: `resources/js/Pages/User/Blogs/Index.jsx:27-176`.

### 13. Blog detail — Source-only

- Keep the article body at 16–18 px, 1.7–1.8 line height, and a text measure of about 65–72 characters.
- The page `maxWidth="md"` is appropriate, but the content panel padding should be 20 px mobile / 32–40 px desktop.
- Normalize rich-content spacing for paragraphs, lists, images, headings, captions, links, and blockquotes; current custom styling only covers headings and blockquotes.
- Related posts should use proper cards or a compact thumbnail list with 14–16 px titles, not another lightly padded box.
- Use the same storefront background as the rest of the customer journey.

Source: `resources/js/Pages/User/Blogs/Show.jsx:25-165`.

### 14. Profile / account — Source-only

- Add a compact account summary at the top with avatar, name, email/phone, and verification state.
- Four consecutive outlined panels with effective 12 px padding feel administrative. Use 20 px mobile / 24 px desktop and clearer section headers.
- On desktop, use a left section navigation or two-column layout; on mobile, use accordions for Password, Sessions/Logout, and Delete account.
- Give the danger zone a subtle red tint and stronger separation from normal settings.
- Add the shared Footer on desktop or deliberately use an account-shell variant; the current shopper profile stops after content and bottom navigation.
- Use the themed storefront background rather than the pink default.

Source: `resources/js/Pages/Profile/Edit.jsx:20-91` and `resources/js/Pages/Profile/Partials/*`.

### 15. Login and registration — Live + source

What works: centered layout, restrained palette, clear primary action, and good responsive width.

Update:

- Display the configured store logo above the title and add a subtle “Back to shop” link.
- Increase card padding to 28–32 px and input/button height to 48 px.
- Use a 30–34 px title at 800 weight rather than synthetic 950.
- When Google OAuth is unavailable, hide the divider and disabled Google button entirely. Never expose “Add Google OAuth credentials in .env” to customers on production.
- Keep field labels visible or use persistent floating labels; placeholder-only forms are less scannable and less accessible.

Source: `resources/js/Pages/Auth/Login.jsx:310-470`, `resources/js/Pages/Auth/Register.jsx:54-220`.

### 16. Password recovery, reset, confirm, and email verification — P0

The live Forgot Password page is broken visually: a huge default Laravel logo dominates the screen and the form renders as raw browser controls. This must be fixed before general polish work.

Cause/risk:

- These pages use `GuestLayout` plus Tailwind utility class strings.
- The current `resources/css/app.css` explicitly has Tailwind directives removed, so those utility classes are not guaranteed to exist in a fresh build.
- Login and Register already use a separate MUI design, creating a completely different customer experience.

Update:

- Rebuild all four pages with one shared MUI `CustomerAuthShell` used by Login and Register.
- Use the configured logo, 420–460 px card width, 28–32 px padding, 48 px controls, clear title/body hierarchy, and a Back to sign in/shop link.
- Verify error, success, disabled, loading, and translated states.
- Confirm that user-side routes post to the intended user auth endpoints; these components currently build actions from `admin_app_url`, which deserves a separate functional check.

Source: `resources/js/Layouts/GuestLayout.jsx`, `resources/js/Pages/Auth/ForgotPassword.jsx`, `ResetPassword.jsx`, `ConfirmPassword.jsx`, and `VerifyEmail.jsx`.

### 17. Public invoice / voucher — Source-only

- The A5 print layout is compact and appropriate for printing.
- The screen view uses a fixed 148 mm width with no small-screen override, so it can overflow a phone viewport. Add a screen-only rule below roughly 650 px: `width: calc(100% - 16px)`, smaller outer margin, one-column customer/payment blocks, and horizontally scrollable or stacked item rows.
- Keep print sizes unchanged; separate print and screen tokens rather than enlarging everything globally.
- Use the configured brand font only for the screen preview if desired; retain a reliable system font for printing/PDF output.

Source: `resources/views/orders/voucher.blade.php`.

## Background, color, and surface consistency

Choose one shopper background system and use it on every user route. The current themed beige gradient is the stronger option for this brand; reserve plain white for content surfaces. Replace direct `bgcolor: 'background.default'` roots in Wishlist, Category detail, Orders, Blogs, Profile, and Chat with the shared storefront background or a dedicated neutral account/chat variant derived from the same palette.

Keep contrast and emphasis disciplined:

- Primary brand color: primary actions and active states only.
- Dark ink: headings and high-value prices.
- Warm neutral: backgrounds and subtle panels.
- Red: actual errors/discounts, not general decoration.
- Gold/brass: small accents, not body text on light backgrounds.

Relevant roots are listed by `rg 'background.default|storefrontBackgroundSx' resources/js/Pages/User resources/js/Pages/Profile`.

## Content and merchandising polish

These are not padding fixes, but they materially affect perceived quality:

- Make storefront copy configurable by store type. The live deployment’s general retail catalog conflicts with musical-only terminology throughout the header, hero, footer, category headings, cart copy, and support language.
- Establish image upload guidance: same crop ratio, minimum resolution, neutral/lifestyle art direction by category, no embedded promotional text, and consistent subject scale.
- Prevent zero-item categories and expired sale events from appearing as active customer choices.
- Review catalog naming/capitalization: “Mac Book,” “Iphone,” “Cosmetic,” and mixed singular/plural labels feel inconsistent.
- Ensure real prices and currency formatting are credible before launch; tiny demo values beside premium imagery reduce trust.

## Recommended implementation order

### Phase 1 — Foundation and broken paths

1. Rebuild Forgot/Reset/Confirm/Verify screens with the shared MUI auth shell.
2. Define storefront spacing, typography, control-height, radius, and shadow tokens.
3. Remove unsupported 850/900/950 weights or load the required weights intentionally.
4. Standardize page backgrounds and container gutters.
5. Increase bottom-nav labels and all mobile hit targets.

### Phase 2 — Conversion-critical shopping flow

1. Refine Navbar/search density.
2. Upgrade Product Card typography, padding, actions, and fallback media.
3. Simplify catalog filters and fix the default Filters badge.
4. Shorten the Product detail mobile gallery and add a sticky purchase action.
5. Upgrade populated Cart and Checkout with sticky summaries/actions.

### Phase 3 — Secondary journeys

1. Category index/detail.
2. Wishlist and empty states.
3. Orders list/detail.
4. Profile and Support Chat.
5. Blog index/detail and public invoice screen responsiveness.

### Phase 4 — Content QA and final refinement

1. Normalize catalog photography and copy.
2. Add trust/support links and service messaging.
3. Test English and Myanmar at 360, 390, 412, 768, 1024, and 1440 px.
4. Test empty, populated, loading, error, long-name, missing-image, flash-sale, and out-of-stock states.
5. Check keyboard focus, color contrast, 200% zoom, reduced motion, and safe-area behavior.

## Definition of “premium” for this storefront

The target should not be “more shadows” or “more decoration.” It should be clearer hierarchy, more breathing room, reliable imagery, fewer competing controls, consistent typography, and confident empty/error states. The existing color direction and hero imagery can stay; most of the perceived-quality gain will come from fixing the shared spacing/type system and then simplifying the commerce components built on top of it.

## Implementation update: compact spacing pass

The P0-P3 storefront work now includes a second layout pass after the compact typography update. The customer UI uses a denser commerce rhythm inspired by high-information shopping apps without reducing essential touch targets.

- Page gutters: 12 px mobile, 20 px tablet, 24 px large desktop.
- Page top spacing: 16 px mobile, 24 px desktop.
- Section separation: 24 px mobile, 32 px desktop; 48 px is retained only where a major product-detail region needs a clear break.
- Standard panels: 16 px mobile, 20 px tablet/desktop, with 24 px reserved for larger editorial surfaces.
- Product/category grids: 10-16 px responsive gaps.
- Product cards: 12-14 px content padding and compact title/price metadata.
- Forms and auth cards: 16 px field rhythm, 20-28 px card padding, and reduced outer vertical whitespace.
- Empty states: 24-28 px padding instead of the former 28-36 px range.
- Footer, blog content, order cards, checkout panels, dialogs, and account panels now follow the same spacing system.
- Buttons, icon buttons, list actions, and primary controls retain a minimum 44 px interaction target.
- Home hero remains two columns on large screens, with the dark content panel and lighter artwork panel aligned side by side.

Validated with a successful production build and local visual renders of Home, Catalog, and Login at desktop and compact viewport sizes.
