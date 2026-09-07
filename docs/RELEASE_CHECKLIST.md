# Release checklist

## Local verification (2026-09-07)

- Laravel upgraded from 9 to 12; Sanctum 4 and PHPUnit 11.
- Composer resolution pinned to PHP 8.2.12, stable dependencies only.
- Vite 7, compatible React/Laravel plugins and Axios 1; lock files updated.
- Full PHP regression suite and four JavaScript pricing tests pass (see release verification output for counts).
- Production build passes. One 573 kB main JavaScript chunk remains a performance warning, not a build failure.
- Composer and npm audits report no known vulnerabilities at verification time.
- Password update uses a GET redirect after mutation; checkout requests over 12 MiB receive a clear 413 (10 MiB proof limit plus form overhead).
- PDF generation regression passes with installed Dompdf.

This is a staging candidate, not production sign-off. Browser verification was unavailable. Local development settings are intentionally unchanged.

## Build and staging

1. Take and test a database/upload backup. Keep the previous application release and its lock files.
2. Use a patched PHP 8.2+ with BCMath, PDO MySQL and Composer-required extensions. Match CLI and web PHP. Build with Node 22.12+ (tested 22.18).
3. In a clean build checkout run `composer install --no-dev --prefer-dist --optimize-autoloader`, `composer check-platform-reqs --no-dev`, `npm ci`, and `npm run build`. Never use `composer update` on production or ignore platform requirements.
4. Include `public/build`; exclude `.env`, `public/hot`, node_modules, test artifacts, local caches and logs from the release. Preserve server-owned storage/uploads. Do not copy local credentials.
5. Point the web document root at `public`, not the repository root. Configure HTTPS and trusted reverse proxies correctly. Block PHP execution in upload directories and verify private payment proofs cannot be fetched publicly.
6. Set `APP_ENV=production`, `APP_DEBUG=false`, the real HTTPS `APP_URL`, `SESSION_SECURE_COOKIE=true`, unique storefront/admin cookie names and production database/mail/broadcast credentials. Keep the existing APP_KEY on upgrades; generate one only for a new installation. Use a least-privilege database user, never root.
7. Set PHP `upload_max_filesize` to at least 10M, `post_max_size` and web-server body limit to at least 12M. Retain the application file validation limit.
8. On staging, run `php artisan migrate --force` against a backed-up copy first. Never run `migrate:fresh` or demo seeders on an existing installation.
9. Run `php artisan storage:link`, `php artisan config:cache`, `php artisan route:cache`, and `php artisan view:cache`. Grant write access only to necessary storage/cache paths.
10. Run `php artisan release:check`. It is read-only and exits nonzero for failed local configuration/artifact/database checks. A pass is necessary but does not replace the checks below.

## Required staging acceptance

### Invoice voucher PDF runtime

Order voucher PDFs use Node/Puppeteer (separate from Dompdf credit statements). On the application host, retain Node, the Puppeteer runtime dependencies and `scripts/generate-voucher-pdf.cjs`. Run `npm run pdf:install` after dependency installation/upgrades. `.puppeteerrc.cjs` installs the required Chrome version into `storage/app/puppeteer`, matching the PHP worker's cache path. Grant the web-server account read/execute access to the browser and write access to `storage/app/vouchers`. If Node is not on the web-server PATH, set `VOUCHER_NODE_BINARY` to its absolute executable path and rebuild config cache. Linux hosts also need Chrome's system libraries.

Smoke test without customer data: `node scripts/generate-voucher-pdf.cjs tests/fixtures/voucher-pdf.html storage/app/voucher-smoke-test.pdf`. Check the resulting PDF, then remove that test output. Test the actual invoice download on staging too.

- Verify desktop and 327px/mobile POS: product search, whole-sale price type, quantity, selling unit, FOC, totals and checkout without clipped controls or page overflow.
- Verify separate admin/customer login sessions, CSRF-protected actions, password reset mail, permission-denied responses and logout.
- On disposable staging records: complete/print cash and credit sales, purchase/FOC receipt, stock adjustment, transfer and reversal. Reconcile stock and financial totals; retry a request to check duplicate protection.
- Verify automatic/manual pricing, below-cost rejection, settings saves, CSV exports and customer PDF statements.
- Verify production assets load without localhost/Vite requests, browser errors, mixed content or broken dynamic imports. Check slow-network performance.
- Configure the scheduler to run `php artisan schedule:run` every minute. Scheduled reservations expiry, health checks and inventory checks depend on it.
- If queue connection is not sync, configure a supervised worker and restart it on each release. Test configured mail/broadcast services.
- Verify backup restore, log rotation, monitoring/alerts and real printer behavior. Review demo accounts/data before exposing the site.

## Go-live and rollback

After staging acceptance, take another backup, schedule a maintenance window, deploy the verified artifact, apply migrations, rebuild caches, restart workers/PHP as appropriate and rerun `release:check` plus smoke tests before reopening.

For rollback, stop writes first. Restore the previous code/artifacts only if compatible with the migrated schema; otherwise restore the matching database/upload backup as a coordinated recovery. Do not blindly run migration rollback: new sales and stock movements must not be lost. No deployment or live-data changes were performed during this preparation.
