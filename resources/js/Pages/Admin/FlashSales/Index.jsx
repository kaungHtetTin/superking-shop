import { useState } from 'react';
import { Head, Link, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

const statusTone = {
    live: 'success',
    scheduled: 'info',
    ended: 'neutral',
    inactive: 'danger',
};

const statusLabels = {
    live: 'Live',
    scheduled: 'Scheduled',
    ended: 'Ended',
    inactive: 'Inactive',
};

const formatDateTime = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export default function FlashSalesIndex({ flashSales, filters }) {
    const { app_base, flash } = usePage().props;
    const t = usePhraseTranslation();
    const [search, setSearch] = useState(filters.q ?? '');

    const applyFilters = (patch) => {
        router.get(
            routeWithBase('/admin/flash-sales', app_base),
            { ...filters, ...patch },
            { preserveState: true, replace: true },
        );
    };

    const handleSearch = (e) => {
        e.preventDefault();
        applyFilters({ q: search.trim() || undefined });
    };

    const remove = (sale) => {
        const unitsSold = sale.items.reduce((sum, item) => sum + Number(item.sold_count || 0), 0);
        const prompt = unitsSold > 0
            ? t('Deactivate flash sale ":name"? Sales history will be preserved.', { name: sale.name })
            : t('Delete flash sale ":name"?', { name: sale.name });
        if (!confirm(prompt)) return;

        router.delete(routeWithBase(`/admin/flash-sales/${sale.id}`, app_base), {
            preserveScroll: true,
            refreshRedirected: false,
        });
    };

    return (
        <AdminLayout
            title={t('Flash sales')}
            eyebrow={t('Marketing')}
            action={
                <Link className="btn primary" href={routeWithBase('/admin/flash-sales/create', app_base)}>
                    <Icon name="plus" size={14} />
                    {t('New flash sale')}
                </Link>
            }
        >
            <Head title={t('Flash Sales')} />
            <AdminFlash flash={flash} />

            <section className="panel glass">
                <PanelHeading eyebrow={t('Limited-time offers')} title={t('Campaigns')} />

                <form className="filter-toolbar compact flash-sales-filter" onSubmit={handleSearch}>
                    <div className="search-box">
                        <Icon name="search" size={16} />
                        <input
                            placeholder={t('Search flash sales...')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select value={filters.status || ''} onChange={(e) => applyFilters({ status: e.target.value || undefined })}>
                        <option value="">{t('All statuses')}</option>
                        <option value="live">{t('Live')}</option>
                        <option value="scheduled">{t('Scheduled')}</option>
                        <option value="ended">{t('Ended')}</option>
                        <option value="inactive">{t('Inactive')}</option>
                    </select>
                    <button type="submit" className="btn primary">{t('Search')}</button>
                </form>

                {(filters.q || filters.status) && (
                    <button
                        type="button"
                        className="text-btn"
                        style={{ marginBottom: 10 }}
                        onClick={() => router.get(routeWithBase('/admin/flash-sales', app_base))}
                    >
                        {t('Reset filters')}
                    </button>
                )}

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('Campaign')}</th>
                                <th>{t('Window')}</th>
                                <th>{t('Items')}</th>
                                <th>{t('Status')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {flashSales.data.length === 0 ? (
                                <tr><td colSpan={5}><span className="muted">{t('No flash sales found.')}</span></td></tr>
                            ) : flashSales.data.map((sale) => (
                                <tr key={sale.id}>
                                    <td>
                                        <Link className="table-primary-link" href={routeWithBase(`/admin/flash-sales/${sale.id}`, app_base)}>
                                            {sale.name}
                                        </Link>
                                        <small className="muted" style={{ display: 'block' }}>
                                            {sale.items.slice(0, 2).map((item) => item.unit?.product?.name).filter(Boolean).join(', ')}
                                            {sale.items.length > 2 ? ` ${t('+:count more', { count: sale.items.length - 2 })}` : ''}
                                        </small>
                                    </td>
                                    <td>
                                        <small>
                                            {formatDateTime(sale.starts_at)}
                                            <br />
                                            {formatDateTime(sale.ends_at)}
                                        </small>
                                    </td>
                                    <td>
                                        {sale.items_count}
                                        <small className="muted" style={{ display: 'block' }}>
                                            {t('Sold :count', { count: sale.items.reduce((sum, item) => sum + Number(item.sold_count || 0), 0) })}
                                        </small>
                                    </td>
                                    <td>
                                        <StatusBadge status={statusTone[sale.status] || 'neutral'} label={t(statusLabels[sale.status] || sale.status)} />
                                    </td>
                                    <td>
                                        <div className="inline-actions">
                                            <Link
                                                className="icon-btn small"
                                                href={routeWithBase(`/admin/flash-sales/${sale.id}`, app_base)}
                                                aria-label={t('View flash sale')}
                                            >
                                                <Icon name="eye" size={13} />
                                            </Link>
                                            <Link
                                                className="icon-btn small"
                                                href={routeWithBase(`/admin/flash-sales/${sale.id}/edit`, app_base)}
                                                aria-label={t('Edit flash sale')}
                                            >
                                                <Icon name="edit" size={13} />
                                            </Link>
                                            <button type="button" className="icon-btn small danger" onClick={() => remove(sale)} aria-label={t('Delete flash sale')}>
                                                <Icon name="trash" size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={flashSales} label={t('campaigns')} />
            </section>
        </AdminLayout>
    );
}
