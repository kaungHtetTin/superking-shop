import { useState } from 'react';
import { Head, Link, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

export default function CustomersIndex({ customers, filters, tiers }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const [search, setSearch] = useState(filters.q ?? '');
    const applyFilters = (patch) => router.get(routeWithBase('/admin/customers', app_base), { ...filters, ...patch }, { preserveState: true, replace: true });
    const hasActiveFilters = Boolean(filters.q || filters.tier);
    const dateOnly = (value) => value ? String(value).split('T')[0] : '';
    const handleSearch = (e) => {
        e.preventDefault();
        applyFilters({ q: search.trim() || undefined });
    };

    return (
        <AdminLayout title={t('Customers')} eyebrow={t('Shopper management')}>
            <Head title={t('Customers')} />
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
                                <th>{t('Joined')}</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.data.length === 0 ? (
                                <tr><td colSpan={7}><span className="muted">{t('No customers found.')}</span></td></tr>
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
