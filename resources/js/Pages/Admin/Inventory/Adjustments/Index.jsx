import { useEffect, useState } from 'react';
import { Head, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import AdminPagination from '@/Components/Admin/AdminPagination';
import Icon from '@/Components/Admin/icons';
import { FilterVisibilityControl, PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { usePhraseTranslation } from '@/Utils/i18n';
import { routeWithBase } from '@/Utils/url';
import { formatCompoundQuantity, formatSelectedUnitQuantity } from '@/Utils/unitLabel';

export default function AdjustmentsIndex({ adjustments, locations = [], reasons = [], statuses = [], filters = {}, canUndo = false }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [undoTarget, setUndoTarget] = useState(null);
    const [undoExplanation, setUndoExplanation] = useState('');
    const [undoErrors, setUndoErrors] = useState({});
    const [filterState, setFilterState] = useState({ q: filters.q || '', location_id: filters.location_id || '', reason_code: filters.reason_code || '', status: filters.status || '', from: filters.from || '', to: filters.to || '' });
    const [visibleFilters, setVisibleFilters] = useState({ q: true, location_id: true, reason_code: true, status: Boolean(filters.status), from: Boolean(filters.from), to: Boolean(filters.to) });
    const activeFilterCount = Object.values(filterState).filter(Boolean).length;
    const rows = adjustments.data.flatMap((adjustment) =>
        adjustment.items.map((item) => ({
            adjustment,
            item,
        }))
    );
    const originalStock = Number(undoTarget?.item?.system_quantity || 0);

    const submitFilters = (event) => {
        event.preventDefault();
        setFilterDrawerOpen(false);
        router.get(routeWithBase('/admin/inventory/adjustments', app_base), { ...filterState, q: filterState.q.trim() || undefined }, { preserveState: true, preserveScroll: true, replace: true });
    };
    const resetFilters = () => {
        const empty = { q: '', location_id: '', reason_code: '', status: '', from: '', to: '' };
        setFilterState(empty);
        setFilterDrawerOpen(false);
        router.get(routeWithBase('/admin/inventory/adjustments', app_base), {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    const openUndo = (adjustment, item) => {
        setUndoTarget({ adjustment, item });
        setUndoExplanation('');
        setUndoErrors({});
    };

    const submitUndo = (event) => {
        event.preventDefault();
        if (!undoTarget) return;
        router.post(routeWithBase(`/admin/inventory/adjustments/${undoTarget.adjustment.id}/undo`, app_base), {
            item_id: undoTarget.item.id, explanation: undoExplanation,
        }, {
            onSuccess: () => { setUndoTarget(null); setUndoErrors({}); },
            onError: (errors) => setUndoErrors(errors),
        });
    };

    useEffect(() => {
        if (!filterDrawerOpen && !undoTarget) return undefined;
        const closeOnEscape = (event) => {
            if (event.key !== 'Escape') return;
            setFilterDrawerOpen(false);
            setUndoTarget(null);
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [filterDrawerOpen, undoTarget]);

    const renderFilterFields = (autoFocus = false, onlyVisible = false) => {
        const show = (key) => !onlyVisible || visibleFilters[key] !== false;
        return <>
            {show('q') && <label className="form-field finance-report-filter__search"><span>{t('Search')}</span><span className="search-box"><Icon name="search" size={15} /><input autoFocus={autoFocus} type="search" value={filterState.q} onChange={(event) => setFilterState((current) => ({ ...current, q: event.target.value }))} placeholder={t('Adjustment, product or code')} /></span></label>}
            {show('location_id') && <label className="form-field finance-report-filter__store"><span>{t('Warehouse')}</span><select value={filterState.location_id} onChange={(event) => setFilterState((current) => ({ ...current, location_id: event.target.value }))}><option value="">{t('All warehouses')}</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>}
            {show('reason_code') && <label className="form-field finance-report-filter__select"><span>{t('Reason')}</span><select value={filterState.reason_code} onChange={(event) => setFilterState((current) => ({ ...current, reason_code: event.target.value }))}><option value="">{t('All reasons')}</option>{reasons.map((reason) => <option key={reason.value} value={reason.value}>{t(reason.label)}</option>)}</select></label>}
            {show('status') && <label className="form-field finance-report-filter__select"><span>{t('Status')}</span><select value={filterState.status} onChange={(event) => setFilterState((current) => ({ ...current, status: event.target.value }))}><option value="">{t('All statuses')}</option>{statuses.map((status) => <option key={status} value={status}>{t(status)}</option>)}</select></label>}
            {show('from') && <label className="form-field finance-report-filter__date"><span>{t('From')}</span><input type="date" value={filterState.from} onChange={(event) => setFilterState((current) => ({ ...current, from: event.target.value }))} /></label>}
            {show('to') && <label className="form-field finance-report-filter__date"><span>{t('To')}</span><input type="date" value={filterState.to} onChange={(event) => setFilterState((current) => ({ ...current, to: event.target.value }))} /></label>}
        </>;
    };

    return (
        <AdminLayout title={t('Adjustments')} eyebrow={t('Inventory')}>
            <Head title={t('Stock Adjustments')} />
            <section className="panel glass finance-filter-panel adjustments-filter-panel">
                <PanelHeading eyebrow={t('Counts & corrections')} title={t('Stock adjustment records')} action={<div className="inline-actions filter-heading-actions"><button type="button" className="btn secondary finance-report-filter__mobile-trigger" onClick={() => setFilterDrawerOpen(true)}><Icon name="filterList" size={15} />{t('Filter')}{activeFilterCount > 0 && <span className="finance-report-filter__count">{activeFilterCount}</span>}</button><FilterVisibilityControl filters={[{ key: 'q', label: 'Search' }, { key: 'location_id', label: 'Warehouse' }, { key: 'reason_code', label: 'Reason' }, { key: 'status', label: 'Status' }, { key: 'from', label: 'From date' }, { key: 'to', label: 'To date' }]} visible={visibleFilters} onToggle={(key) => setVisibleFilters((current) => ({ ...current, [key]: current[key] === false }))} activeCount={activeFilterCount} /></div>} />
                <form className="finance-report-filter" onSubmit={submitFilters} aria-label={t('Filter adjustments')}>
                    <div className="finance-report-filter__scroll"><div className="finance-report-filter__fields">{renderFilterFields(false, true)}</div></div>
                    <div className="inline-actions finance-report-filter__actions"><button type="submit" className="btn primary"><Icon name="search" size={14} />{t('Apply')}</button>{activeFilterCount > 0 && <button type="button" className="btn secondary" onClick={resetFilters}>{t('Reset')}</button>}</div>
                </form>
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('Adjustment')}</th>
                                <th>{t('Warehouse')}</th>
                                <th>{t('Product / unit')}</th>
                                <th>{t('Before')}</th>
                                <th>{t('After')}</th>
                                <th>{t('Variance')}</th>
                                <th>{t('Reason')}</th>
                                <th>{t('Status')}</th>
                                {canUndo && <th className="adjustments-correction__table-action">{t('Undo')}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={canUndo ? 9 : 8} className="empty-table-cell">{t('No adjustments yet.')}</td>
                                </tr>
                            ) : rows.map(({ adjustment, item }) => (
                                <tr key={`${adjustment.id}-${item.id}`}>
                                    <td>
                                        <strong>{adjustment.adjustment_number}</strong>
                                        <small className="table-subline">{new Date(adjustment.created_at).toLocaleString()}</small>
                                        {canUndo && adjustment.status === 'posted' && !adjustment.reversal_of_id && adjustment.items.length === 1 && <button type="button" className="btn secondary adjustments-correction__mobile-trigger" onClick={() => openUndo(adjustment, item)}>{t('Undo')}</button>}
                                    </td>
                                    <td>{adjustment.location.name}</td>
                                    <td>
                                        <strong>{item.product.name}</strong>
                                        <small className="table-subline">{item.product.product_code} · {item.unit?.name} ({item.unit?.code})</small>
                                    </td>
                                    <td>{formatCompoundQuantity(item.system_quantity, item.product.units)}</td>
                                    <td>{formatSelectedUnitQuantity(item.counted_quantity, item.unit, item.product.units)}</td>
                                    <td className={item.quantity_delta < 0 ? 'quantity-negative' : item.quantity_delta > 0 ? 'quantity-positive' : ''}>
                                        {formatCompoundQuantity(item.quantity_delta, item.product.units, { signed: true })}
                                    </td>
                                    <td>
                                        {t(reasons.find((reason) => reason.value === adjustment.reason_code)?.label || adjustment.reason_code.replaceAll('_', ' '))}
                                        <small className="table-subline">{t(adjustment.status === 'reversed'
                                            ? 'Undone · finance effect voided'
                                            : adjustment.reversal_of_id
                                                ? 'Undo movement · no finance entry'
                                                : adjustment.reason_code === 'data_correction'
                                                    ? 'Quantity correction · no finance entry'
                                                    : item.value_delta == null
                                                        ? 'Cost not recorded'
                                                        : Number(item.value_delta) < 0
                                                            ? 'Inventory loss expense · noncash'
                                                            : Number(item.value_delta) > 0
                                                                ? 'Inventory asset increase · noncash'
                                                                : 'No monetary change')}</small>
                                    </td>
                                    <td><StatusBadge status={adjustment.status} label={t(adjustment.status)} /></td>
                                    {canUndo && <td className="adjustments-correction__table-action">{adjustment.status === 'posted' && !adjustment.reversal_of_id && adjustment.items.length === 1 && <button type="button" className="btn secondary" onClick={() => openUndo(adjustment, item)}>{t('Undo')}</button>}</td>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={adjustments} label={t('adjustments')} queryParams={filterState} preserveState />
            </section>
            {filterDrawerOpen && <div className="modal-backdrop finance-report-filter__backdrop" onMouseDown={() => setFilterDrawerOpen(false)}><form className="drawer glass finance-report-filter__drawer" onSubmit={submitFilters} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="adjustments-filter-title"><div className="drawer-header"><div><small className="eyebrow">{t('Counts & corrections')}</small><h2 id="adjustments-filter-title">{t('Filter adjustments')}</h2></div><button type="button" className="icon-btn" onClick={() => setFilterDrawerOpen(false)} aria-label={t('Close')}><Icon name="close" size={16} /></button></div><div className="finance-report-filter__drawer-body">{renderFilterFields(true)}</div><div className="drawer-actions"><button type="button" className="btn secondary" onClick={resetFilters}>{t('Reset')}</button><button type="submit" className="btn primary"><Icon name="search" size={14} />{t('Apply')}</button></div></form></div>}
            {undoTarget && (
                <div className="modal-backdrop finance-report-filter__backdrop adjustments-correction__backdrop" onMouseDown={() => setUndoTarget(null)}>
                    <form className="drawer glass finance-report-filter__drawer adjustments-correction__drawer" onSubmit={submitUndo} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="adjustment-undo-title">
                        <div className="drawer-header">
                            <div><small className="eyebrow">{undoTarget.adjustment.adjustment_number}</small><h2 id="adjustment-undo-title">{t('Undo adjustment')}</h2></div>
                            <button type="button" className="icon-btn" onClick={() => setUndoTarget(null)} aria-label={t('Close')}><Icon name="close" size={16} /></button>
                        </div>
                        <div className="finance-report-filter__drawer-body adjustments-correction__body">
                            <p className="adjustments-correction__hint">{t('The original record remains in history. Same-day Undo restores stock and voids its finance effect when no later product activity exists.')}</p>
                            <div className="adjustments-correction__summary">
                                <span><small>{t('Stock before original adjustment')}</small><strong>{originalStock.toLocaleString()} {t('base units')}</strong></span>
                                <span><small>{t('Stock after mistaken adjustment')}</small><strong>{Number(undoTarget.item.base_counted_quantity).toLocaleString()} {t('base units')}</strong></span>
                            </div>
                            <p className="adjustments-correction__impact" role="status"><b>{t('Stock after undo')}: {originalStock.toLocaleString()} {t('base units')}</b>{t('The original finance entry is voided. To record the correct damage or count, create a new adjustment from Inventory overview.')}</p>
                            <label className="form-field">
                                <span>{t('Reason for undo')}</span>
                                <textarea minLength={10} maxLength={2000} value={undoExplanation} onChange={(event) => setUndoExplanation(event.target.value)} required />
                            </label>
                            {Object.values(undoErrors).map((message, index) => <p key={index} className="text-danger" role="alert">{message}</p>)}
                        </div>
                        <div className="drawer-actions">
                            <button type="button" className="btn secondary" onClick={() => setUndoTarget(null)}>{t('Cancel')}</button>
                            <button type="submit" className="btn danger">{t('Undo adjustment')}</button>
                        </div>
                    </form>
                </div>
            )}
        </AdminLayout>
    );
}
