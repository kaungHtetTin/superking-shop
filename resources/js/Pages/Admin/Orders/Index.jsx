import { useEffect, useState } from 'react';
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

export default function OrdersIndex({ orders, stats, filters, locations = [], canReviewPayments, canManageOrders }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [filterState, setFilterState] = useState({
        q: filters.q ?? '',
        location_id: filters.location_id ?? '',
        status: filters.status ?? '',
        payment_status: filters.payment_status ?? '',
        from: filters.from ?? '',
        to: filters.to ?? '',
    });
    const [visibleColumns, setVisibleColumns] = useState({ items: true, payment: true, fulfillment: true });
    const activeTab = filters.tab ?? '';
    const activeFilterCount = Object.values(filterState).filter(Boolean).length;
    const toggleColumn = (key) => setVisibleColumns((current) => ({ ...current, [key]: current[key] === false }));
    const exportQuery = new URLSearchParams();
    Object.entries({ ...filterState, tab: activeTab }).forEach(([key, value]) => value !== null && value !== undefined && value !== '' && exportQuery.set(key, value));

    const applyFilters = (patch) => {
        router.get(routeWithBase('/admin/orders', app_base), { ...filters, ...patch }, { preserveState: true, replace: true });
    };

    useEffect(() => {
        if (!filterDrawerOpen) return undefined;
        const closeOnEscape = (event) => event.key === 'Escape' && setFilterDrawerOpen(false);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [filterDrawerOpen]);

    const submitFilters = (event) => {
        event.preventDefault();
        setFilterDrawerOpen(false);
        router.get(routeWithBase('/admin/orders', app_base), {
            ...filterState,
            q: filterState.q.trim() || undefined,
            tab: activeTab || undefined,
        }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const clearFilters = () => {
        const empty = { q: '', location_id: '', status: '', payment_status: '', from: '', to: '' };
        setFilterState(empty);
        setFilterDrawerOpen(false);
        router.get(routeWithBase('/admin/orders', app_base), {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    const renderFilterFields = (autoFocus = false) => (
        <>
            <label className="form-field orders-filter__search">
                <span>{t('Search orders')}</span>
                <div className="search-box">
                    <Icon name="search" size={16} />
                    <input
                        autoFocus={autoFocus}
                        type="search"
                        placeholder={t('Order #, name, email or phone')}
                        value={filterState.q}
                        onChange={(event) => setFilterState((current) => ({ ...current, q: event.target.value }))}
                    />
                </div>
            </label>
            <label className="form-field orders-filter__store">
                <span>{t('Store')}</span>
                <select value={filterState.location_id} onChange={(event) => setFilterState((current) => ({ ...current, location_id: event.target.value }))}>
                    <option value="">{t('All stores')}</option>
                    {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
            </label>
            <label className="form-field orders-filter__status">
                <span>{t('Status')}</span>
                <select value={filterState.status} onChange={(event) => setFilterState((current) => ({ ...current, status: event.target.value }))}>
                    <option value="">{t('All statuses')}</option>
                    {Object.entries(orderStatusLabels).map(([key, value]) => <option key={key} value={key}>{t(value)}</option>)}
                </select>
            </label>
            <label className="form-field orders-filter__payment">
                <span>{t('Payment')}</span>
                <select value={filterState.payment_status} onChange={(event) => setFilterState((current) => ({ ...current, payment_status: event.target.value }))}>
                    <option value="">{t('All payments')}</option>
                    {Object.entries(paymentLabels).map(([key, value]) => <option key={key} value={key}>{t(value)}</option>)}
                </select>
            </label>
            <label className="form-field orders-filter__date">
                <span>{t('From')}</span>
                <input type="date" value={filterState.from} onChange={(event) => setFilterState((current) => ({ ...current, from: event.target.value }))} />
            </label>
            <label className="form-field orders-filter__date">
                <span>{t('To')}</span>
                <input type="date" value={filterState.to} onChange={(event) => setFilterState((current) => ({ ...current, to: event.target.value }))} />
            </label>
        </>
    );

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
                        <div className="inline-actions orders-queue__heading-actions">
                            <button type="button" className="btn secondary orders-filter__mobile-trigger" onClick={() => setFilterDrawerOpen(true)}>
                                <Icon name="search" size={14} /> {t('Filter')}
                                {activeFilterCount > 0 && <span className="orders-filter__count">{activeFilterCount}</span>}
                            </button>
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
                        </div>
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

                <form className="orders-filter-toolbar" onSubmit={submitFilters} aria-label={t('Filter orders')}>
                    <div className="orders-filter__scroll">
                        <div className="orders-filter__fields">{renderFilterFields()}</div>
                    </div>
                    <div className="inline-actions orders-filter__actions">
                        <button type="submit" className="btn primary"><Icon name="search" size={14} /> {t('Search')}</button>
                        <a className="btn secondary" href={`${routeWithBase('/admin/orders-export.csv', app_base)}?${exportQuery.toString()}`}>
                            <Icon name="download" size={14} /> CSV
                        </a>
                    </div>
                </form>

                {(filters.q || filters.location_id || filters.status || filters.payment_status || filters.from || filters.to || filters.tab) && (
                    <button
                        type="button"
                        className="text-btn"
                        style={{ marginBottom: 10 }}
                        onClick={clearFilters}
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

            {filterDrawerOpen && (
                <div className="modal-backdrop orders-filter__backdrop" onMouseDown={() => setFilterDrawerOpen(false)}>
                    <form
                        className="drawer glass orders-filter__drawer"
                        onSubmit={submitFilters}
                        onMouseDown={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="orders-filter-title"
                    >
                        <div className="drawer-header">
                            <div>
                                <small className="eyebrow">{t('Order queue')}</small>
                                <h2 id="orders-filter-title">{t('Filter orders')}</h2>
                            </div>
                            <button type="button" className="icon-btn" onClick={() => setFilterDrawerOpen(false)} aria-label={t('Close')}>
                                <Icon name="close" size={16} />
                            </button>
                        </div>
                        <div className="orders-filter__drawer-body">
                            {renderFilterFields(true)}
                            <a className="btn secondary orders-filter__drawer-export" href={`${routeWithBase('/admin/orders-export.csv', app_base)}?${exportQuery.toString()}`}>
                                <Icon name="download" size={14} /> CSV
                            </a>
                        </div>
                        <div className="drawer-actions">
                            <button type="button" className="btn secondary" onClick={clearFilters}>{t('Clear')}</button>
                            <button type="submit" className="btn primary"><Icon name="search" size={14} /> {t('Search')}</button>
                        </div>
                    </form>
                </div>
            )}
        </AdminLayout>
    );
}
