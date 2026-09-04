import { useMemo, useState } from 'react';
import {
    Box,
    Chip,
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

function SummaryCard({ label, value, tone = 'primary', caption }) {
    const colors = {
        primary: ['primary.main', 'primary.50'],
        success: ['success.main', 'success.50'],
        warning: ['warning.main', 'warning.50'],
        error: ['error.main', 'error.50'],
    };
    const [borderColor, backgroundColor] = colors[tone] || colors.primary;

    return (
        <Paper variant="outlined" sx={{ p: 1.75, minWidth: 0, borderTop: '3px solid', borderTopColor: borderColor, bgcolor: backgroundColor }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography>
            <Typography variant="h6" fontWeight={850} noWrap>{value}</Typography>
            {caption && <Typography variant="caption" color="text.secondary">{caption}</Typography>}
        </Paper>
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
    const [filterState, setFilterState] = useState({
        q: filters.q || '',
        status: filters.status || '',
        location_id: filters.location_id || '',
        from: filters.from || '',
        to: filters.to || '',
    });

    const rows = shifts?.data || [];
    const selectedSummary = useMemo(() => selectedShift?.calculated_summary || selectedShift || {}, [selectedShift]);

    const navigate = (next = filterState) => {
        router.get(routeWithBase('/admin/pos/shifts', app_base), next, { preserveState: true, preserveScroll: true });
    };

    const submitFilters = (event) => {
        event.preventDefault();
        navigate(filterState);
    };

    const clearFilters = () => {
        const empty = { q: '', status: '', location_id: '', from: '', to: '' };
        setFilterState(empty);
        navigate(empty);
    };

    return (
        <AdminLayout
            title={t('Shift history')}
            eyebrow={t('POS')}
            action={<Link className="btn secondary" href={routeWithBase('/admin/pos', app_base)}><Icon name="arrowLeft" size={14} /> {t('Back to POS')}</Link>}
        >
            <Head title={t('Shift history')} />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.25, mb: 2 }}>
                <SummaryCard label={t('Total shifts')} value={stats.total || 0} caption={t('Matching filters')} />
                <SummaryCard label={t('Open now')} value={stats.open || 0} tone="warning" caption={t('Active cash sessions')} />
                <SummaryCard label={t('Closed')} value={stats.closed || 0} tone="success" caption={t('Completed sessions')} />
                <SummaryCard
                    label={t('Net difference')}
                    value={money(stats.variance)}
                    tone={Number(stats.variance || 0) < 0 ? 'error' : 'success'}
                    caption={Number(stats.variance || 0) < 0 ? t('Overall shortage') : t('Overall overage')}
                />
            </Box>

            <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                <Box component="form" className="shift-history-filter-grid" onSubmit={submitFilters} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(220px, 2fr) 1fr', lg: 'minmax(240px, 2fr) repeat(4, minmax(140px, 1fr)) auto' }, gap: 1.25, alignItems: 'end' }}>
                    <label className="form-field">
                        <span>{canViewAllCashiers ? t('Search cashier or register') : t('Search register')}</span>
                        <input type="search" value={filterState.q} onChange={(event) => setFilterState((current) => ({ ...current, q: event.target.value }))} placeholder={t('Name, email or register code')} />
                    </label>
                    <label className="form-field">
                        <span>{t('Status')}</span>
                        <select value={filterState.status} onChange={(event) => setFilterState((current) => ({ ...current, status: event.target.value }))}>
                            <option value="">{t('All statuses')}</option>
                            <option value="open">{t('Open')}</option>
                            <option value="closed">{t('Closed')}</option>
                        </select>
                    </label>
                    <label className="form-field">
                        <span>{t('Warehouse')}</span>
                        <select value={filterState.location_id} onChange={(event) => setFilterState((current) => ({ ...current, location_id: event.target.value }))}>
                            <option value="">{t('All warehouses')}</option>
                            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                        </select>
                    </label>
                    <label className="form-field">
                        <span>{t('From')}</span>
                        <input type="date" value={filterState.from} onChange={(event) => setFilterState((current) => ({ ...current, from: event.target.value }))} />
                    </label>
                    <label className="form-field">
                        <span>{t('To')}</span>
                        <input type="date" value={filterState.to} onChange={(event) => setFilterState((current) => ({ ...current, to: event.target.value }))} />
                    </label>
                    <div className="inline-actions" style={{ flexWrap: 'nowrap' }}>
                        <button type="submit" className="btn primary"><Icon name="search" size={14} /> {t('Filter')}</button>
                        <button type="button" className="btn secondary" onClick={clearFilters}>{t('Clear')}</button>
                    </div>
                </Box>
            </Paper>

            <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                <Box sx={{ overflowX: 'auto' }}>
                    <Box component="table" sx={{ width: '100%', minWidth: 1050, borderCollapse: 'collapse', '& th': { bgcolor: 'action.hover', color: 'text.secondary', fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', textAlign: 'left', px: 1.5, py: 1.25 }, '& td': { px: 1.5, py: 1.25, borderTop: '1px solid', borderColor: 'divider', verticalAlign: 'middle' }, '& tbody tr:hover': { bgcolor: 'action.hover' } }}>
                        <thead><tr><th>{t('Shift')}</th><th>{t('Cashier')}</th><th>{t('Warehouse / Register')}</th><th>{t('Opening')}</th><th>{t('Expected')}</th><th>{t('Counted')}</th><th>{t('Difference')}</th><th>{t('Status')}</th><th /></tr></thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td colSpan="9"><Box sx={{ py: 5, textAlign: 'center' }}><Typography fontWeight={750}>{t('No shifts found')}</Typography><Typography variant="body2" color="text.secondary">{t('Try changing the filters or open a new shift from POS.')}</Typography></Box></td></tr>
                            ) : rows.map((shift) => {
                                const summary = shift.calculated_summary || shift;
                                const variance = shift.variance;
                                return (
                                    <tr key={shift.id}>
                                        <td><Typography fontWeight={800}>#{shift.id}</Typography><Typography variant="caption" color="text.secondary">{formatDateTime(shift.opened_at)}</Typography></td>
                                        <td><Typography fontWeight={700}>{shift.cashier?.name || '—'}</Typography><Typography variant="caption" color="text.secondary">{shift.cashier?.email || ''}</Typography></td>
                                        <td><Typography fontWeight={700}>{shift.location?.name || '—'}</Typography><Typography variant="caption" color="text.secondary">{shift.register?.name || '—'} · {shift.register?.code || '—'}</Typography></td>
                                        <td>{money(shift.opening_cash)}</td>
                                        <td><Typography fontWeight={750}>{money(summary.expected_cash)}</Typography></td>
                                        <td>{shift.counted_cash === null ? '—' : money(shift.counted_cash)}</td>
                                        <td><Typography fontWeight={800} color={variance === null ? 'text.secondary' : Number(variance) < 0 ? 'error.main' : Number(variance) > 0 ? 'warning.dark' : 'success.main'}>{variance === null ? '—' : money(variance)}</Typography></td>
                                        <td><Chip size="small" label={t(shift.status === 'open' ? 'Open' : 'Closed')} color={shift.status === 'open' ? 'warning' : 'success'} variant={shift.status === 'open' ? 'filled' : 'outlined'} /></td>
                                        <td>
                                            <button
                                                type="button"
                                                className="btn secondary"
                                                style={{ minHeight: 32, padding: '6px 10px', whiteSpace: 'nowrap' }}
                                                onClick={() => setSelectedShift(shift)}
                                                aria-label={`${t('View details')} #${shift.id}`}
                                            >
                                                <Icon name="eye" size={14} /> {t('Details')}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Box>
                </Box>
                <Box sx={{ p: 1.5, borderTop: rows.length ? '1px solid' : 0, borderColor: 'divider' }}>
                    <AdminPagination paginator={shifts} label="shifts" />
                </Box>
            </Paper>

            <Dialog open={Boolean(selectedShift)} onClose={() => setSelectedShift(null)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center', fontWeight: 850 }}>
                    <span>{t('Shift details')} #{selectedShift?.id}</span>
                    <Chip size="small" label={t(selectedShift?.status === 'open' ? 'Open' : 'Closed')} color={selectedShift?.status === 'open' ? 'warning' : 'success'} />
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
