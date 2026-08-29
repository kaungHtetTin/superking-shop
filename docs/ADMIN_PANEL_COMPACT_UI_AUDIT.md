# Admin Panel Compact UI Audit

Audit date: 2026-08-05  
Live reference: `https://www.k2softwarestudio.com/onlineshop/public/admin/`  
Primary target: desktop admin use at 1280px and wider  
Design direction: keep the current web-app components, but tune typography, padding, spacing, and data density toward a compact native desktop console.

## Executive summary

The admin panel already has a good foundation: a persistent sidebar, a stable top bar, reusable panels, metric cards, filter toolbars, status badges, tables, dark mode support, and consistent primary actions. A redesign is not required.

The required change is a density pass. The current shell and content components still use comfortable web-dashboard dimensions. This creates unnecessary scrolling and makes operational pages feel softer and larger than a desktop console.

The recommended result is approximately 18–25% denser on desktop:

- Keep the existing navigation, cards, forms, badges, tables, icons, and brand color.
- Reduce shell chrome, page headings, panel padding, grid gaps, controls, and row heights.
- Replace some floating-card treatment with flatter bordered work surfaces.
- Make tables and filters the visual priority on operational screens.
- Retain the current comfortable sizing on touch/mobile breakpoints.
- Introduce shared density tokens instead of applying isolated page-level overrides.

## Live UI reviewed

The authenticated live review covered:

- Admin login
- Dashboard
- Orders
- Products
- Inventory / stock overview
- Finance
- Application settings

The review used a 1414 × 860 desktop viewport. Representative measured values are:

| Area | Current live value | Recommended compact value |
| --- | ---: | ---: |
| Sidebar width | 220px | 204px; optional 56px collapsed rail |
| Top bar height | 54px | 44px |
| Main content padding | up to 22px | 12–14px |
| Page title | up to 28px / 32px line | 22px / 26px line |
| Page-heading bottom space | 16px | 10px |
| Panel padding | 14px | 10px |
| Major grid gap | 12–16px | 8–10px |
| Primary button | 39px high | 32px high |
| Form field | 43px high | 34px high |
| Icon button | 34px | 28–30px |
| Standard table row | about 58px | 42–46px |
| Inventory table row | about 71px | 48–52px |
| Table cell padding | 10px 12px | 6px 9px |
| Status badge padding | 4px 10px | 3px 7px |
| Card radius | 8–10px | 4–6px |

The compact values are desktop targets, not universal minimums. Mobile and touch layouts should keep at least 40–44px interactive targets.

## Design principles

### 1. Dense, not cramped

Reduce unused padding before reducing readable content. The primary content font should remain 13px for operational data, with 12px reserved for metadata and labels. Avoid a global `transform: scale()` or browser-style zoom because it harms layout, text rendering, overlays, and accessibility.

### 2. Data before decoration

Operational pages should prioritize rows, filters, totals, states, and actions. Use borders and subtle surface differences for structure. Reduce large shadows, background glow, and excess empty card area.

### 3. One compact rhythm

Use a 2px-based desktop rhythm:

- 2px: micro separation
- 4px: icon-to-label or stacked metadata
- 6px: compact inline gap
- 8px: normal component gap
- 10px: panel padding or section gap
- 12px: page padding at smaller desktop sizes
- 14px: page padding at larger desktop sizes

Avoid mixing arbitrary 12px, 14px, 16px, and 22px gaps for elements at the same hierarchy.

### 4. Desktop-native behavior

The UI should feel efficient with a mouse and keyboard:

- Visible focus states on every action.
- `Enter` submits search/filter forms.
- `Escape` closes menus, dialogs, and drawers.
- Arrow-key support for menus and segmented controls.
- Sticky table headers on long lists.
- Tooltips for icon-only actions.
- No hidden destructive action behind an unlabeled icon without a tooltip and confirmation.

## Required changes

### P0 — Shared density system

Add semantic density tokens to `resources/js/styles/admin.css`. Component styles should consume these variables so density remains consistent across every admin page.

Recommended starting point:

```css
.app-root {
  --admin-sidebar-width: 204px;
  --admin-topbar-height: 44px;
  --admin-page-pad: 14px;
  --admin-panel-pad: 10px;
  --admin-section-gap: 10px;
  --admin-control-height: 34px;
  --admin-control-height-sm: 28px;
  --admin-table-cell-y: 6px;
  --admin-table-cell-x: 9px;
  --admin-font-body: 13px;
  --admin-font-meta: 11px;
  --admin-font-label: 10px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
}
```

