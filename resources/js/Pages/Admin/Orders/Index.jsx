import { useState } from 'react';
import { Head, Link, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { ColumnVisibilityControl, PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { orderStatusLabels, paymentLabels } from '@/constants/orderLabels';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

const tabs = [
    { key: '', label: 'All orders' },
    { key: 'payments', label: 'Awaiting payment' },
    { key: 'fulfillment', label: 'To ship' },
    { key: 'completed', label: 'Delivered' },
];

const formatOrderDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};

function MetricCard({ label, value, icon }) {
    const t = usePhraseTranslation();

    return (
        <article className="metric-card glass">
            <span className="icon-well">
                <Icon name={icon} size={15} />
            </span>
            <small>{t(label)}</small>
            <strong>{value}</strong>
        </article>
    );
}

export default function OrdersIndex({ orders, stats, filters, canReviewPayments, canManageOrders }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const [search, setSearch] = useState(filters.q ?? '');
    const [visibleColumns, setVisibleColumns] = useState({ items: true, payment: true, fulfillment: true });
    const activeTab = filters.tab ?? '';
    const toggleColumn = (key) => setVisibleColumns((current) => ({ ...current, [key]: current[key] === false }));

    const applyFilters = (patch) => {
        router.get(routeWithBase('/admin/orders', app_base), { ...filters, ...patch }, { preserveState: true, replace: true });
    };

    const handleSearch = (e) => {
        e.preventDefault();
        applyFilters({ q: search.trim() || undefined });
    };

    return (
        <AdminLayout title={t('Order management')} eyebrow={t('Sales operations')}>
            <Head title={t('Orders')} />

            <div className="metrics-grid six compact-kpi-strip orders-kpi-strip">
                <MetricCard label="Total orders" value={stats.total} icon="receipt" />
                <MetricCard label="Awaiting payment" value={stats.pending_payment} icon="wallet" />
                <MetricCard label="Processing" value={stats.processing} icon="box" />
                <MetricCard label="Shipped" value={stats.shipped} icon="navigation" />
                <MetricCard label="Delivered" value={stats.delivered} icon="check" />
                <MetricCard
                    label="Revenue (paid)"
                    value={formatMoney(stats.revenue_paid)}
                    icon="card"
                />
            </div>

            <section className="panel glass orders-queue-panel">
                <PanelHeading
                    eyebrow={t('Order queue')}
                    title={t('All customer orders')}
                    action={
                        <ColumnVisibilityControl
                            columns={[
                                { key: 'order', label: 'Order', locked: true },
                                { key: 'customer', label: 'Customer', locked: true },
                                { key: 'items', label: 'Items' },
                                { key: 'total', label: 'Total', locked: true },
                                { key: 'payment', label: 'Payment' },
                                { key: 'fulfillment', label: 'Fulfillment' },
                            ]}
                            visible={visibleColumns}
                            onToggle={toggleColumn}
                        />
                    }
                />

                <div className="tab-bar">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key || 'all'}
                            type="button"
                            className={activeTab === tab.key ? 'active' : ''}
                            onClick={() => applyFilters({ tab: tab.key || undefined })}
                        >
                            {t(tab.label)}
                        </button>
                    ))}
                </div>

                <form className="filter-toolbar orders-filter-toolbar" onSubmit={handleSearch}>
                    <div className="search-box">
                        <Icon name="search" size={16} />
                        <input
                            placeholder={t('Search order #, name, email, phone...')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        value={filters.status ?? ''}
                        onChange={(e) => applyFilters({ status: e.target.value || undefined })}
                    >
                        <option value="">{t('All statuses')}</option>
                        {Object.entries(orderStatusLabels).map(([k, v]) => (
                            <option key={k} value={k}>
                                {t(v)}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filters.payment_status ?? ''}
                        onChange={(e) => applyFilters({ payment_status: e.target.value || undefined })}
                    >
                        <option value="">{t('All payments')}</option>
                        {Object.entries(paymentLabels).map(([k, v]) => (
                            <option key={k} value={k}>
                                {t(v)}
                            </option>
                        ))}
                    </select>
                    <button type="submit" className="btn primary">
                        {t('Search')}
                    </button>
                </form>

                {(filters.q || filters.status || filters.payment_status || filters.tab) && (
                    <button
                        type="button"
                        className="text-btn"
                        style={{ marginBottom: 10 }}
                        onClick={() => router.get(routeWithBase('/admin/orders', app_base))}
                    >
                        {t('Reset filters')}
                    </button>
                )}

                {!canManageOrders && (
                    <p style={{ marginBottom: 10 }}>
                        {t('View only - contact a manager to confirm payments or update fulfillment.')}
                    </p>
                )}

                <div className="table-wrap">
                    <table className="orders-table">
                        <thead>
                            <tr>
                                <th>{t('Order')}</th>
                                <th>{t('Customer')}</th>
                                {visibleColumns.items !== false && <th className="numeric-cell">{t('Items')}</th>}
                                <th className="numeric-cell">{t('Total')}</th>
                                {visibleColumns.payment !== false && <th>{t('Payment')}</th>}
                                {visibleColumns.fulfillment !== false && <th>{t('Fulfillment')}</th>}
                                <th className="table-actions-column" />
                            </tr>
                        </thead>
                        <tbody>
                            {orders.data.length === 0 ? (
                                <tr>
                                    <td colSpan={4 + Object.values(visibleColumns).filter(Boolean).length}>
                                        <span className="muted">{t('No orders match your filters.')}</span>
                                    </td>
                                </tr>
                            ) : (
                                orders.data.map((order) => (
                                    <tr
                                        key={order.id}
                                        className="clickable"
                                        tabIndex={0}
                                        onClick={(event) => {
                                            if (event.target.closest('a, button, input, select')) return;
                                            router.visit(routeWithBase(`/admin/orders/${order.id}`, app_base));
                                        }}
                                        onKeyDown={(event) => event.key === 'Enter' && router.visit(routeWithBase(`/admin/orders/${order.id}`, app_base))}
                                    >
                                        <td>
                                            <strong>{order.order_number}</strong>
                                            <small title={order.created_at}>{formatOrderDate(order.created_at)}</small>
                                        </td>
                                        <td>
                                            <strong>{order.user?.name}</strong>
                                            <small>{order.user?.phone || order.user?.email}</small>
                                        </td>
                                        {visibleColumns.items !== false && <td className="numeric-cell">{order.items_count ?? order.items?.length ?? 0}</td>}
                                        <td className="money-cell">
                                            <strong>{formatMoney(order.final_amount)}</strong>
                                        </td>
                                        {visibleColumns.payment !== false && <td>
                                            <StatusBadge
                                                status={order.payment_status}
                                                label={t(paymentLabels[order.payment_status] || order.payment_status)}
                                            />
                                        </td>}
                                        {visibleColumns.fulfillment !== false && <td>
                                            <StatusBadge
                                                status={order.status}
                                                label={t(orderStatusLabels[order.status] || order.status)}
                                            />
                                        </td>}
                                        <td className="table-actions-column">
                                            <Link
                                                href={routeWithBase(`/admin/orders/${order.id}`, app_base)}
                                                className="icon-btn small"
                                                aria-label={
                                                    order.payment_status === 'pending_review' && canReviewPayments
                                                        ? `${t('Review order')} ${order.order_number}`
                                                        : `${t('Open order')} ${order.order_number}`
                                                }
                                                title={order.payment_status === 'pending_review' && canReviewPayments ? t('Review order') : t('Open order')}
                                            >
                                                <Icon name="external" size={13} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <AdminPagination paginator={orders} label={t('orders')} />
            </section>
        </AdminLayout>
    );
}
