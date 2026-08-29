import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { useMemo } from 'react';
import { Head, Link, usePage } from '@/spa/router';
import { routeWithBase } from '@/Utils/url';
import { paymentLabels } from '@/constants/orderLabels';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

const money = formatMoney;

const compactNumber = (value) => Number(value || 0).toLocaleString();

function MetricCard({ label, value, hint, icon, href }) {
    const t = usePhraseTranslation();
    const content = (
        <>
            <span className="icon-well">
                <Icon name={icon} size={15} />
            </span>
            <small>{t(label)}</small>
            <strong>{value}</strong>
            {hint && <p>{t(hint)}</p>}
        </>
    );

    if (href) {
        return (
            <Link href={href} className="metric-card glass">
                {content}
            </Link>
        );
    }

    return <article className="metric-card glass">{content}</article>;
}

function MonthlySalesBarChart({ trend = [] }) {
    const t = usePhraseTranslation();
    const chart = useMemo(() => {
        const rows = trend.map((row) => ({
            day: row.day,
            orders: Number(row.orders || 0),
            revenue: Number(row.revenue || 0),
        }));

        if (rows.length === 0) {
            return null;
        }

        const width = 720;
        const height = 260;
        const padding = { top: 18, right: 18, bottom: 34, left: 76 };
        const innerWidth = width - padding.left - padding.right;
        const innerHeight = height - padding.top - padding.bottom;
        const maxRevenue = Math.max(...rows.map((row) => row.revenue), 1);
        const step = rows.length ? innerWidth / rows.length : innerWidth;
        const barWidth = Math.max(8, Math.min(28, step * 0.62));
        const xFor = (index) => padding.left + step * index + step / 2;
        const yForRevenue = (value) => padding.top + (1 - value / maxRevenue) * innerHeight;
        const ticks = Array.from({ length: 5 }, (_, index) => (maxRevenue / 4) * index).reverse();
        const labelStep = Math.max(1, Math.ceil(rows.length / 8));
        const totalRevenue = rows.reduce((total, row) => total + row.revenue, 0);
        const salesDays = rows.filter((row) => row.revenue > 0).length;
        const bestDay = rows.reduce((best, row) => (row.revenue > best.revenue ? row : best), rows[0]);

        return {
            rows,
            width,
            height,
            padding,
            innerHeight,
            barWidth,
            xFor,
            yForRevenue,
            ticks,
            labelStep,
            totalRevenue,
            salesDays,
            bestDay,
        };
    }, [trend]);

    if (!chart) {
        return (
            <div className="finance-chart-empty">
                <span className="muted">{t('No sales data in this period.')}</span>
            </div>
        );
    }

    return (
        <div className="finance-chart dashboard-sales-chart">
            <div className="finance-chart-summary">
                <div>
                    <span className="chart-dot income" />
                    <small>{t('Month sales')}</small>
                    <strong>{money(chart.totalRevenue)}</strong>
                </div>
                <div>
                    <span className="chart-dot net" />
                    <small>{t('Sales days')}</small>
                    <strong>{compactNumber(chart.salesDays)}</strong>
                </div>
                <div>
                    <span className="chart-dot orders" />
                    <small>{t('Best day')}</small>
                    <strong>{chart.bestDay?.revenue > 0 ? money(chart.bestDay.revenue) : money(0)}</strong>
                </div>
            </div>
            <svg className="dashboard-monthly-bars" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={t('Monthly paid sales bar chart')}>
                {chart.ticks.map((tick) => (
                    <g key={tick}>
                        <line
                            className="chart-grid-line"
                            x1={chart.padding.left}
                            x2={chart.width - chart.padding.right}
                            y1={chart.yForRevenue(tick)}
                            y2={chart.yForRevenue(tick)}
                        />
                        <text className="chart-y-label" x={chart.padding.left - 10} y={chart.yForRevenue(tick) + 4}>
                            {money(tick)}
                        </text>
                    </g>
                ))}
                {chart.rows.map((row, index) => {
                    const x = chart.xFor(index);
                    const y = chart.yForRevenue(row.revenue);
                    const barHeight = chart.padding.top + chart.innerHeight - y;
                    const height = row.revenue > 0 ? Math.max(4, barHeight) : 2;
                    const barY = row.revenue > 0 ? y : chart.padding.top + chart.innerHeight - height;

                    return (
                        <rect
                            key={row.day}
                            className={`chart-bar revenue ${row.revenue > 0 ? 'has-sale' : 'empty'}`}
                            x={x - chart.barWidth / 2}
                            y={barY}
                            width={chart.barWidth}
                            height={height}
                            rx="3"
                        >
                            <title>{`${row.day}: ${money(row.revenue)}`}</title>
                        </rect>
                    );
                })}
                {chart.rows.map((row, index) => (
                    (index % chart.labelStep === 0 || index === chart.rows.length - 1) && (
                        <text key={`${row.day}-label`} className="chart-x-label" x={chart.xFor(index)} y={chart.height - 10}>
                            {row.day.slice(5)}
                        </text>
                    )
                ))}
            </svg>
        </div>
    );
}

