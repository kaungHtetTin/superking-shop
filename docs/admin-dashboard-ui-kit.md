# LaLaPick Admin Dashboard UI/UX Toolkit

Portable design-system and implementation guide for recreating this project's current admin experience in another application.

> Current style: a compact operations console with a collapsible sidebar, sticky command bar, solid bordered work surfaces, dense filters and tables, runtime brand color, light/dark themes, and compact/comfortable density modes.

## Contents

1. Source of truth
2. Design principles
3. Foundation tokens
4. Typography, spacing, and surfaces
5. Application shell
6. Component toolkit
7. Page recipes
8. Interaction and content rules
9. Responsive, localization, and accessibility rules
10. Porting workflow
11. Acceptance checklist
12. Reusable Codex skill

## 1. Source of truth

This document describes the UI implemented in the repository now. It replaces the older glass-heavy FlowDrop description that previously occupied this file.

| Source | What to learn from it |
| --- | --- |
| `resources/js/styles/admin.css` | Tokens, shell, density, component styles, responsive behavior |
| `resources/js/Layouts/AdminLayout.jsx` | Root theme/density wiring, permission-aware navigation, topbar, mobile drawer |
| `resources/js/Components/Admin/shared.jsx` | Status mapping, panel heading, theme/density control, column visibility, logo |
| `resources/js/Components/Admin/icons.jsx` | Inline SVG icon vocabulary |
| `resources/js/Pages/Admin/UiShowcase.jsx` | Small visual catalog of metrics, controls, forms, statuses, alerts, and tables |
| `resources/js/Pages/Admin/Dashboard.jsx` | KPI strip and asymmetric dashboard layout |
| `resources/js/Pages/Admin/Orders/Index.jsx` | Operational table, tabs, filters, payment/fulfillment states |
| `resources/js/Pages/Admin/Products/Index.jsx` | Thumbnail table and row actions |
| `resources/js/Pages/Admin/Inventory/Index.jsx` | Sticky identity/action columns and numeric stock data |
| `resources/js/Pages/Admin/Finance/Index.jsx` | KPI, filter, chart, and ledger composition |
| `resources/js/Pages/Admin/Settings/Edit.jsx` | Long-form settings workspace |

The admin UI is mostly custom React + CSS. MUI is used for the specialized POS screen, but it is not the foundation of the main admin design system.

## 2. Design principles

### Operational density

Optimize for frequent desktop work. Show more useful rows, filters, totals, and actions before adding decoration. Compact does not mean unreadable: primary operational text remains 12–13 px and controls remain reachable by keyboard.

### Data before decoration

Use borders, subtle surface differences, and small shadows to establish hierarchy. Ordinary content panels are solid work surfaces. Blur belongs mainly to the sidebar, topbar, popovers, drawers, and dialogs.

### One visual rhythm

Drive layout from shared density variables. Do not shrink individual pages with one-off font sizes, CSS transforms, or browser zoom.

### One dominant action

Use one filled primary action in a page heading or panel region. Keep alternative actions secondary, textual, or inside row menus.

### Semantic state

Brand color communicates selection and emphasis. Fixed semantic colors communicate success, warning, danger, information, and neutral state. Every state also includes text and/or a dot or icon.

### Desktop compact, mobile touchable

Desktop controls may be 28–34 px. At 760 px and below, restore at least 40 px interactive targets and reflow the layout.

## 3. Foundation tokens

### 3.1 Copy-ready root tokens

Rename `.app-root` if needed, but keep the semantic variables.

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Myanmar:wght@400;500;600;700&display=swap');

