import { useState } from 'react';
import { Head, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function ReviewsIndex({ reviews, filters }) {
    const { app_base, flash } = usePage().props;
    const t = usePhraseTranslation();
    const [search, setSearch] = useState(filters.q ?? '');
    const applyFilters = (patch) => router.get(routeWithBase('/admin/reviews', app_base), { ...filters, ...patch }, { preserveState: true, replace: true });
    const hasActiveFilters = Boolean(filters.q || filters.status);

    const handleSearch = (e) => {
        e.preventDefault();
        applyFilters({ q: search.trim() || undefined });
    };

    const moderate = (review, isApproved) => {
        router.patch(routeWithBase(`/admin/reviews/${review.id}`, app_base), { is_approved: isApproved }, { preserveScroll: true });
    };

    const remove = (review) => {
        if (!confirm(t('Delete this review?'))) return;
        router.delete(routeWithBase(`/admin/reviews/${review.id}`, app_base), { preserveScroll: true });
    };

    return (
        <AdminLayout title={t('Reviews')} eyebrow={t('Moderation')}>
            <Head title={t('Review Moderation')} />
            <AdminFlash flash={flash} />
            <section className="panel glass">
                <PanelHeading eyebrow={t('Product feedback')} title={t('Customer reviews')} />
                <form className="filter-toolbar customer-filter" onSubmit={handleSearch}>
                    <div className="search-box">
                        <Icon name="search" size={16} />
                        <input
                            placeholder={t('Search review, product, customer...')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select value={filters.status || ''} onChange={(e) => applyFilters({ status: e.target.value || undefined })}>
                        <option value="">{t('All statuses')}</option>
                        <option value="approved">{t('Approved')}</option>
                        <option value="hidden">{t('Hidden')}</option>
                    </select>
                    <button type="submit" className="btn primary">{t('Search')}</button>
                </form>

                {hasActiveFilters && (
                    <button
                        type="button"
                        className="text-btn"
                        style={{ marginBottom: 10 }}
                        onClick={() => {
                            setSearch('');
                            router.get(routeWithBase('/admin/reviews', app_base));
                        }}
                    >
                        {t('Reset filters')}
                    </button>
                )}

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('Review')}</th>
                                <th>{t('Product')}</th>
                                <th>{t('Customer')}</th>
                                <th>{t('Status')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {reviews.data.length === 0 ? (
                                <tr><td colSpan={5}><span className="muted">{t('No reviews found.')}</span></td></tr>
                            ) : reviews.data.map((review) => (
                                <tr key={review.id}>
                                    <td>
                                        <strong>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</strong>
                                        <small style={{ display: 'block', maxWidth: 380 }}>{review.comment || t('No comment')}</small>
                                    </td>
                                    <td>{review.product?.name}</td>
                                    <td><small>{review.user?.name}<br />{review.user?.email}</small></td>
                                    <td><StatusBadge status={review.is_approved ? 'success' : 'neutral'} label={review.is_approved ? t('Approved') : t('Hidden')} /></td>
                                    <td>
                                        <div className="inline-actions">
                                            <button type="button" className="icon-btn small" onClick={() => moderate(review, !review.is_approved)} aria-label={t('Toggle review status')}>
                                                <Icon name={review.is_approved ? 'lock' : 'check'} size={13} />
                                            </button>
                                            <button type="button" className="icon-btn small danger" onClick={() => remove(review)} aria-label={t('Delete review')}>
                                                <Icon name="trash" size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={reviews} label={t('reviews')} />
            </section>
        </AdminLayout>
    );
}
