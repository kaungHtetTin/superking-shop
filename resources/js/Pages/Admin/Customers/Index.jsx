import { useState } from 'react';
import { Head, Link, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

export default function CustomersIndex({ customers, filters, tiers, creditStats = {} }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const [search, setSearch] = useState(filters.q ?? '');
    const applyFilters = (patch) => router.get(routeWithBase('/admin/customers', app_base), { ...filters, ...patch }, { preserveState: true, replace: true });
    const hasActiveFilters = Boolean(filters.q || filters.tier || filters.credit_status || filters.credit);
    const dateOnly = (value) => value ? String(value).split('T')[0] : '';
    const handleSearch = (e) => {
        e.preventDefault();
        applyFilters({ q: search.trim() || undefined });
    };

    return (
        <AdminLayout title={t('Customers')} eyebrow={t('Shopper management')}>
            <Head title={t('Customers')} />
            <div className="metrics-grid four">
                <article className="metric-card glass"><small>{t('Credit outstanding')}</small><strong>{formatMoney(creditStats.outstanding)}</strong><p>{t('Total receivables')}</p></article>
                <article className="metric-card glass"><small>{t('Overdue credit')}</small><strong>{formatMoney(creditStats.overdue)}</strong><p>{t('Past due balance')}</p></article>
                <article className="metric-card glass"><small>{t('Active credit accounts')}</small><strong>{creditStats.active_accounts || 0}</strong><p>{t('Approved customers')}</p></article>
                <article className="metric-card glass"><small>{t('Suspended accounts')}</small><strong>{creditStats.suspended_accounts || 0}</strong><p>{t('Credit blocked')}</p></article>
            </div>
            <section className="panel glass">
                <PanelHeading eyebrow={t('Customer base')} title={t('Registered shoppers')} />
                <form className="filter-toolbar customer-filter" onSubmit={handleSearch}>
                    <div className="search-box">
                        <Icon name="search" size={16} />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search name, email, or phone...')} />
                    </div>
                    <select value={filters.tier || ''} onChange={(e) => applyFilters({ tier: e.target.value || undefined })}>
                        <option value="">{t('All tiers')}</option>
                        {tiers.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
                    </select>
                    <select value={filters.credit || ''} onChange={(e) => applyFilters({ credit: e.target.value || undefined })}>
                        <option value="">{t('All balances')}</option>
                        <option value="outstanding">{t('Outstanding credit')}</option>
                        <option value="overdue">{t('Overdue credit')}</option>
                    </select>
                    <select value={filters.credit_status || ''} onChange={(e) => applyFilters({ credit_status: e.target.value || undefined })}>
                        <option value="">{t('All credit statuses')}</option>
                        <option value="active">{t('Active')}</option>
                        <option value="suspended">{t('Suspended')}</option>
                        <option value="disabled">{t('Disabled')}</option>
                    </select>
                    <button type="submit" className="btn primary">
                        {t('Search')}
                    </button>
                </form>
                {hasActiveFilters && (
                    <button
                        type="button"
                        className="text-btn"
                        style={{ marginBottom: 10 }}
                        onClick={() => {
                            setSearch('');
                            router.get(routeWithBase('/admin/customers', app_base));
                        }}
                    >
                        {t('Reset filters')}
                    </button>
                )}
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('Customer')}</th>
                                <th>{t('Tier')}</th>
                                <th>{t('Points')}</th>
                                <th>{t('Orders')}</th>
                                <th>{t('Paid revenue')}</th>
                                <th>{t('Credit balance')}</th>
                                <th>{t('Joined')}</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.data.length === 0 ? (
                                <tr><td colSpan={8}><span className="muted">{t('No customers found.')}</span></td></tr>
                            ) : customers.data.map((customer) => (
                                <tr key={customer.id}>
                                    <td>
                                        <div className="rider-cell">
                                            <span>{customer.name.slice(0, 2).toUpperCase()}</span>
                                            <div>
                                                <strong>{customer.name}</strong>
                                                <small>{customer.email}{customer.phone ? ` - ${customer.phone}` : ''}</small>
                                            </div>
                                        </div>
                                    </td>
                                    <td><StatusBadge status="info" label={customer.tier || t('Bronze')} /></td>
                                    <td>{customer.loyalty_points}</td>
                                    <td>{customer.orders_count}</td>
                                    <td>{formatMoney(customer.paid_revenue)}</td>
                                    <td>
                                        <strong>{formatMoney(customer.credit_balance)}</strong>
                                        <small>{t(customer.credit_status || 'disabled')} · {t('Limit')} {formatMoney(customer.credit_limit)}</small>
                                    </td>
                                    <td><small>{dateOnly(customer.created_at)}</small></td>
                                    <td>
                                        <Link href={routeWithBase(`/admin/customers/${customer.id}`, app_base)} className="icon-btn small">
                                            <Icon name="external" size={13} />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={customers} label={t('customers')} />
            </section>
        </AdminLayout>
    );
}