.app-root {
  --admin-sidebar-width: 204px;
  --admin-sidebar-rail-width: 56px;
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

  --color-primary: #087f74;
  --color-primary-dark: color-mix(in srgb, var(--color-primary) 82%, #000);
  --color-primary-soft: color-mix(in srgb, var(--color-primary) 11%, transparent);
  --color-bg: #eef4f4;
  --color-surface: #ffffff;
  --color-glass: rgb(255 255 255 / 78%);
  --color-border: rgb(15 23 42 / 10%);
  --color-text: #172033;
  --color-muted: #69768a;
  --color-soft: #f2f6f6;
  --color-danger: #ce4444;
  --shadow: 0 4px 14px rgb(15 23 42 / 5%), 0 1px 3px rgb(15 23 42 / 4%);
  --shadow-lg: 0 14px 38px rgb(15 23 42 / 11%), 0 3px 10px rgb(15 23 42 / 6%);
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  min-height: 100vh;
  overflow-x: hidden;
  color: var(--color-text);
  background:
    linear-gradient(135deg, rgb(226 236 236 / 65%), transparent 34rem),
    radial-gradient(circle at 92% 95%, rgb(86 156 191 / 8%), transparent 27rem),
    var(--color-bg);
  font-family: Inter, 'Noto Sans Myanmar', system-ui, sans-serif;
  font-size: var(--admin-font-body);
  line-height: 1.38;
}
```

### 3.2 Comfortable density

```css
.app-root[data-density='comfortable'] {
  --admin-sidebar-width: 220px;
  --admin-topbar-height: 54px;
  --admin-page-pad: 22px;
  --admin-panel-pad: 14px;
  --admin-section-gap: 14px;
  --admin-control-height: 43px;
  --admin-control-height-sm: 34px;
  --admin-table-cell-y: 10px;
  --admin-table-cell-x: 12px;
  --admin-font-body: 14px;
  --admin-font-meta: 11px;
  --admin-font-label: 11px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
}
```

### 3.3 Dark theme

```css
.app-root[data-theme='dark'] {
  --color-bg: #0f1419;
  --color-surface: #1a222d;
  --color-glass: rgb(26 34 45 / 82%);
  --color-border: rgb(255 255 255 / 10%);
  --color-text: #e8edf3;
  --color-muted: #8b97a8;
  --color-soft: #232d3a;
  --shadow: 0 12px 36px rgb(0 0 0 / 28%), 0 2px 8px rgb(0 0 0 / 18%);
}
```

### 3.4 Semantic colors

| Family | Foreground | Soft background | Examples |
| --- | --- | --- | --- |
| Success | `#168255` | green at 10% | paid, delivered, available, healthy |
| Warning | `#b77700` | amber at 12% | pending, unpaid, needs review |
| Danger | `#ce4444` | red at 10% | rejected, cancelled, failed, low stock |
| Info | `#2874bc` | blue at 11% | processing, shipped, assigned |
| Neutral | `#7b8795` | gray at 12% | offline, inactive, default |

Do not derive these colors from `--color-primary`; they must keep their meaning when the brand changes.

## 4. Typography, spacing, and surfaces

### 4.1 Type roles

| Role | Compact target | Weight |
| --- | --- | ---: |
| Page title | 22 px / 26 px | 750–800 |
| Panel title | 15 px / 19 px | 700–750 |
| Metric value | 18 px / 21 px | 750–800 |
| Body / primary table line | 12–13 px / 16–18 px | 400–700 |
| Navigation | 12 px / 16 px | 600 |
| Metadata | 10–11 px / 14–15 px | 400–600 |
| Field label | 11 px / 14 px | 700 |
| Eyebrow / table header | 9–10 px / 12 px | 700–800 |

Use uppercase and letter spacing only for eyebrows, navigation section labels, and table headers. Use tabular numerals for quantities, currency, counts, and chart labels.

### 4.2 Spacing rhythm

Use a compact 2 px rhythm: 2 micro, 4 stacked label gap, 6 compact inline, 8 component, 10 section/panel, 12 small-page, 14 desktop-page. Do not mix unrelated 12, 16, and 22 px gaps at the same hierarchy.

### 4.3 Surface hierarchy

| Surface | Treatment |
| --- | --- |
| Page background | Neutral background plus two quiet gradients |
| Sidebar/topbar | Translucent glass, 1 px border, light shadow, optional blur |
| Ordinary panel/metric | Solid `--color-surface`, 1 px border, `--shadow`, no blur |
| Input/table body | Solid surface |
| Subtle control/row group | `--color-soft` |
| Popover/drawer/dialog | Glass or high-opacity surface, border, `--shadow-lg` |

The `.glass` class remains in some panel markup for compatibility, but later CSS intentionally flattens `.panel.glass` and `.metric-card.glass` to solid surfaces.

## 5. Application shell

```text
app-root [theme + density + primary color]
└── admin-app [204px | minmax(0, 1fr)]
    ├── fixed admin-sidebar
    │   ├── logo
    │   └── scrollable grouped navigation
    └── admin-main
        ├── sticky admin-topbar
        └── centered admin-content [max 1560px]
            ├── page heading [eyebrow + title + one action]
            └── page-specific composition
```

### 5.1 Desktop dimensions

| Element | Compact | Comfortable |
| --- | ---: | ---: |
| Sidebar | 204 px | 220 px |
| Collapsed rail | 56 px | 56 px |
| Topbar | 44 px | 54 px |
| Page padding | 14 px | 22 px |
| Panel padding | 10 px | 14 px |
| Major gap | 10 px | 14 px |

The sidebar is permission-aware, divided into collapsible labeled groups, and stores collapsed state. Active and hover items use primary text with `--color-primary-soft`. Badges remain semantic danger counts.

The topbar keeps navigation controls on the left and appearance, language, notifications, and profile on the right. Global search may be added when it has a real cross-module search behavior; hide it on mobile.

### 5.2 Root wiring in React

```jsx
const [theme, setTheme] = useStoredState('admin.theme', 'light');
const [density, setDensity] = useStoredState('admin.density', 'compact');
const [sidebarCollapsed, setSidebarCollapsed] = useStoredState('admin.sidebar.collapsed', false);

return (
  <div
    className={`app-root ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
    data-theme={theme}
    data-density={density}
    style={{ '--color-primary': brandColor || '#087f74' }}
  >
    {/* fixed sidebar + main + sticky topbar + content */}
  </div>
);
```

Equivalent state and attributes may be used in Vue, Svelte, Angular, Blade, or plain JavaScript.

## 6. Component toolkit

### 6.1 Panel heading

```jsx
function PanelHeading({ eyebrow, title, action }) {
  return (
    <div className="panel-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}
```

Use a text action for “View all” and a secondary/primary labeled button for an operation. Avoid multiple filled buttons.

### 6.2 Buttons and icon actions

| Variant | Purpose |
| --- | --- |
| `.btn.primary` | Page or panel's dominant action |
| `.btn.secondary` | Cancel, back, export, alternative action |
| `.btn.success` | Explicit positive operational transition |
| `.btn.danger` | Destructive confirmation |
| `.text-btn` | “View all” or low-emphasis heading action |
| `.icon-btn` | Repeated or chrome action; always label accessibly |

Compact desktop button height is 32 px; icon buttons are 30 px; small row icons are 28 px. Mobile targets become 40 px. Important actions use icon + label. Icon-only actions require `aria-label` and a visible tooltip/title.

### 6.3 Metric card / KPI strip

```html
<article class="metric-card glass">
  <span class="icon-well"><!-- 24px icon well --></span>
  <small>Revenue (confirmed)</small>
  <strong>12,480</strong>
  <p>Paid orders total</p>
</article>
```

Compact card: 60–64 px minimum height, 9–10 px padding, 18 px tabular value, optional 10 px hint. Use four or six columns only when values stay readable.

### 6.4 Status badge

```html
<span class="status status-warning">
  <span class="status-dot"></span>
  Pending review
</span>
```

Normalize backend states through one mapping helper. Unknown states fall back to neutral. The compact badge is about 20 px high with a 5 px dot and 10 px label.

### 6.5 Fields, search, and filters

```html
<label class="form-field">
  <span>Warehouse</span>
  <select><!-- options --></select>
</label>

<div class="search-box">
  <!-- search icon -->
  <input type="search" placeholder="Search products…">
</div>
```

Desktop controls are 34 px high with 9 px horizontal padding and 4 px radius. Focus uses a primary border plus soft ring. Keep labels visible for ambiguous fields, dates, and destructive settings.

Filter order: search → primary status/category/date controls → secondary filters → action. If the row does not fit, use one deliberate “More filters” row rather than an accidental multi-line toolbar.

### 6.6 Tables

```html
<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th class="numeric-cell">Available</th>
        <th class="table-actions-column"><span class="sr-only">Actions</span></th>
      </tr>
    </thead>
    <tbody>
      <tr class="clickable" tabindex="0">
        <td><strong>Acoustic Guitar</strong><small>SKU AG-101</small></td>
        <td class="numeric-cell">24</td>
        <td class="table-actions-column"><!-- actions --></td>
      </tr>
    </tbody>
  </table>
</div>
```

Rules:

- Sticky soft-background header inside a bordered scroll region.
- Standard rows around 42 px; thumbnail rows around 48 px with 36 px images.
- Primary line above muted metadata.
- Currency and quantities right-aligned with tabular numerals.
- Narrow sticky action column; optionally freeze the left identity column.
- Whole-row navigation only when the row clearly represents one destination; retain keyboard activation.
- Use deliberate horizontal scrolling on small screens with a meaningful minimum width.
- Add column visibility for wide operational tables.

### 6.7 Segmented tabs and pagination

Tabs are a compact segmented control: 2 px container padding, 28 px buttons, 4 px radius, soft container, solid active button. Fully rounded pills are reserved for statuses and counts.

Pagination is lightweight text navigation. Use brand color and underline for active/hover state instead of filled square buttons.

### 6.8 Feedback states

Every data surface needs intentional loading, empty, error, disabled, hover, focus, selected, success, warning, and destructive states. Empty copy should explain what the area contains and, when useful, provide one action. Field errors appear next to the field without clearing entered values.

### 6.9 Drawer and modal

| Pattern | Use | Width |
| --- | --- | ---: |
| Right drawer | Contextual detail while retaining list context | 360 px, max 94vw |
| Standard dialog | Create/edit form | max 760 px |
| Compact dialog | Short form | max 590 px |
| Assignment dialog | Focused selection | max 530 px |

Use an 8 px dialog radius, dim backdrop `rgb(10 19 24 / 35%)`, scrollable body, and sticky action footer. Escape closes transient UI. Destructive transitions still require explicit confirmation.

### 6.10 Icon system

Use one inline SVG component with `currentColor`, outline strokes, and a consistent stroke width. Extend the existing vocabulary rather than mixing unrelated icon packs. Common names include `grid`, `box`, `shop`, `receipt`, `card`, `wallet`, `chart`, `search`, `bell`, `plus`, `edit`, `close`, `check`, `users`, `settings`, `palette`, `sun`, `moon`, `menu`, `truck`, `tag`, and `lock`.

## 7. Page recipes

### Dashboard

1. Page heading.
2. Four- or six-item compact KPI strip.
3. Asymmetric `1.65fr 1fr` content grid.
4. Wide side: sales/operations visualization and recent table.
5. Narrow side: needs-attention queue, quick actions, fulfillment summary, top products, low-stock watch.

Collapse to one content column at 1100 px. Put attention above optional quick actions when alerts exist.

### List / CRUD

1. Page heading with one create action.
2. Solid panel with panel heading.
3. Search/filter toolbar.
4. Scrollable table.
5. Pagination and result count.

This is the default for orders, products, customers, staff, categories, coupons, and inventory records.

### Detail

Use a large main column for facts, lines, and history and a narrow side stack for status, totals, and actions. Use a drawer when retaining the list behind the detail is more valuable than a dedicated route.

### Form / wizard

Use one main work surface with grouped fields and a footer action bar. Use two columns only for logically paired fields; span long values across both. Add a sticky side summary when users must compare totals or completion state. Use a stepper only when steps are genuinely sequential.

### Reports / finance

KPI strip → compact filters → chart/insights → ledger or ranked table. Keep chart decoration quiet; keep values, comparison periods, and numeric alignment prominent.

### Settings

Use a section index plus one continuous work surface with dividers. Keep the save action reachable with a sticky action bar on long forms.

### Specialized workspaces

Chat, POS, storefront editing, barcode printing, and inventory documents may use split panes or custom workspaces. They still consume the same color, density, type, focus, button, field, and feedback tokens.

## 8. Interaction and content rules

- Persist theme, density, sidebar rail, and collapsed navigation groups locally.
- Escape closes popovers, menus, drawers, and dialogs.
- Enter submits search/filter forms when expected.
- Close menus on outside click and return focus to the trigger.
- Do not hide the only important action in hover-only UI.
- Confirm destructive changes with the affected record named in the copy.
- Format dates for people; expose exact timestamps in a tooltip or detail view if needed.
- Use short labels and sentence-case action copy: “Add product”, “Save changes”, “Open fulfillment list”.
- Pair primary text with muted context rather than adding extra columns for every metadata item.
- Keep role and permission behavior in the target application's authorization layer; the UI only reflects it.

## 9. Responsive, localization, and accessibility rules

### Breakpoints

| Breakpoint | Behavior |
| --- | --- |
| `≤1100px` | Metrics become three columns; major two-column grids become one; filters normally become two columns |
| `≤760px` | Sidebar becomes off-canvas drawer; metrics become two columns; forms/filters become one; heading/panel actions can become full width; targets become at least 40 px |
| Very narrow | Keep two KPI columns only if values remain readable; otherwise use one column |

Mobile tables retain horizontal scrolling and a deliberate minimum width. Do not wrap every cell into tall, hard-to-scan rows.

### Accessibility

- Use a 2 px visible `:focus-visible` outline with 2 px offset.
- Preserve labels, table header associations, dialog names, menu state, and button types.
- Add `aria-label` and tooltip/title to every icon-only action.
- Never communicate state with color alone.
- Honor `prefers-reduced-motion` by removing nonessential transitions.
- Honor `prefers-reduced-transparency` by replacing glass with solid surface.
- Keep mobile touch targets at least 40 px; use 44 px where space permits.

### Localization

Inter is the Latin UI font; Noto Sans Myanmar is the Myanmar fallback. Test both supported languages after density changes. Allow more line height for Myanmar where necessary. Do not truncate critical status, amount, or action text.

## 10. Porting workflow

### Phase A — Inventory the target

Identify the framework, router, theme mechanism, CSS architecture, existing component library, authorization model, localization, and main dashboard page types. Keep what already works.

### Phase B — Add foundations

Add tokens, root theme/density attributes, typography, focus rules, and semantic states. Build the shell before individual screens.

### Phase C — Build primitives

Implement panel headings, buttons, icon buttons, fields, search, statuses, tabs, metrics, tables, pagination, flash messages, drawers, and dialogs. Create a local showcase route or Storybook page with all modes and states.

### Phase D — Convert representative pages

Convert one table screen, one form, and the dashboard first. Resolve reusable issues there before applying the system across the rest of the application.

### Phase E — Verify

Test light/dark, compact/comfortable, desktop/tablet/mobile, keyboard, longest locale, reduced motion/transparency, loading/empty/error states, wide tables, and destructive flows.

### Keep vs adapt

Keep the proportions, density, semantic hierarchy, surface treatment, interaction rules, and responsive behavior. Adapt product name, navigation, domain statuses, routes, permissions, data shapes, framework primitives, and copy.

## 11. Acceptance checklist

- [ ] Shared tokens drive shell, panels, controls, forms, badges, and tables.
- [ ] Light and dark themes work without page-specific color overrides.
- [ ] Compact and comfortable density work from root variables.
- [ ] Sidebar supports expanded, collapsed rail, and mobile drawer states.
- [ ] One filled primary action dominates each page or panel region.
- [ ] Ordinary panels are solid; blur is reserved for shell/transient surfaces.
- [ ] Desktop controls are normally 28–34 px; mobile targets are at least 40 px.
- [ ] Standard table rows are about 42 px and thumbnail rows about 48 px.
- [ ] Numeric data is tabular and right-aligned.
- [ ] Sticky table headers and intentional horizontal overflow work.
- [ ] Every icon-only action has an accessible name and tooltip/title.
- [ ] Empty, loading, error, disabled, selected, and destructive states are implemented.
- [ ] Focus is visible and keyboard close/submit behavior works.
- [ ] Reduced motion and reduced transparency are respected.
- [ ] English and the longest supported locale have been checked; Myanmar is checked when supported.
- [ ] Verified at 1440×900, 1280×720, 1024 px, and 390 px.

## 12. Reusable Codex skill

An auto-discovered skill is installed at:

```text
C:\Users\Hp\.codex\skills\build-lalapick-admin-ui
```

Invoke it in another project with:

```text
Use $build-lalapick-admin-ui to build this application's admin dashboard.
```

Or for an existing dashboard:

```text
Use $build-lalapick-admin-ui to restyle this admin area while preserving its routes, permissions, and business behavior.
```

The skill tells Codex to inspect the target stack first, apply this system through shared tokens and primitives, preserve product-specific behavior, and verify desktop/mobile plus theme/density modes.