function ActionGrid({ actions }) {
    const t = usePhraseTranslation();

    return (
        <div className="dashboard-action-grid">
            {actions.map((action) => (
                <Link key={action.href} href={action.href} className="dashboard-action">
                    <span className="icon-well">
                        <Icon name={action.icon} size={15} />
                    </span>
                    <strong>{t(action.label)}</strong>
                    <small>{t(action.hint)}</small>
                </Link>
            ))}
        </div>
    );
}

function PipelineRow({ label, value, total, status }) {
    const t = usePhraseTranslation();
    const percent = total > 0 ? Math.round((Number(value || 0) / total) * 100) : 0;

    return (
        <div className="dashboard-pipeline-row">
            <div className="stack-row">
                <span>{t(label)}</span>
                <StatusBadge status={status} label={String(value || 0)} />
            </div>
            <span className="dashboard-meter">
                <i style={{ width: `${percent}%` }} />
            </span>
        </div>
    );
}

function RankedProducts({ products }) {
    const t = usePhraseTranslation();
    const maxRevenue = Math.max(...products.map((product) => Number(product.revenue || 0)), 1);

    if (products.length === 0) {
        return <p className="muted">{t('No paid product sales in the last 30 days.')}</p>;
    }

    return (
        <div className="dashboard-ranked-list">
            {products.map((product, index) => (
                <div key={`${product.name}-${index}`}>
                    <div className="stack-row">
                        <div>
                            <strong>{product.name}</strong>
                            <small>{compactNumber(product.units)} {t('units sold')}</small>
                        </div>
                        <strong>{money(product.revenue)}</strong>
                    </div>
                    <span className="dashboard-meter">
                        <i style={{ width: `${Math.max(4, (Number(product.revenue || 0) / maxRevenue) * 100)}%` }} />
                    </span>
                </div>
            ))}
        </div>
    );
}

function LowStockList({ items }) {
    const t = usePhraseTranslation();

    if (items.length === 0) {
        return <p className="muted">{t('No low stock alerts right now.')}</p>;
    }

    return (
        <div className="dashboard-alert-rows">
            {items.map((item) => (
                <div key={`${item.product_id}-${item.location || 'location'}`} className="stack-row">
                    <div>
                        <strong>{item.name}</strong>
                        <small>{item.product_code || t('No product code')} {item.location ? `- ${item.location}` : ''}</small>
                    </div>
                    <StatusBadge
                        status={Number(item.available) <= 0 ? 'danger' : 'warning'}
                        label={`${compactNumber(item.available)} / ${compactNumber(item.min_quantity)}`}
                    />
                </div>
            ))}
        </div>
    );
}

