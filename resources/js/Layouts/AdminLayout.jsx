import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@/spa/router';
import '@/styles/admin.css';
import Icon from '@/Components/Admin/icons';
import { AdminLogo, ThemeControl } from '@/Components/Admin/shared';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import { usePhraseTranslation, useTranslation } from '@/Utils/i18n';
import { useStoredState } from '@/Utils/useStoredState';
import { routeWithBase } from '@/Utils/url';

function normalizeAdminPath(url, appBase) {
    let path = (url || '/').split('?')[0];
    const base = (appBase || '').replace(/\/+$/, '');
    if (base && base !== '/' && path.startsWith(base)) {
        path = path.slice(base.length) || '/';
    }
    return path.replace(/\/+$/, '') || '/';
}

function isNavActive(currentPath, item, appBase) {
    const target = normalizeAdminPath(item.href, appBase);
    const isExcluded = (item.excludeActivePaths || [])
        .map((path) => normalizeAdminPath(path, appBase))
        .some((path) => currentPath === path || currentPath.startsWith(`${path}/`));

    if (isExcluded) return false;
    if (currentPath === target) return true;
    if (target !== '/admin/dashboard' && target !== '/admin' && currentPath.startsWith(`${target}/`)) {
        return true;
    }
    if ((target === '/admin/dashboard' || target === '/admin') && (currentPath === '/admin' || currentPath === '/admin/dashboard')) {
        return true;
    }
    return false;
}

function NavLink({ item, currentPath, appBase, onNavigate }) {
    const active = !item.external && isNavActive(currentPath, item, appBase);
    const className = active ? 'active' : '';

    const content = (
        <>
            <Icon name={item.icon} size={17} />
            <span className="nav-item-label">{item.label}</span>
            {item.badge > 0 && <small className="badge">{item.badge > 99 ? '99+' : item.badge}</small>}
        </>
    );

    if (item.external) {
        return (
            <a href={item.href} className={className} target="_blank" rel="noopener noreferrer" onClick={onNavigate}>
                {content}
            </a>
        );
    }

    return (
        <Link href={item.href} className={className} onClick={onNavigate}>
            {content}
        </Link>
    );
}

const AdminShellContext = createContext(null);

