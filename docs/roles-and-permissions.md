# Roles and permissions

The Roles & Permissions editor displays current feature descriptions from
`config/admin_permissions.php`. The database permission keys remain the source
of truth for role assignments. This update does not change existing assignments.

## Current access boundaries

| Feature | Required permission |
| --- | --- |
| Custom role management | `roles.manage`; system roles remain read-only |
| General, branding, contacts and receipt settings (thermal, A4, A5) | `settings.manage` |
| Integrated Settings → Prices, rules, preview and bulk repricing | `pricing.manage` OR `settings.manage` |
| Own POS shifts, sales, units, FOC and receipts | `pos.access` |
| POS sale discounts | `pos.discount` in addition to POS access |
| Hold/resume and remove own held carts | `pos.hold` in addition to POS access |
| Remove another cashier's held cart | `pos.void` in addition to `pos.hold` |
| Invoice details and PDF downloads | `orders.view` |
| Order returns | `orders.returns` |
| Purchase receipts and eligible reversals | `inventory.receive` |
| Counted-stock adjustments | `inventory.adjust.create` |
| Transfers and eligible reversals | `inventory.transfer.create` |

Pricing-only users see only the Prices tab, and cannot submit changes to other
application settings. Existing holders of `pricing.manage` now have access to
these pricing operations. Personal profile/password controls remain available
through `/admin/profile` without granting application-settings access.

Location access, ownership, stock availability, below-cost protection, and
other service-level validation still apply. A permission is not a bypass of
those checks. `locations.manage` includes visibility of all active locations.

## Legacy keys

`pos.refund` and `inventory.adjust.approve` do not enable an action in the current
workflow. The editor labels them as legacy/inactive and does not include them in
group selection. Existing assignments are preserved; custom roles can remove
them. Use `orders.returns` for returns and `inventory.adjust.create` for the
current immediate-post adjustment workflow.

Do not rerun role-reset seeders to deploy this change. No data migration is
required. Use the role editor to deliberately change custom-role assignments.
Clear/rebuild Laravel's configuration and route caches during deployment so
the updated catalog and route checks take effect.