Keep the present sizes below the tablet breakpoint or expose a deliberate `comfortable` density mode. Do not let each screen invent its own compact values.

### P0 — Compact application shell

Update the shell in `resources/js/Layouts/AdminLayout.jsx` and `resources/js/styles/admin.css`:

- Reduce the expanded sidebar from 220px to 204px.
- Add an optional 56px icon rail for users who want maximum content width.
- Reduce sidebar outer padding from `15px 11px` to `10px 8px`.
- Reduce navigation row padding from `9px 10px` to `6px 8px`.
- Use 12px navigation text with a 16px icon and a 30px target height.
- Reduce section-label top spacing and keep labels at 9–10px uppercase.
- Reduce the top bar from 54px to 44px.
- Reduce top-bar buttons from 34–36px to 30–32px.
- Keep profile identity in the top bar; remove the duplicated persistent identity block at the bottom of the sidebar, or show it only when the sidebar is expanded.
- Keep language, notification, and profile actions aligned to the same height.
- Persist sidebar collapsed state in local storage.

The current sidebar is understandable but long. Allow navigation groups to collapse so the visible menu behaves more like a native tool tree.

### P0 — Typography hierarchy

Use Inter as the admin UI font and continue using Noto Sans Myanmar as the fallback. Keep the hierarchy compact and predictable:

| Role | Target size / line height | Weight |
| --- | --- | ---: |
| Page title | 22px / 26px | 750–800 |
| Panel title | 15px / 19px | 700–750 |
| Metric value | 18px / 21px | 750–800 |
| Body / table primary | 13px / 18px | 400–650 |
| Navigation | 12px / 16px | 550–650 |
| Metadata | 11px / 15px | 400–600 |
| Field label | 11px / 14px | 650–700 |
| Eyebrow / table heading | 9–10px / 12px | 700–750 |

The current 28px page title consumes too much vertical space for frequently used console pages. Do not reduce table primary content below 12px.

### P0 — Panels, grids, and surfaces

- Reduce `.panel` padding from 14px to 10px.
- Reduce panel-heading bottom margin from 12px to 8px.
- Reduce page-heading bottom margin from 16px to 10px.
- Reduce main grid gaps from 12–16px to 8–10px.
- Prefer a 1px neutral border and very light shadow.
- Remove glass blur from ordinary content panels. Reserve blur for the shell or transient overlays.
- Reduce radius from 8–10px to 4–6px on work surfaces.
- Keep a slightly larger 8px radius for dialogs and major composed cards.
- Avoid nested cards where a section divider or subheader is enough.

This preserves the current component model while making the content look like a continuous workbench instead of a collection of promotional cards.

### P0 — Forms and filter toolbars

- Reduce normal controls from 43px to 34px.
- Reduce filter controls from 36–43px to 32–34px.
- Use 11px field labels and 12–13px input values.
- Reduce horizontal control padding from 12px to 9–10px.
- Keep textarea heights content-appropriate; do not force them to 34px.
- Align labels, inputs, selects, and buttons to a common baseline.
- Put the primary search action at the end of the filter row without giving it excessive width.
- Collapse secondary filters behind a “More filters” button when a toolbar needs more than one row.
- Add a compact active-filter summary and a single clear-all action.
- Preserve visible labels for dates and ambiguous selects.

On Finance, the current filter block is visually taller than necessary. At 1280px and wider it should fit into one compact toolbar plus an optional expanded row.

### P0 — Data tables

Tables are the highest-value place to increase density.

- Reduce header padding from `10px 12px` to `6px 9px`.
- Reduce cell padding from `10px 12px` to `6px 9px`.
- Target 42–46px standard rows and 48–52px rows with thumbnails.
- Use 13px primary text and 11px secondary metadata.
- Use tabular numerals and right-align currency and quantities.
- Keep status badges to approximately 20px high.
- Use sticky headers within long scroll regions.
- Keep the action column narrow and sticky on wide tables.
- Show row actions on hover/focus while keeping the main action discoverable.
- Use tooltips and accessible labels for edit, history, open, and delete icons.
- Add column visibility controls for wide operational tables.
- Avoid ISO timestamps in the visible UI; show `Aug 4, 2026 21:49` or the localized equivalent and expose the exact timestamp in a tooltip.
- Preserve horizontal scrolling rather than wrapping every value into tall rows.