function AdminChrome({ children, mainClassName = '' }) {
    const { url, props } = usePage();
    const { app_base, app_url, app_settings, orders_pending_payment_count, chat_unread_count, is_super_admin } = props;
    const t = useTranslation();
    const authUser = props.auth?.user;
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [theme, setTheme] = useStoredState('larlarpick.admin.theme', 'light');
    const [density, setDensity] = useStoredState('larlarpick.admin.density', 'compact');
    const [sidebarCollapsed, setSidebarCollapsed] = useStoredState('larlarpick.admin.sidebar.collapsed', false);
    const [collapsedNavSections, setCollapsedNavSections] = useStoredState('larlarpick.admin.nav.collapsed', []);
    const [brand, setBrand] = useState(app_settings?.theme_color || '#087f74');
    const logoutForm = useForm({});

    const currentPath = useMemo(() => normalizeAdminPath(url, app_base), [url, app_base]);
    const closeMobile = () => setMobileOpen(false);
    const closeProfile = () => setProfileOpen(false);
    const goBack = () => {
        if (window.history.length > 1) {
            window.history.back();
            return;
        }

        router.visit(routeWithBase('/admin/dashboard', app_base), { replace: true });
    };
    const storefrontHref = app_url || routeWithBase('/', app_base);
    const roleLabel = authUser?.role_label || (authUser?.role || 'staff').replace(/_/g, ' ');
    const can = (permission) => is_super_admin || (authUser?.permissions || []).includes(permission);
    const canManageBusiness = ['manage_coupons', 'manage_flash_sales', 'manage_blogs', 'manage_payment_methods', 'manage_finance', 'view_reports', 'reports.sales', 'reports.inventory', 'moderate_reviews', 'view_customers'].some(can);
    const initials = (authUser?.name || 'A')
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    useEffect(() => {
        setBrand(app_settings?.theme_color || '#087f74');
    }, [app_settings?.theme_color]);

    useEffect(() => {
        if (!profileOpen) return undefined;

        const close = (event) => {
            if (!event.target.closest?.('.admin-profile-menu')) {
                setProfileOpen(false);
            }
        };

        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [profileOpen]);

    useEffect(() => {
        const closeOnEscape = (event) => {
            if (event.key !== 'Escape') return;
            setProfileOpen(false);
            setMobileOpen(false);
        };

        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, []);

    const toggleNavSection = (title) => {
        setCollapsedNavSections((current) => (
            current.includes(title)
                ? current.filter((item) => item !== title)
                : [...current, title]
        ));
    };

    const navSections = useMemo(
        () => [
            {
                title: t('admin.sections.overview', 'Overview'),
                items: [
                    {
                        label: t('admin.items.dashboard', 'Dashboard'),
                        href: routeWithBase('/admin/dashboard', app_base),
                        icon: 'grid',
                    },
                ],
            },
            {
                title: t('admin.sections.sales', 'Sales'),
                items: [
                    ...(can('pos.access')
                        ? [
                              {
                                  label: t('admin.items.pos', 'POS'),
                                  href: routeWithBase('/admin/pos', app_base),
                                  icon: 'card',
                              },
                          ]
                        : []),
                    ...(can('orders.view')
                        ? [
                              {
                                  label: t('admin.items.orders', 'Orders'),
                                  href: routeWithBase('/admin/orders', app_base),
                                  icon: 'receipt',
                                  badge: orders_pending_payment_count,
                              },
                          ]
                        : []),
                    ...(can('manage_finance')
                        ? [
                              {
                                  label: t('admin.items.finance', 'Finance'),
                                  href: routeWithBase('/admin/finance', app_base),
                                  icon: 'card',
                              },
                          ]
                        : []),
                    ...(can('manage_payment_methods')
                        ? [
                              {
                                  label: t('admin.items.payment_methods', 'Payment methods'),
                                  href: routeWithBase('/admin/payment-methods', app_base),
                                  icon: 'wallet',
                              },
                          ]
                        : []),
                    ...(['view_reports', 'reports.sales', 'reports.inventory'].some(can)
                        ? [
                              {
                                  label: t('admin.items.reports', 'Reports'),
                                  href: routeWithBase('/admin/reports', app_base),
                                  icon: 'chart',
                              },
                          ]
                        : []),
                ],
            },
            ...(is_super_admin || can('manage_coupons') || can('manage_flash_sales') || can('manage_blogs')
                ? [
                      {
                          title: t('admin.sections.marketing', 'Marketing'),
                          items: [
                              ...(can('manage_blogs')
                                  ? [
                                        {
                                            label: t('admin.items.blogs', 'Blogs'),
                                            href: routeWithBase('/admin/blogs', app_base),
                                            icon: 'book',
                                        },
                                    ]
                                  : []),
                              ...(can('manage_flash_sales')
                                  ? [
                                        {
                                            label: t('admin.items.flash_sales', 'Flash sales'),
                                            href: routeWithBase('/admin/flash-sales', app_base),
                                            icon: 'bolt',
                                        },
                                    ]
                                  : []),
                              ...(can('manage_coupons')
                                  ? [
                                        {
                                            label: t('admin.items.coupons', 'Coupons'),
                                            href: routeWithBase('/admin/coupons', app_base),
                                            icon: 'wallet',
                                        },
                                    ]
                                  : []),
                              ...(is_super_admin
                                  ? [
                                        {
                                            label: t('admin.items.point_configuration', 'Point configuration'),
                                            href: routeWithBase('/admin/marketing/point-configuration', app_base),
                                            icon: 'wallet',
                                        },
                                    ]
                                  : []),
                          ],
                      },
                  ]
                : []),
            ...(can('catalog.view')
                ? [
                      {
                          title: t('admin.sections.catalog', 'Catalog'),
                          items: [
                              {
                                  label: t('admin.items.products', 'Products'),
                                  href: routeWithBase('/admin/products', app_base),
                                  icon: 'shop',
                                  excludeActivePaths: [routeWithBase('/admin/products/barcodes', app_base)],
                              },
                              ...(can('catalog.manage')
                                  ? [
                                        {
                                            label: t('admin.items.barcode_printing', 'Barcode printing'),
                                            href: routeWithBase('/admin/products/barcodes', app_base),
                                            icon: 'barcode',
                                        },
                                    ]
                                  : []),
                              {
                                  label: t('admin.items.categories', 'Categories'),
                                  href: routeWithBase('/admin/categories', app_base),
                                  icon: 'tag',
                              },
                          ],
                      },
                  ]
                : []),
            ...(['locations.view', 'inventory.view', 'inventory.receive', 'inventory.adjust.create', 'inventory.transfer.create'].some(can)
                ? [
                      {
                          title: t('admin.sections.inventory', 'Inventory'),
                          items: [
                              ...(can('inventory.view')
                                  ? [
                                        {
                                            label: t('admin.items.stock_overview', 'Stock overview'),
                                            href: routeWithBase('/admin/inventory', app_base),
                                            icon: 'box',
                                            excludeActivePaths: [
                                                routeWithBase('/admin/inventory/receipts', app_base),
                                                routeWithBase('/admin/inventory/adjustments', app_base),
                                                routeWithBase('/admin/inventory/transfers', app_base),
                                            ],
                                        },
                                    ]
                                  : []),
                              ...(can('inventory.receive')
                                  ? [{ label: t('admin.items.receiving', 'Receiving'), href: routeWithBase('/admin/inventory/receipts', app_base), icon: 'receipt' }]
                                  : []),
                              ...(can('inventory.adjust.create')
                                  ? [{ label: t('admin.items.adjustments', 'Adjustments'), href: routeWithBase('/admin/inventory/adjustments', app_base), icon: 'edit' }]
                                  : []),
                              ...(can('inventory.transfer.create')
                                  ? [{ label: t('admin.items.transfers', 'Transfers'), href: routeWithBase('/admin/inventory/transfers', app_base), icon: 'truck' }]
                                  : []),
                              ...(can('locations.view')
                                  ? [{ label: t('admin.items.warehouses', 'Warehouses'), href: routeWithBase('/admin/locations', app_base), icon: 'box' }]
                                  : []),
                          ],
                      },
                  ]
                : []),
            {
                title: t('admin.sections.support', 'Support'),
                items: [
                    ...(can('chat.manage')
                        ? [
                              {
                                  label: t('admin.items.customer_chats', 'Customer chats'),
                                  href: routeWithBase('/admin/chats', app_base),
                                  icon: 'chat',
                                  badge: chat_unread_count,
                              },
                          ]
                        : []),
                    ...(can('moderate_reviews')
                        ? [
                              {
                                  label: t('admin.items.reviews', 'Reviews'),
                                  href: routeWithBase('/admin/reviews', app_base),
                                  icon: 'check',
                              },
                          ]
                        : []),
                    ...(can('view_customers')
                        ? [
                              {
                                  label: t('admin.items.customers', 'Customers'),
                                  href: routeWithBase('/admin/customers', app_base),
                                  icon: 'users',
                              },
                          ]
                        : []),
                ],
            },
            ...(can('staff.manage') || can('roles.manage') || can('settings.manage')
                ? [
                      {
                          title: t('admin.sections.team', 'Team'),
                          items: [
                              ...(can('staff.manage')
                                  ? [
                                        {
                                            label: t('admin.items.staff_accounts', 'Staff accounts'),
                                            href: routeWithBase('/admin/users', app_base),
                                            icon: 'users',
                                        },
                                    ]
                                  : []),
                              ...(can('roles.manage')
                                  ? [
                                        {
                                            label: t('admin.items.roles_permissions', 'Roles & permissions'),
                                            href: routeWithBase('/admin/roles', app_base),
                                            icon: 'lock',
                                        },
                                    ]
                                  : []),
                              ...(can('settings.manage')
                                  ? [
                                        {
                                            label: t('admin.items.settings', 'Settings'),
                                            href: routeWithBase('/admin/settings', app_base),
                                            icon: 'settings',
                                        },
                                    ]
                                  : []),
                          ],
                      },
                  ]
                : []),
            ...(can('view_audit_logs')
                ? [
                      {
                          title: t('admin.sections.security', 'Security'),
                          items: [
                              {
                                  label: t('admin.items.audit_logs', 'Audit logs'),
                                  href: routeWithBase('/admin/audit-logs', app_base),
                                  icon: 'lock',
                              },
                          ],
                      },
                  ]
                : []),
            {
                title: t('admin.sections.tools', 'Tools'),
                items: [
                    ...(can('storefront.manage')
                        ? [
                              {
                                  label: t('admin.items.storefront', 'Storefront'),
                                  href: routeWithBase('/admin/storefront', app_base),
                                  icon: 'image',
                              },
                          ]
                        : []),
                    {
                        label: t('admin.view_storefront', 'View storefront'),
                        href: storefrontHref,
                        icon: 'storefront',
                        external: true,
                    },
                ],
            },
        ],
        [app_base, storefrontHref, orders_pending_payment_count, chat_unread_count, is_super_admin, authUser?.role, authUser?.permissions, t],
    );

    return (
        <div
            className={`app-root ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
            data-theme={theme}
            data-density={density}
            style={{ '--color-primary': brand || app_settings?.theme_color || '#087f74' }}
        >
            <div className="admin-app">
                {mobileOpen && (
                    <button
                        type="button"
                        className="admin-sidebar-overlay"
                        aria-label={t('admin.close_navigation', 'Close navigation')}
                        onClick={closeMobile}
                    />
                )}

                <aside className={`admin-sidebar glass ${mobileOpen ? 'open' : ''}`}>
                    <AdminLogo settings={app_settings} />
                    <nav aria-label={t('admin.navigation', 'Admin navigation')}>
                        {navSections.map((section) => {
                            const sectionCollapsed = collapsedNavSections.includes(section.title);
                            return (
                            <div key={section.title} className={`nav-section ${sectionCollapsed ? 'collapsed' : ''}`}>
                                <button
                                    type="button"
                                    className="nav-section-label"
                                    onClick={() => toggleNavSection(section.title)}
                                    aria-expanded={!sectionCollapsed}
                                >
                                    <span>{section.title}</span>
                                    <Icon name={sectionCollapsed ? 'chevronDown' : 'chevronUp'} size={11} />
                                </button>
                                {(sidebarCollapsed || !sectionCollapsed) && section.items.map((item) => (
                                    <NavLink
                                        key={item.label}
                                        item={item}
                                        currentPath={currentPath}
                                        appBase={app_base}
                                        onNavigate={closeMobile}
                                    />
                                ))}
                            </div>
                        )})}
                    </nav>
                </aside>

                <main className={`admin-main ${mainClassName}`.trim()}>
                    <header className="admin-topbar glass">
                        <button
                            type="button"
                            className="icon-btn admin-back-button"
                            aria-label={t('admin.go_back', 'Go back')}
                            title={t('admin.go_back', 'Go back')}
                            onClick={goBack}
                        >
                            <Icon name="arrowLeft" size={17} />
                        </button>
                        <button
                            type="button"
                            className="icon-btn admin-sidebar-toggle"
                            aria-label={sidebarCollapsed ? t('Expand sidebar') : t('Collapse sidebar')}
                            title={sidebarCollapsed ? t('Expand sidebar') : t('Collapse sidebar')}
                            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
                        >
                            <Icon name="menu" size={16} />
                        </button>
                        <button
                            type="button"
                            className="icon-btn admin-mobile-toggle"
                            aria-label={mobileOpen ? t('admin.close_navigation', 'Close navigation') : t('admin.open_navigation', 'Open navigation')}
                            onClick={() => setMobileOpen((open) => !open)}
                        >
                            <Icon name={mobileOpen ? 'close' : 'menu'} size={16} />
                        </button>
                        <div className="admin-topbar-actions">
                            <ThemeControl
                                theme={theme}
                                onThemeChange={setTheme}
                                brand={brand}
                                onBrandChange={setBrand}
                                density={density}
                                onDensityChange={setDensity}
                            />
                            <LanguageSwitcher compact className="admin-language-switcher" />
                            <Link
                                href={routeWithBase('/admin/orders?tab=payments', app_base)}
                                className={`icon-btn notification-bell ${orders_pending_payment_count > 0 ? 'has-count' : ''}`}
                                aria-label={t('admin.orders_waiting', `${orders_pending_payment_count || 0} orders awaiting payment review`, { count: orders_pending_payment_count || 0 })}
                                title={
                                    orders_pending_payment_count > 0
                                        ? t('admin.orders_waiting', `${orders_pending_payment_count} orders awaiting payment review`, { count: orders_pending_payment_count })
                                        : t('admin.no_notifications', 'No pending order notifications')
                                }
                            >
                                <Icon name="bell" size={16} />
                                {orders_pending_payment_count > 0 && (
                                    <span className="notification-count">
                                        {orders_pending_payment_count > 99 ? '99+' : orders_pending_payment_count}
                                    </span>
                                )}
                            </Link>
                            <div className="admin-profile-menu">
                                <button
                                    type="button"
                                    className="profile-menu-trigger"
                                    aria-haspopup="menu"
                                    aria-expanded={profileOpen}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setProfileOpen((open) => !open);
                                    }}
                                >
                                    <span className="profile-menu-avatar">{initials}</span>
                                    <span className="profile-menu-copy">
                                        <strong>{authUser?.name || t('admin.admin', 'Admin')}</strong>
                                        <small>{roleLabel}</small>
                                    </span>
                                    <Icon name="navigation" size={12} style={{ transform: profileOpen ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
                                </button>
                                {profileOpen && (
                                    <div className="profile-dropdown glass" role="menu">
                                        <div className="profile-dropdown-head">
                                            <span className="profile-menu-avatar">{initials}</span>
                                            <div>
                                                <strong>{authUser?.name || t('admin.admin', 'Admin')}</strong>
                                                <small>{authUser?.email || roleLabel}</small>
                                            </div>
                                        </div>
                                        <Link href={routeWithBase('/admin/profile', app_base)} role="menuitem" onClick={closeProfile}>
                                            <Icon name="user" size={14} />
                                            {t('admin.profile_settings', 'Profile settings')}
                                        </Link>
                                        <a href={storefrontHref} target="_blank" rel="noopener noreferrer" role="menuitem" onClick={closeProfile}>
                                            <Icon name="storefront" size={14} />
                                            {t('admin.view_storefront', 'View storefront')}
                                        </a>
                                        <button
                                            type="button"
                                            role="menuitem"
                                            disabled={logoutForm.processing}
                                            onClick={() => {
                                                closeProfile();
                                                logoutForm.post(routeWithBase('/admin/logout', app_base));
                                            }}
                                        >
                                            <Icon name="logout" size={14} />
                                            {t('admin.log_out', 'Log out')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>

                    {children}
                </main>
            </div>
        </div>
    );
}

function AdminPageContent({
    children,
    title = 'Admin Panel',
    eyebrow,
    action,
    contentClassName = '',
    showPageHeading = true,
}) {
    const { props } = usePage();
    const { app_settings } = props;
    const t = useTranslation();
    const tp = usePhraseTranslation();
    const today = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    });
    const displayTitle = tp(title);
    const displayEyebrow = eyebrow ? tp(eyebrow) : today;

    return (
        <>
            <Head title={displayTitle ? `${displayTitle} | ${app_settings?.app_name || 'LaLaPick'} ${t('admin.panel', 'Admin Panel')}` : undefined}>
                {app_settings?.favicon_url && <link rel="icon" href={app_settings.favicon_url} />}
            </Head>
            <div className={`admin-content ${contentClassName}`.trim()}>
                {showPageHeading && (
                    <div className="admin-page-heading">
                        <div>
                            <p className="eyebrow">{displayEyebrow}</p>
                            <h1>{displayTitle}</h1>
                        </div>
                        {action}
                    </div>
                )}
                {children}
            </div>
        </>
    );
}

export function AdminPersistentShell({ active = false, children }) {
    const [mainClassName, setMainClassName] = useState('');
    const contextValue = useMemo(() => ({ setMainClassName }), []);

    useEffect(() => {
        if (!active) {
            setMainClassName('');
        }
    }, [active]);

    if (!active) {
        return children;
    }

    return (
        <AdminShellContext.Provider value={contextValue}>
            <AdminChrome mainClassName={mainClassName}>
                {children}
            </AdminChrome>
        </AdminShellContext.Provider>
    );
}

export default function AdminLayout({
    children,
    title = 'Admin Panel',
    eyebrow,
    action,
    mainClassName = '',
    contentClassName = '',
    showPageHeading = true,
}) {
    const shell = useContext(AdminShellContext);

    useLayoutEffect(() => {
        if (!shell) return undefined;

        shell.setMainClassName(mainClassName || '');
        return () => shell.setMainClassName('');
    }, [shell, mainClassName]);

    const page = (
        <AdminPageContent
            title={title}
            eyebrow={eyebrow}
            action={action}
            contentClassName={contentClassName}
            showPageHeading={showPageHeading}
        >
            {children}
        </AdminPageContent>
    );

    if (shell) {
        return page;
    }

    return (
        <AdminChrome mainClassName={mainClassName}>
            {page}
        </AdminChrome>
    );
}
