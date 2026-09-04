import { Head, Link, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import AdminPagination from '@/Components/Admin/AdminPagination';
import Icon from '@/Components/Admin/icons';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import useInventoryRealtime from '@/Utils/useInventoryRealtime';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

function TransferMetric({ label, value, hint, icon, tone = '' }) {
    const t = usePhraseTranslation();
    return <article className={`metric-card glass${tone ? ` tone-${tone}` : ''}`}><span className="icon-well"><Icon name={icon} size={15} /></span><small>{t(label)}</small><strong>{value}</strong><p>{t(hint)}</p></article>;
}

export default function TransfersIndex({ transfers, filters = {}, locations = [], summary = {}, canCreate, realtime, lastUpdated, pollIntervalMs = 20000 }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const applyFilter = (patch) => router.get(routeWithBase('/admin/inventory/transfers', app_base), { ...filters, ...patch }, { preserveState: true, replace: true });
    const exportQuery = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value != null)).toString();
    const exportHref = `${routeWithBase('/admin/inventory/transfers/export', app_base)}${exportQuery ? `?${exportQuery}` : ''}`;
    const { state: realtimeState, lastEventAt } = useInventoryRealtime({
        locationIds: realtime?.locationIds || [],
        includeAll: realtime?.canAll,
        only: ['transfers', 'lastUpdated'],
        pollIntervalMs,
        listenBalance: false,
        listenTransfers: true,
    });

    return (
        <AdminLayout
            title={t('Transfers')}
            eyebrow={t('Inventory')}
            action={<div className="inline-actions"><a className="btn secondary" href={exportHref}><Icon name="download" size={14} /> {t('CSV')}</a>{canCreate && <Link className="btn primary" href={routeWithBase('/admin/inventory/transfers/create', app_base)}><Icon name="plus" size={14} /> {t('New transfer')}</Link>}</div>}
        >
            <Head title={t('Stock Transfers')} />
            <section className="panel glass">
                <PanelHeading eyebrow={t('Inter-location')} title={t('Stock transfers')} action={<small className="muted">{t('Realtime')} {t(realtimeState)} - {t('Updated')} {new Date(lastEventAt || lastUpdated).toLocaleTimeString()}</small>} />
                <div className="metrics-grid transfer-summary-grid"><TransferMetric label="Transfers" value={Number(summary.count || 0).toLocaleString()} hint="Filtered transfer records" icon="truck" /><TransferMetric label="Transfer value" value={formatMoney(summary.transfer_value)} hint="Total stock value moved" icon="box" /></div>
                <div className="filter-toolbar transfer-filter-toolbar"><label className="form-field"><span>{t('From shop')}</span><select value={filters.source || ''} onChange={(e) => applyFilter({ source: e.target.value || undefined })}><option value="">{t('All source shops')}</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label className="form-field"><span>{t('To shop')}</span><select value={filters.destination || ''} onChange={(e) => applyFilter({ destination: e.target.value || undefined })}><option value="">{t('All destination shops')}</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label className="form-field"><span>{t('From date')}</span><input type="date" value={filters.date_from || ''} onChange={(e) => applyFilter({ date_from: e.target.value || undefined })} /></label><label className="form-field"><span>{t('To date')}</span><input type="date" value={filters.date_to || ''} onChange={(e) => applyFilter({ date_to: e.target.value || undefined })} /></label></div>
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('Transfer')}</th>
                                <th>{t('From')}</th>
                                <th>{t('To')}</th>
                                <th>{t('Lines')}</th>
                                <th>{t('Units')}</th>
                                <th>{t('Amount')}</th>
                                <th>{t('Date')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {transfers.data.length === 0 ? (
                                <tr><td colSpan="8" className="empty-table-cell">{t('No transfers yet.')}</td></tr>
                        ) : transfers.data.map((transfer) => (
                                <tr key={transfer.id}>
                                    <td><strong>{transfer.transfer_number}</strong></td>
                                    <td>{transfer.source_location.name}<small className="table-subline">{transfer.source_location.code}</small></td>
                                    <td>{transfer.destination_location.name}<small className="table-subline">{transfer.destination_location.code}</small></td>
                                    <td>{transfer.items.length}</td>
                                    <td>{transfer.items.reduce((sum, item) => sum + Number(item.requested_quantity || 0), 0)}</td>
                                    <td><strong>{formatMoney(transfer.total_amount)}</strong></td>
                                    <td>{new Date(transfer.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <Link className="icon-btn small" href={routeWithBase(`/admin/inventory/transfers/${transfer.id}`, app_base)} aria-label={t('Open transfer')}>
                                            <Icon name="external" size={13} />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={transfers} label={t('transfers')} />
            </section>
        </AdminLayout>
    );
}