The Products and Orders rows are currently about 58px high. Inventory rows are about 71px because of thumbnails and two-line metadata. Both can be substantially denser without losing clarity.

### P0 — Buttons, icon actions, and badges

- Normal button: 32px high, 10–12px horizontal padding, 12px label.
- Small button: 28px high, 8px horizontal padding, 11px label.
- Icon button: 28–30px square.
- Primary page action may remain 34px high for emphasis.
- Replace pill-shaped filter tabs with a compact segmented control using 28px height and 4px radius.
- Reserve fully rounded pills for status values and counts.
- Use icon + label for important actions; icon-only controls are appropriate only for repeated row actions.
- Maintain a strong focus ring even after reducing dimensions.

### P1 — Dashboard changes

The Dashboard is useful, but it is the most vertically expansive screen.

- Reduce metric-card padding from 13px to 9–10px.
- Reduce metric icon wells from 30px to 24px.
- Keep six metrics in one row only when each remains readable; otherwise use a four-plus-two responsive layout.
- Reduce the metric row and page-heading combined height by about 35–45px.
- Convert Quick actions into a compact two-column command list with 34–38px rows.
- Reduce the height of the Monthly sales chart at common laptop resolutions.
- Put Needs attention above Quick actions when alerts exist.
- Allow Recent orders to occupy more width than low-value summary panels.
- Remove redundant subtitles when the label and value already explain the metric.

Target outcome: Recent orders and the start of the fulfillment section should be visible in the first 860px viewport without making the chart unreadable.

### P1 — Orders changes

- Combine the six summary cards into a compact KPI strip, approximately 58–64px high.
- Replace the four rounded filter pills with a segmented status control.
- Keep search, fulfillment status, payment status, and action in one 34px toolbar row at desktop width.
- Format timestamps for humans instead of showing raw ISO strings.
- Right-align item count and order total.
- Make the whole row open the order; keep the external/open icon as a secondary affordance.
- Add a compact bulk-selection mode for fulfillment updates if bulk workflows are supported.

### P1 — Products changes

- Keep the current table layout; it already fits nine products in the viewport.
- Reduce rows to 48–52px while preserving 32–36px thumbnails.
- Combine category and variant count where useful to reduce columns at medium widths.
- Right-align price and stock.
- Keep Add product as the only filled page action; Print barcodes remains secondary.
- Reveal edit/delete labels in a row action menu if more actions are added later.

### P1 — Inventory changes

- Reduce thumbnail rows from about 71px to 48–52px.
- Use 36px thumbnails and keep SKU as 11px metadata below the product name.
- Combine `On hand`, `Reserved`, and `Available` into a compact numeric group at narrower desktop widths, but retain separate sortable columns on wide screens.
- Keep warehouse and category filters in one row with search.
- Move export to a labeled toolbar menu or give the download icon a tooltip.
- Make realtime state a small status indicator beside the section title instead of a separate line consuming vertical space.
- Freeze Product/SKU and the action column for horizontal scrolling.

### P1 — Finance changes

- Use a compact KPI strip rather than six full metric cards.
- Fit the common filters in one row and move less-used category/status filters into an expandable row.
- Reduce the finance chart height by about 20% at laptop resolutions.
- Right-align every currency column and use tabular numerals.
- Keep negative values red, but avoid using strong red for large areas.
- Make ledger rows 42–46px; show reference/category as metadata rather than increasing row height.

### P1 — Settings changes

- Use a 200–220px left section index for Brand, Contacts, Storefront, Security, and other settings as the page grows.
- Keep the form content in a single work surface with section dividers rather than several floating cards.
- Reduce input heights to 34px and card padding to 10px.
- Keep the brand preview compact and sticky on wide screens.
- Put the Save settings action in a sticky bottom action bar so it is always reachable.
- Use a two-column form only when fields are logically paired; keep long URLs and file controls full width.

### P1 — Login changes

The admin login can remain more expressive than the console. Only a light density pass is needed:

- Reduce the form card maximum width slightly and reduce internal padding by about 15%.
- Use 40px fields rather than the console’s 34px fields because login is a low-frequency, isolated task.
- Keep the musical background and introductory content; they provide product identity.
- Ensure the form is fully visible without vertical scrolling at 768px height.