export default function Dashboard({ stats = {}, recentOrders = [], productCount = 0, customerCount = 0, dashboard = {} }) {
    const { app_base, auth, is_super_admin } = usePage().props;
    const t = usePhraseTranslation();
    const can = (permission) => is_super_admin || (auth?.user?.permissions || []).includes(permission);
    const dashboardStats = {
        revenue_paid: 0,
        total: 0,
        pending_payment: 0,
        processing: 0,
        shipped: 0,
        delivered: 0,
        ...stats,
    };
    const dashboardData = {
        salesTrend: [],
        topProducts: [],
        lowStockItems: [],
        lowStockCount: 0,
        todayRevenue: 0,
        todayOrders: 0,
        monthRevenue: 0,
        activeProducts: productCount,
        draftProducts: 0,
        ...dashboard,
    };
    const fulfillmentTotal = Number(dashboardStats.processing || 0) + Number(dashboardStats.shipped || 0) + Number(dashboardStats.delivered || 0);
    const quickActions = [
        { label: 'Open POS', hint: 'Start a counter sale', icon: 'card', href: routeWithBase('/admin/pos', app_base), show: can('pos.access') },
        { label: 'Review payments', hint: 'Confirm uploaded proofs', icon: 'wallet', href: routeWithBase('/admin/orders?tab=payments', app_base), show: can('orders.view') },
        { label: 'Add product', hint: 'Create a catalog item', icon: 'plus', href: routeWithBase('/admin/products/create', app_base), show: can('catalog.manage') },
        { label: 'Receive stock', hint: 'Post new inventory', icon: 'receipt', href: routeWithBase('/admin/inventory/receipts/create', app_base), show: can('inventory.receive') },
        { label: 'View reports', hint: 'Analyze sales and inventory', icon: 'chart', href: routeWithBase('/admin/reports', app_base), show: ['view_reports', 'reports.sales', 'reports.inventory'].some(can) },
        { label: 'Point configuration', hint: 'Control loyalty earning and reuse', icon: 'wallet', href: routeWithBase('/admin/marketing/point-configuration', app_base), show: is_super_admin },
    ].filter((action) => action.show);
    const attentionItems = [
        {
            key: 'payments',
            show: Number(dashboardStats.pending_payment || 0) > 0,
            status: 'warning',
            icon: 'wallet',
            title: ':count payments need review',
            count: dashboardStats.pending_payment,
            hint: 'Approve or reject payment proofs',
            href: routeWithBase('/admin/orders?tab=payments', app_base),
        },
        {
            key: 'processing',
            show: Number(dashboardStats.processing || 0) > 0,
            status: 'info',
            icon: 'truck',
            title: ':count orders are processing',
            count: dashboardStats.processing,
            hint: 'Prepare and move orders to shipped',
            href: routeWithBase('/admin/orders?tab=fulfillment', app_base),
        },
        {
            key: 'stock',
            show: Number(dashboardData.lowStockCount || 0) > 0,
            status: 'danger',
            icon: 'box',
            title: ':count low stock product alerts',
            count: dashboardData.lowStockCount,
            hint: 'Restock before selling runs short',
            href: routeWithBase('/admin/inventory', app_base),
        },
    ].filter((item) => item.show);

    return (
        <AdminLayout title={t('Dashboard')} eyebrow={t('Operations overview')}>
            <Head title={t('Admin Dashboard')} />

            <div className="metrics-grid six compact-kpi-strip dashboard-kpi-strip">
                <MetricCard
                    label="Revenue (confirmed)"
                    value={money(dashboardStats.revenue_paid)}
                    hint="Paid orders total"
                    icon="wallet"
                />
                <MetricCard
                    label="Today"
                    value={money(dashboardData.todayRevenue)}
                    hint={`${compactNumber(dashboardData.todayOrders)} ${t('orders today')}`}
                    icon="bolt"
                    href={routeWithBase('/admin/orders', app_base)}
                />
                <MetricCard
                    label="This month"
                    value={money(dashboardData.monthRevenue)}
                    hint="Paid revenue"
                    icon="chart"
                    href={routeWithBase('/admin/reports', app_base)}
                />
                <MetricCard
                    label="Total orders"
                    value={compactNumber(dashboardStats.total)}
                    hint="All time"
                    icon="receipt"
                    href={routeWithBase('/admin/orders', app_base)}
                />
                <MetricCard
                    label="Awaiting payment"
                    value={compactNumber(dashboardStats.pending_payment)}
                    hint={dashboardStats.pending_payment > 0 ? 'Needs review' : 'Queue clear'}
                    icon="card"
                    href={routeWithBase('/admin/orders?tab=payments', app_base)}
                />
                <MetricCard
                    label="Low stock"
                    value={compactNumber(dashboardData.lowStockCount)}
                    hint={dashboardData.lowStockCount > 0 ? 'Needs restock' : 'Stock healthy'}
                    icon="box"
                    href={routeWithBase('/admin/inventory', app_base)}
                />
            </div>

            <div className="admin-grid">
                <section className="panel glass">
                    <PanelHeading eyebrow={t('Sales pulse')} title={t('Monthly sales')} />
                    <MonthlySalesBarChart trend={dashboardData.salesTrend} />
                </section>

                <div className="stack-sm">
                    <section className="panel glass">
                        <PanelHeading eyebrow={t('Priority')} title={t('Needs attention')} />
                        {attentionItems.length === 0 ? (
                            <div className="dashboard-empty-state">
                                <span className="icon-well">
                                    <Icon name="check" size={15} />
                                </span>
                                <div>
                                    <strong>{t('Queue looks clear')}</strong>
                                    <small>{t('No payment, fulfillment, or stock alerts right now.')}</small>
                                </div>
                            </div>
                        ) : (
                            <div className="dashboard-alert-rows">
                                {attentionItems.map((item) => (
                                    <Link key={item.key} href={item.href} className="dashboard-alert-row">
                                        <span className={`alert-icon ${item.status}`}>
                                            <Icon name={item.icon} size={15} />
                                        </span>
                                        <div>
                                            <strong>{t(item.title, { count: compactNumber(item.count) })}</strong>
                                            <small>{t(item.hint)}</small>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="panel glass">
                        <PanelHeading eyebrow={t('Speed')} title={t('Quick actions')} />
                        {quickActions.length > 0 ? (
                            <ActionGrid actions={quickActions} />
                        ) : (
                            <p className="muted">{t('No quick actions available for this role.')}</p>
                        )}
                    </section>
                </div>

                <section className="panel glass">
                    <PanelHeading
                        eyebrow={t('Live queue')}
                        title={t('Recent orders')}
                        actionLabel={t('View all')}
                        onAction={() => {
                            window.location.assign(routeWithBase('/admin/orders', app_base));
                        }}
                    />
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>{t('Order')}</th>
                                    <th>{t('Customer')}</th>
                                    <th>{t('Amount')}</th>
                                    <th>{t('Payment')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={4}>
                                            <span className="muted">{t('No orders yet.')}</span>
                                        </td>
                                    </tr>
                                ) : (
                                    recentOrders.map((order) => (
                                        <tr
                                            key={order.id}
                                            className="clickable"
                                            onClick={() => {
                                                window.location.assign(routeWithBase(`/admin/orders/${order.id}`, app_base));
                                            }}
                                        >
                                            <td>
                                                <strong>{order.order_number}</strong>
                                                <small>{new Date(order.created_at).toLocaleString()}</small>
                                            </td>
                                            <td>
                                                <strong>{order.user?.name || t('Guest')}</strong>
                                                <small>{order.items_count ?? order.items?.length ?? 0} {t('items')}</small>
                                            </td>
                                            <td>
                                                <strong>{money(order.final_amount)}</strong>
                                            </td>
                                            <td>
                                                <StatusBadge
                                                    status={order.payment_status}
                                                    label={paymentLabels[order.payment_status] || order.payment_status}
                                                />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <div className="stack-sm">
                    <section className="panel glass dashboard-fulfillment-panel">
                        <PanelHeading eyebrow={t('Fulfillment')} title={t('Shipping queue')} />
                        <div className="stack-sm">
                            <div className="stack-row">
                                <span>{t('Customers')}</span>
                                <strong>{compactNumber(customerCount)}</strong>
                            </div>
                            <div className="stack-row">
                                <span>{t('Active products')}</span>
                                <strong>{compactNumber(dashboardData.activeProducts)}</strong>
                            </div>
                            <div className="stack-row">
                                <span>{t('Draft products')}</span>
                                <strong>{compactNumber(dashboardData.draftProducts)}</strong>
                            </div>
                            <PipelineRow label="Processing" value={dashboardStats.processing} total={fulfillmentTotal} status="processing" />
                            <PipelineRow label="Shipped" value={dashboardStats.shipped} total={fulfillmentTotal} status="shipped" />
                            <PipelineRow label="Delivered" value={dashboardStats.delivered} total={fulfillmentTotal} status="delivered" />
                            <Link
                                href={routeWithBase('/admin/orders?tab=fulfillment', app_base)}
                                className="btn secondary full"
                            >
                                {t('Open fulfillment list')}
                            </Link>
                        </div>
                    </section>

                    <section className="panel glass dashboard-compact-list-panel dashboard-top-products-panel">
                        <PanelHeading eyebrow={t('Catalog')} title={t('Top products')} />
                        <RankedProducts products={dashboardData.topProducts} />
                    </section>

                    <section className="panel glass dashboard-compact-list-panel dashboard-low-stock-panel">
                        <PanelHeading
                            eyebrow={t('Inventory')}
                            title={t('Low stock watch')}
                            actionLabel={t('Manage inventory')}
                            onAction={() => {
                                window.location.assign(routeWithBase('/admin/inventory', app_base));
                            }}
                        />
                        <LowStockList items={dashboardData.lowStockItems} />
                    </section>
                </div>
            </div>
        </AdminLayout>
    );
}
