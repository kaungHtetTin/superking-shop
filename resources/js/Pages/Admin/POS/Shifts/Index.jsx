import { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import { Head, Link, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import AdminPagination from '@/Components/Admin/AdminPagination';
import Icon from '@/Components/Admin/icons';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(date);
};

const money = (value) => formatMoney(Number(value || 0));

function SummaryCard({ label, value, tone = 'primary', caption, icon }) {
    return (
        <div className={`metric-card glass shift-history__metric tone-${tone}`}>
            <span className="icon-well"><Icon name={icon} size={14} /></span>
            <small>{label}</small>
            <strong>{value}</strong>
            {caption && <p>{caption}</p>}
        </div>
    );
}

function MoneyItem({ label, value, emphasize = false, color = 'text.primary' }) {
    return (
        <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: 'action.hover' }}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography fontWeight={emphasize ? 850 : 700} color={color}>{money(value)}</Typography>
        </Box>
    );
}

export default function ShiftHistory({ shifts, locations = [], filters = {}, stats = {}, canViewAllCashiers = false }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const [selectedShift, setSelectedShift] = useState(null);
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [filterState, setFilterState] = useState({
        q: filters.q || '',
        status: filters.status || '',
        location_id: filters.location_id || '',
        from: filters.from || '',
        to: filters.to || '',
    });

    const rows = shifts?.data || [];
    const selectedSummary = useMemo(() => selectedShift?.calculated_summary || selectedShift || {}, [selectedShift]);
    const activeFilterCount = Object.values(filterState).filter(Boolean).length;

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

    const navigate = (next = filterState) => {
        router.get(routeWithBase('/admin/pos/shifts', app_base), next, { preserveState: true, preserveScroll: true });
    };

    const submitFilters = (event) => {
        event.preventDefault();
        setFilterDrawerOpen(false);
        navigate(filterState);
    };

    const clearFilters = () => {
        const empty = { q: '', status: '', location_id: '', from: '', to: '' };
        setFilterState(empty);
        setFilterDrawerOpen(false);
        navigate(empty);
    };

    const renderFilterFields = (autoFocus = false) => (
        <>
            <label className="form-field shift-history__filter-search">
                <span>{canViewAllCashiers ? t('Search cashier or register') : t('Search register')}</span>
                <input autoFocus={autoFocus} type="search" value={filterState.q} onChange={(event) => setFilterState((current) => ({ ...current, q: event.target.value }))} placeholder={t('Name, email or register code')} />
            </label>
            <label className="form-field shift-history__filter-status">
                <span>{t('Status')}</span>
                <select value={filterState.status} onChange={(event) => setFilterState((current) => ({ ...current, status: event.target.value }))}>
                    <option value="">{t('All statuses')}</option>
                    <option value="open">{t('Open')}</option>
                    <option value="closed">{t('Closed')}</option>
                </select>
            </label>
            <label className="form-field shift-history__filter-warehouse">
                <span>{t('Warehouse')}</span>
                <select value={filterState.location_id} onChange={(event) => setFilterState((current) => ({ ...current, location_id: event.target.value }))}>
                    <option value="">{t('All warehouses')}</option>
                    {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
            </label>
            <label className="form-field shift-history__filter-date">
                <span>{t('From')}</span>
                <input type="date" value={filterState.from} onChange={(event) => setFilterState((current) => ({ ...current, from: event.target.value }))} />
            </label>
            <label className="form-field shift-history__filter-date">
                <span>{t('To')}</span>
                <input type="date" value={filterState.to} onChange={(event) => setFilterState((current) => ({ ...current, to: event.target.value }))} />
            </label>
        </>
    );

    return (
        <AdminLayout
            title={t('Shift history')}
            eyebrow={t('POS')}
            action={<Link className="btn secondary" href={routeWithBase('/admin/pos', app_base)}><Icon name="arrowLeft" size={14} /> {t('Back to POS')}</Link>}
        >
            <Head title={t('Shift history')} />

            <div className="shift-history-page">
            <div className="metrics-grid four shift-history__metrics">
                <SummaryCard label={t('Total shifts')} value={stats.total || 0} caption={t('Matching filters')} icon="history" />
                <SummaryCard label={t('Open now')} value={stats.open || 0} tone="warning" caption={t('Active cash sessions')} icon="rotateClockwise" />
                <SummaryCard label={t('Closed')} value={stats.closed || 0} tone="success" caption={t('Completed sessions')} icon="check" />
                <SummaryCard
                    label={t('Net difference')}
                    value={money(stats.variance)}
                    tone={Number(stats.variance || 0) < 0 ? 'error' : 'success'}
                    caption={Number(stats.variance || 0) < 0 ? t('Overall shortage') : t('Overall overage')}
                    icon="wallet"
                />
            </div>

            <section className="panel glass shift-history__filter-panel">
                <PanelHeading
                    eyebrow={t('History controls')}
                    title={t('Filter shifts')}
                    action={(
                        <button type="button" className="btn secondary shift-history__mobile-filter-trigger" onClick={() => setFilterDrawerOpen(true)}>
                            <Icon name="search" size={14} /> {t('Filter')}
                            {activeFilterCount > 0 && <span className="shift-history__filter-count">{activeFilterCount}</span>}
                        </button>
                    )}
                />
                <form className="shift-history__filter-toolbar" onSubmit={submitFilters} aria-label={t('Filter shifts')}>
                    <div className="shift-history__filter-scroll">
                        <div className="shift-history__filter-fields">{renderFilterFields()}</div>
                    </div>
                    <div className="inline-actions shift-history__filter-actions">
                        <button type="submit" className="btn primary"><Icon name="search" size={14} /> {t('Filter')}</button>
                        <button type="button" className="btn secondary" onClick={clearFilters}>{t('Clear')}</button>
                    </div>
                </form>
            </section>

            <section className="panel glass shift-history__table-panel">
                <PanelHeading
                    eyebrow={t('Cash sessions')}
                    title={t('Shift records')}
                    action={<span className="status status-neutral"><span className="status-dot" />{rows.length} {t('shown')}</span>}
                />
                <div className="table-wrap shift-history__table-wrap">
                    <table>
                        <thead><tr><th>{t('Shift')}</th><th>{t('Cashier')}</th><th>{t('Warehouse / Register')}</th><th>{t('Opening')}</th><th>{t('Expected')}</th><th>{t('Counted')}</th><th>{t('Difference')}</th><th>{t('Status')}</th><th className="shift-history__actions">{t('Actions')}</th></tr></thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td colSpan="9"><Box sx={{ py: 5, textAlign: 'center' }}><Typography fontWeight={750}>{t('No shifts found')}</Typography><Typography variant="body2" color="text.secondary">{t('Try changing the filters or open a new shift from POS.')}</Typography></Box></td></tr>
                            ) : rows.map((shift) => {
                                const summary = shift.calculated_summary || shift;
                                const variance = shift.variance;
                                return (
                                    <tr key={shift.id}>
                                        <td><strong>#{shift.id}</strong><small>{formatDateTime(shift.opened_at)}</small></td>
                                        <td><strong>{shift.cashier?.name || '—'}</strong><small>{shift.cashier?.email || ''}</small></td>
                                        <td><strong>{shift.location?.name || '—'}</strong><small>{shift.register?.name || '—'} · {shift.register?.code || '—'}</small></td>
                                        <td className="numeric-cell">{money(shift.opening_cash)}</td>
                                        <td className="numeric-cell"><strong>{money(summary.expected_cash)}</strong></td>
                                        <td className="numeric-cell">{shift.counted_cash === null ? '—' : money(shift.counted_cash)}</td>
                                        <td className={`numeric-cell shift-history__variance ${variance === null ? 'is-neutral' : Number(variance) < 0 ? 'is-negative' : Number(variance) > 0 ? 'is-warning' : 'is-positive'}`}>{variance === null ? '—' : money(variance)}</td>
                                        <td><StatusBadge status={shift.status === 'open' ? 'warning' : 'success'} label={shift.status === 'open' ? 'Open' : 'Closed'} /></td>
                                        <td className="shift-history__actions">
                                            <button
                                                type="button"
                                                className="icon-btn small"
                                                onClick={() => setSelectedShift(shift)}
                                                aria-label={`${t('View details')} #${shift.id}`}
                                                title={t('View details')}
                                            >
                                                <Icon name="eye" size={15} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="shift-history__pagination">
                    <AdminPagination paginator={shifts} label="shifts" />
                </div>
            </section>
            </div>

            {filterDrawerOpen && (
                <div className="modal-backdrop shift-history__filter-backdrop" onMouseDown={() => setFilterDrawerOpen(false)}>
                    <form
                        className="drawer glass shift-history__filter-drawer"
                        onSubmit={submitFilters}
                        onMouseDown={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="shift-history-filter-title"
                    >
                        <div className="drawer-header">
                            <div>
                                <small className="eyebrow">{t('History controls')}</small>
                                <h2 id="shift-history-filter-title">{t('Filter shifts')}</h2>
                            </div>
                            <button type="button" className="icon-btn" onClick={() => setFilterDrawerOpen(false)} aria-label={t('Close')}>
                                <Icon name="close" size={16} />
                            </button>
                        </div>
                        <div className="shift-history__filter-drawer-body">{renderFilterFields(true)}</div>
                        <div className="drawer-actions">
                            <button type="button" className="btn secondary" onClick={clearFilters}>{t('Clear')}</button>
                            <button type="submit" className="btn primary"><Icon name="search" size={14} /> {t('Filter')}</button>
                        </div>
                    </form>
                </div>
            )}

            <Dialog className="shift-history__dialog" open={Boolean(selectedShift)} onClose={() => setSelectedShift(null)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center', fontWeight: 850 }}>
                    <span>{t('Shift details')} #{selectedShift?.id}</span>
                    <StatusBadge status={selectedShift?.status === 'open' ? 'warning' : 'success'} label={selectedShift?.status === 'open' ? 'Open' : 'Closed'} />
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.25 }}>
                            <Box><Typography variant="caption" color="text.secondary">{t('Cashier')}</Typography><Typography fontWeight={750}>{selectedShift?.cashier?.name || '—'}</Typography></Box>
                            <Box><Typography variant="caption" color="text.secondary">{t('Warehouse')}</Typography><Typography fontWeight={750}>{selectedShift?.location?.name || '—'}</Typography></Box>
                            <Box><Typography variant="caption" color="text.secondary">{t('Register')}</Typography><Typography fontWeight={750}>{selectedShift?.register?.name || '—'} · {selectedShift?.register?.code || '—'}</Typography></Box>
                            <Box><Typography variant="caption" color="text.secondary">{t('Opened at')}</Typography><Typography>{formatDateTime(selectedShift?.opened_at)}</Typography></Box>
                            <Box><Typography variant="caption" color="text.secondary">{t('Closed at')}</Typography><Typography>{formatDateTime(selectedShift?.closed_at)}</Typography></Box>
                            <Box><Typography variant="caption" color="text.secondary">{t('Closed by')}</Typography><Typography>{selectedShift?.closed_by?.name || '—'}</Typography></Box>
                        </Box>
                        <Divider />
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1 }}>
                            <MoneyItem label={t('Opening cash')} value={selectedShift?.opening_cash} />
                            <MoneyItem label={t('Cash received')} value={selectedSummary.cash_received_total} />
                            <MoneyItem label={t('Change given')} value={selectedSummary.change_given_total} />
                            <MoneyItem label={t('Net cash sales')} value={selectedSummary.net_cash_sales} />
                            <MoneyItem label={t('Card sales')} value={selectedSummary.card_sales_total} />
                            <MoneyItem label={t('Mobile sales')} value={selectedSummary.mobile_sales_total} />
                            <MoneyItem label={t('Expected cash')} value={selectedSummary.expected_cash} emphasize />
                            <MoneyItem label={t('Counted cash')} value={selectedShift?.counted_cash} emphasize />
                        </Box>
                        <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                            <Box><Typography variant="caption" color="text.secondary">{t('Sale count')}</Typography><Typography variant="h6" fontWeight={850}>{selectedSummary.sale_count || 0}</Typography></Box>
                            <Box sx={{ textAlign: 'right' }}><Typography variant="caption" color="text.secondary">{t('Difference')}</Typography><Typography variant="h6" fontWeight={850} color={selectedShift?.variance === null ? 'text.secondary' : Number(selectedShift?.variance) < 0 ? 'error.main' : Number(selectedShift?.variance) > 0 ? 'warning.dark' : 'success.main'}>{selectedShift?.variance === null ? '—' : money(selectedShift?.variance)}</Typography></Box>
                        </Paper>
                        {(selectedShift?.opening_notes || selectedShift?.closing_notes) && <Divider />}
                        {selectedShift?.opening_notes && <Box><Typography variant="caption" color="text.secondary">{t('Opening note')}</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{selectedShift.opening_notes}</Typography></Box>}
                        {selectedShift?.closing_notes && <Box><Typography variant="caption" color="text.secondary">{t('Closing note')}</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{selectedShift.closing_notes}</Typography></Box>}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                    <button
                        type="button"
                        className="btn primary"
                        style={{ minWidth: 104 }}
                        onClick={() => setSelectedShift(null)}
                        aria-label={t('Close shift details')}
                    >
                        <Icon name="close" size={14} /> {t('Close')}
                    </button>
                </DialogActions>
            </Dialog>
        </AdminLayout>
    );
}
