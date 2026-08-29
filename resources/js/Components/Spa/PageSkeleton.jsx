const skeletonLines = (count, className = '') =>
    Array.from({ length: count }, (_, index) => (
        <span
            key={index}
            className={`spa-skeleton-block ${className}`.trim()}
            style={{ '--skeleton-index': index }}
        />
    ));

function AdminTableSkeleton() {
    return (
        <div className="spa-skeleton-panel">
            <div className="spa-skeleton-panel-heading">
                <div>
                    <span className="spa-skeleton-block line short" />
                    <span className="spa-skeleton-block line heading" />
                </div>
                <span className="spa-skeleton-block button" />
            </div>
            <div className="spa-skeleton-table" aria-hidden="true">
                <div className="spa-skeleton-table-row header">
                    {skeletonLines(5, 'line')}
                </div>
                {Array.from({ length: 7 }, (_, row) => (
                    <div className="spa-skeleton-table-row" key={row}>
                        {skeletonLines(5, 'line')}
                    </div>
                ))}
            </div>
        </div>
    );
}

function AdminPageSkeleton({ layout }) {
    return (
        <div className="admin-content spa-page-skeleton spa-page-skeleton-admin" data-layout={layout}>
            <div className="spa-skeleton-page-heading" aria-hidden="true">
                <div>
                    <span className="spa-skeleton-block line eyebrow" />
                    <span className="spa-skeleton-block line title" />
                </div>
                <span className="spa-skeleton-block button wide" />
            </div>

            {layout === 'dashboard' && (
                <div className="spa-skeleton-metrics" aria-hidden="true">
                    {Array.from({ length: 4 }, (_, index) => (
                        <div className="spa-skeleton-metric" key={index}>
                            <span className="spa-skeleton-block line short" />
                            <span className="spa-skeleton-block line metric-value" />
                            <span className="spa-skeleton-block line medium" />
                        </div>
                    ))}
                </div>
            )}

            {layout === 'form' ? (
                <div className="spa-skeleton-panel spa-skeleton-form" aria-hidden="true">
                    <span className="spa-skeleton-block line heading" />
                    <div className="spa-skeleton-form-grid">
                        {Array.from({ length: 8 }, (_, index) => (
                            <div key={index}>
                                <span className="spa-skeleton-block line short" />
                                <span className="spa-skeleton-block input" />
                            </div>
                        ))}
                    </div>
                    <span className="spa-skeleton-block input textarea" />
                    <div className="spa-skeleton-actions">
                        <span className="spa-skeleton-block button" />
                        <span className="spa-skeleton-block button wide" />
                    </div>
                </div>
            ) : (
                <>
                    <div className="spa-skeleton-toolbar" aria-hidden="true">
                        <span className="spa-skeleton-block input search" />
                        <span className="spa-skeleton-block input" />
                        <span className="spa-skeleton-block input" />
                        <span className="spa-skeleton-block button" />
                    </div>
                    <AdminTableSkeleton />
                </>
            )}
        </div>
    );
}