### P2 — User-controlled density

After the compact default is stable, add a display preference:

- Compact: recommended desktop default.
- Comfortable: current-like spacing for touch use or user preference.

Store the preference alongside the existing admin theme setting. Implement it with `data-density="compact|comfortable"` on `.app-root`, using token overrides rather than duplicate component styles.

## Visual treatment to preserve

Keep these parts of the current design:

- Warm brand color and semantic status colors.
- Inter + Noto Sans Myanmar admin typography.
- Persistent, permission-aware navigation.
- Clear eyebrow → title → content hierarchy.
- Reusable metric cards, panels, filter bars, tables, and status components.
- Light/dark theme architecture.
- Strong distinction between primary and secondary actions.
- Product and inventory thumbnails where they support scanning.

Reduce, but do not eliminate:

- Background gradients.
- Glass effects.
- Rounded corners.
- Shadows.
- Large empty card padding.

## Accessibility and responsive constraints

- Maintain WCAG AA text contrast in both themes.
- Do not communicate state by color alone; preserve status text and dots/icons.
- Keep keyboard focus at least 2px and clearly visible.
- Icon-only actions require accessible names and visible tooltips.
- Desktop compact targets may be 28–34px, but mobile/touch targets should remain at least 40–44px.
- Keep Myanmar text line height slightly more generous where necessary; test both English and Myanmar after changing typography tokens.
- At less than 1024px, prioritize responsive reflow over maintaining desktop density.
- At less than 768px, use the existing drawer/mobile patterns and comfortable control sizing.

## Implementation map

| Concern | Primary files |
| --- | --- |
| Density tokens, shell, controls, panels, tables | `resources/js/styles/admin.css` |
| Sidebar collapse, nav groups, density preference | `resources/js/Layouts/AdminLayout.jsx` |
| Shared panel, metric, status, toolbar conventions | `resources/js/Components/Admin/shared.jsx` |
| Dashboard layout | `resources/js/Pages/Admin/Dashboard.jsx` |
| Orders table and filters | `resources/js/Pages/Admin/Orders/Index.jsx` |
| Product table | `resources/js/Pages/Admin/Products/Index.jsx` |
| Inventory table and toolbar | `resources/js/Pages/Admin/Inventory/Index.jsx` |
| Finance metrics, filters, chart, ledger | `resources/js/Pages/Admin/Finance/Index.jsx` |
| Settings form | `resources/js/Pages/Admin/Settings/Edit.jsx` |
| Login density | `resources/js/Pages/Auth/Login.jsx` |
| Existing visual reference page | `resources/js/Pages/Admin/UiShowcase.jsx` |

Update the UI Showcase first so compact tokens and component states can be reviewed in one place before converting individual pages.

## Recommended implementation order

1. Add density variables and compact/comfortable token sets.
2. Convert the shell, page heading, panels, buttons, fields, badges, and tables to tokens.
3. Update UI Showcase with both density modes and all interactive states.
4. Convert Products and Orders as the first real table screens.
5. Convert Inventory and Finance, including sticky headers and numeric alignment.
6. Convert Dashboard and Settings.
7. Apply the lighter login adjustment.
8. Verify English, Myanmar, light, dark, 1280×720, 1440×900, 1920×1080, tablet, and mobile.

## Acceptance criteria

The compact UI pass is complete when:

- Shell dimensions and component density come from shared tokens.
- At 1440×900, the sidebar shows materially more navigation without harming readability.
- Product and order tables show at least 10 standard rows where data is available.
- Inventory shows at least 9 thumbnail rows at 1440×900.
- Common filter toolbars fit on one row at 1280px or use one deliberate expandable row.
- Page title plus action area uses no more than about 42px of content height, excluding the top bar.
- No desktop control is taller than 34px unless it has a documented reason.
- Mobile/touch targets remain at least 40–44px.
- All icon actions have labels or tooltips and accessible names.
- Both themes and both supported languages pass visual review.
- No screen uses CSS scaling or page-specific font-size hacks to achieve density.

## Final recommendation

Proceed with a token-driven compact density pass, not a component redesign. The current admin UI already has the right web-app building blocks. Making the shell 10px shorter, content 8px tighter, controls 7–9px shorter, and operational rows 12–20px shorter will create the native desktop-console feel while keeping the brand, usability, and maintainability intact.
