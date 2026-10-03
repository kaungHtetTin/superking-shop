import { useEffect, useRef, useState } from 'react';
import { Head, Link, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import AdminPagination from '@/Components/Admin/AdminPagination';
import Icon from '@/Components/Admin/icons';
import { FilterVisibilityControl, PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function ReceiptsIndex({ receipts, locations = [], statuses = [], filters = {} }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const [visibleReceipts, setVisibleReceipts] = useState(receipts);
    const [deletingId, setDeletingId] = useState(null);
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [filterState, setFilterState] = useState({ q: filters.q || '', location_id: filters.location_id || '', status: filters.status || '', from: filters.from || '', to: filters.to || '' });
    const [visibleFilters, setVisibleFilters] = useState({ q: true, location_id: true, status: true, from: Boolean(filters.from), to: Boolean(filters.to) });
    const deletedReceiptIds = useRef(new Set());
    const withoutReceipt = (paginator, receiptId) => {
        const data = paginator.data.filter((item) => Number(item.id) !== Number(receiptId));
        const removedCount = paginator.data.length - data.length;

        return {
            ...paginator,
            data,
            total: Math.max(0, Number(paginator.total || 0) - removedCount),
            from: data.length > 0 ? paginator.from : null,
            to: data.length > 0 ? Number(paginator.from || 1) + data.length - 1 : null,
        };
    };

    const withoutDeletedReceipts = (paginator) => (
        Array.from(deletedReceiptIds.current).reduce(
            (current, receiptId) => withoutReceipt(current, receiptId),
            paginator,
        )
    );

    useEffect(() => {
        setVisibleReceipts(withoutDeletedReceipts(receipts));
    }, [receipts]);

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

    const activeFilterCount = Object.values(filterState).filter(Boolean).length;
    const submitFilters = (event) => {
        event.preventDefault();
        setFilterDrawerOpen(false);
        router.get(routeWithBase('/admin/inventory/receipts', app_base), { ...filterState, q: filterState.q.trim() || undefined }, { preserveState: true, preserveScroll: true, replace: true });
    };
    const resetFilters = () => {
        const empty = { q: '', location_id: '', status: '', from: '', to: '' };
        setFilterState(empty);
        setFilterDrawerOpen(false);
        router.get(routeWithBase('/admin/inventory/receipts', app_base), {}, { preserveState: true, preserveScroll: true, replace: true });
    };
    const renderFilterFields = (autoFocus = false, onlyVisible = false) => {
        const show = (key) => !onlyVisible || visibleFilters[key] !== false;
        return <>
            {show('q') && <label className="form-field finance-report-filter__search"><span>{t('Search receipts')}</span><span className="search-box"><Icon name="search" size={15} /><input autoFocus={autoFocus} type="search" value={filterState.q} onChange={(event) => setFilterState((current) => ({ ...current, q: event.target.value }))} placeholder={t('Receipt, reference, product or code')} /></span></label>}
            {show('location_id') && <label className="form-field finance-report-filter__store"><span>{t('Warehouse')}</span><select value={filterState.location_id} onChange={(event) => setFilterState((current) => ({ ...current, location_id: event.target.value }))}><option value="">{t('All warehouses')}</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>}
            {show('status') && <label className="form-field finance-report-filter__select"><span>{t('Status')}</span><select value={filterState.status} onChange={(event) => setFilterState((current) => ({ ...current, status: event.target.value }))}><option value="">{t('All statuses')}</option>{statuses.map((status) => <option key={status} value={status}>{t(status)}</option>)}</select></label>}
            {show('from') && <label className="form-field finance-report-filter__date"><span>{t('From')}</span><input type="date" value={filterState.from} onChange={(event) => setFilterState((current) => ({ ...current, from: event.target.value }))} /></label>}
            {show('to') && <label className="form-field finance-report-filter__date"><span>{t('To')}</span><input type="date" value={filterState.to} onChange={(event) => setFilterState((current) => ({ ...current, to: event.target.value }))} /></label>}
        </>;
    };

    const destroy = (receipt) => {
        if (!confirm(t('Delete :number? This will reduce stock quantities and delete the financial ledger entry.', { number: receipt.receipt_number }))) return;

        const previousReceipts = visibleReceipts;
        deletedReceiptIds.current.add(Number(receipt.id));
        setDeletingId(receipt.id);
        setVisibleReceipts((current) => withoutReceipt(current, receipt.id));

        router.delete(
            routeWithBase(`/admin/inventory/receipts/${receipt.id}`, app_base),
            {},
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    if (page?.props?.receipts) {
                        setVisibleReceipts(withoutDeletedReceipts(page.props.receipts));
                    }
                },
                onError: () => {
                    deletedReceiptIds.current.delete(Number(receipt.id));
                    setVisibleReceipts(previousReceipts);
                },
                onFinish: () => setDeletingId(null),
            },
        );
    };

    return (
        <AdminLayout
            title={t('Receiving')}
            eyebrow={t('Inventory')}
            action={<Link className="btn primary" href={routeWithBase('/admin/inventory/receipts/create', app_base)}><Icon name="plus" size={14} /> {t('New receipt')}</Link>}
        >
            <Head title={t('Stock Receipts')} />
            <section className="panel glass finance-filter-panel">
                <PanelHeading eyebrow={t('Inbound stock')} title={t('Stock receipts')} action={<div className="inline-actions filter-heading-actions"><button type="button" className="btn secondary finance-report-filter__mobile-trigger" onClick={() => setFilterDrawerOpen(true)}><Icon name="filterList" size={15} />{t('Filter')}{activeFilterCount > 0 && <span className="finance-report-filter__count">{activeFilterCount}</span>}</button><FilterVisibilityControl filters={[{ key: 'q', label: 'Search receipts' }, { key: 'location_id', label: 'Warehouse' }, { key: 'status', label: 'Status' }, { key: 'from', label: 'From date' }, { key: 'to', label: 'To date' }]} visible={visibleFilters} onToggle={(key) => setVisibleFilters((current) => ({ ...current, [key]: current[key] === false }))} activeCount={activeFilterCount} /></div>} />
                <form className="finance-report-filter" onSubmit={submitFilters} aria-label={t('Filter receipts')}><div className="finance-report-filter__scroll"><div className="finance-report-filter__fields">{renderFilterFields(false, true)}</div></div><div className="inline-actions finance-report-filter__actions"><button type="submit" className="btn primary"><Icon name="search" size={14} />{t('Search')}</button>{activeFilterCount > 0 && <button type="button" className="btn secondary" onClick={resetFilters}>{t('Reset')}</button>}</div></form>
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('Receipt')}</th>
                                <th>{t('Warehouse')}</th>
                                <th>{t('Reference')}</th>
                                <th>{t('Lines')}</th>
                                <th>{t('Status')}</th>
                                <th>{t('Date')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {visibleReceipts.data.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="empty-table-cell">{t('No receipts yet.')}</td>
                                </tr>
                            ) : visibleReceipts.data.map((receipt) => (
                                <tr key={receipt.id}>
                                    <td>
                                        <Link className="table-primary-link" href={routeWithBase(`/admin/inventory/receipts/${receipt.id}`, app_base)}>
                                            {receipt.receipt_number}
                                        </Link>
                                    </td>
                                    <td>{receipt.location.name}<small className="table-subline">{receipt.location.code}</small></td>
                                    <td>{receipt.supplier_reference || '-'}</td>
                                    <td>{receipt.items.length}</td>
                                    <td><StatusBadge status={receipt.status === 'posted' ? 'success' : 'warning'} label={t(receipt.status)} /></td>
                                    <td>{new Date(receipt.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <div className="inline-actions">
                                            <Link
                                                className="icon-btn small"
                                                href={routeWithBase(`/admin/inventory/receipts/${receipt.id}`, app_base)}
                                                aria-label={t('View receipt')}
                                            >
                                                <Icon name="eye" size={13} />
                                            </Link>
                                            {receipt.status === 'draft' && (
                                                <Link className="icon-btn small" href={routeWithBase(`/admin/inventory/receipts/${receipt.id}/edit`, app_base)} aria-label={t('Edit receipt')}>
                                                    <Icon name="edit" size={13} />
                                                </Link>
                                            )}
                                            <button
                                                type="button"
                                                className="icon-btn small danger"
                                                onClick={() => destroy(receipt)}
                                                aria-label={t('Delete receipt')}
                                                disabled={deletingId !== null}
                                            >
                                                <Icon name="trash" size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={visibleReceipts} label={t('receipts')} queryParams={filterState} preserveState />
            </section>
            {filterDrawerOpen && <div className="modal-backdrop finance-report-filter__backdrop" onMouseDown={() => setFilterDrawerOpen(false)}><form className="drawer glass finance-report-filter__drawer" onSubmit={submitFilters} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="receipts-filter-title"><div className="drawer-header"><div><small className="eyebrow">{t('Inbound stock')}</small><h2 id="receipts-filter-title">{t('Filter receipts')}</h2></div><button type="button" className="icon-btn" onClick={() => setFilterDrawerOpen(false)} aria-label={t('Close')}><Icon name="close" size={16} /></button></div><div className="finance-report-filter__drawer-body">{renderFilterFields(true)}</div><div className="drawer-actions"><button type="button" className="btn secondary" onClick={resetFilters}>{t('Reset')}</button><button type="submit" className="btn primary"><Icon name="search" size={14} />{t('Search')}</button></div></form></div>}
        </AdminLayout>
    );
}