function StorefrontPageSkeleton({ layout }) {
    const isDetail = layout === 'detail';
    const isForm = layout === 'form';

    return (
        <main className="spa-page-skeleton spa-page-skeleton-storefront" data-layout={layout}>
            <div className="spa-skeleton-storefront-heading" aria-hidden="true">
                <span className="spa-skeleton-block line eyebrow" />
                <span className="spa-skeleton-block line storefront-title" />
                <span className="spa-skeleton-block line storefront-copy" />
            </div>

            {isDetail ? (
                <div className="spa-skeleton-product-detail" aria-hidden="true">
                    <span className="spa-skeleton-block media hero" />
                    <div className="spa-skeleton-detail-copy">
                        <span className="spa-skeleton-block line short" />
                        <span className="spa-skeleton-block line title" />
                        <span className="spa-skeleton-block line medium" />
                        <span className="spa-skeleton-block line price" />
                        <span className="spa-skeleton-block input" />
                        <span className="spa-skeleton-block button wide" />
                    </div>
                </div>
            ) : isForm ? (
                <div className="spa-skeleton-checkout" aria-hidden="true">
                    <div className="spa-skeleton-panel spa-skeleton-form">
                        {Array.from({ length: 6 }, (_, index) => (
                            <div key={index}>
                                <span className="spa-skeleton-block line short" />
                                <span className="spa-skeleton-block input" />
                            </div>
                        ))}
                    </div>
                    <div className="spa-skeleton-panel">
                        {skeletonLines(6, 'line')}
                    </div>
                </div>
            ) : (
                <>
                    <div className="spa-skeleton-storefront-toolbar" aria-hidden="true">
                        <span className="spa-skeleton-block input search" />
                        <span className="spa-skeleton-block input" />
                    </div>
                    <div className="spa-skeleton-card-grid" aria-hidden="true">
                        {Array.from({ length: 8 }, (_, index) => (
                            <div className="spa-skeleton-card" key={index}>
                                <span className="spa-skeleton-block media" />
                                <span className="spa-skeleton-block line short" />
                                <span className="spa-skeleton-block line heading" />
                                <span className="spa-skeleton-block line medium" />
                            </div>
                        ))}
                    </div>
                </>
            )}
        </main>
    );
}

function AuthPageSkeleton() {
    return (
        <main className="spa-page-skeleton spa-page-skeleton-auth">
            <div className="spa-skeleton-auth-card" aria-hidden="true">
                <span className="spa-skeleton-block media logo" />
                <span className="spa-skeleton-block line title" />
                <span className="spa-skeleton-block line medium" />
                <span className="spa-skeleton-block input" />
                <span className="spa-skeleton-block input" />
                <span className="spa-skeleton-block button full" />
            </div>
        </main>
    );
}

function normalizePath(url, appBase = '') {
    let pathname = '/';

    try {
        pathname = new URL(url || '/', window.location.origin).pathname;
    } catch {
        pathname = String(url || '/').split('?')[0];
    }

    const base = appBase && appBase !== '/' ? `/${String(appBase).replace(/^\/+|\/+$/g, '')}` : '';
    if (base && (pathname === base || pathname.startsWith(`${base}/`))) {
        pathname = pathname.slice(base.length) || '/';
    }

    return pathname.replace(/\/+$/, '') || '/';
}

export function skeletonRouteInfo(url, appBase = '') {
    const path = normalizePath(url, appBase);
    const isAdmin = path === '/admin' || path.startsWith('/admin/');
    const isAuth = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/confirm-password']
        .some((route) => path === route || path.startsWith(`${route}/`));
    const isForm = /\/(create|edit|checkout|profile)$/.test(path)
        || path.includes('/settings')
        || path.includes('/configuration');
    const isDashboard = path === '/' || path === '/admin' || path === '/admin/dashboard';
    const segments = path.split('/').filter(Boolean);
    const collectionRoots = new Set([
        'products',
        'categories',
        'blogs',
        'orders',
        'customers',
        'inventory',
        'reviews',
        'coupons',
        'users',
        'roles',
        'locations',
        'finance',
        'reports',
        'chats',
    ]);
    const lastSegment = segments[segments.length - 1] || '';
    const isDetail = !isForm
        && !isDashboard
        && segments.length > (isAdmin ? 2 : 1)
        && !collectionRoots.has(lastSegment);

    return {
        path,
        mode: isAdmin ? 'admin' : isAuth ? 'auth' : 'storefront',
        layout: isDashboard ? 'dashboard' : isForm ? 'form' : isDetail ? 'detail' : 'listing',
    };
}

export default function PageSkeleton({ url, appBase = '' }) {
    const { mode, layout } = skeletonRouteInfo(url, appBase);

    return (
        <div
            className="spa-loading-region"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label="Loading page"
            data-testid="spa-page-skeleton"
        >
            <span className="spa-skeleton-sr-only">Loading page…</span>
            {mode === 'admin' && <AdminPageSkeleton layout={layout} />}
            {mode === 'storefront' && <StorefrontPageSkeleton layout={layout} />}
            {mode === 'auth' && <AuthPageSkeleton />}
        </div>
    );
}
