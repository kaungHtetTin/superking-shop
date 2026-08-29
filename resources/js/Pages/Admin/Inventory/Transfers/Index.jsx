import { Head, Link, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import AdminPagination from '@/Components/Admin/AdminPagination';
import Icon from '@/Components/Admin/icons';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import useInventoryRealtime from '@/Utils/useInventoryRealtime';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function TransfersIndex({ transfers, canCreate, realtime, lastUpdated, pollIntervalMs = 20000 }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
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
            action={canCreate ? <Link className="btn primary" href={routeWithBase('/admin/inventory/transfers/create', app_base)}><Icon name="plus" size={14} /> {t('New transfer')}</Link> : null}
        >
            <Head title={t('Stock Transfers')} />
            <section className="panel glass">
                <PanelHeading eyebrow={t('Inter-location')} title={t('Stock transfers')} action={<small className="muted">{t('Realtime')} {t(realtimeState)} - {t('Updated')} {new Date(lastEventAt || lastUpdated).toLocaleTimeString()}</small>} />
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('Transfer')}</th>
                                <th>{t('From')}</th>
                                <th>{t('To')}</th>
                                <th>{t('Lines')}</th>
                                <th>{t('Units')}</th>
                                <th>{t('Date')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {transfers.data.length === 0 ? (
                                <tr><td colSpan="7" className="empty-table-cell">{t('No transfers yet.')}</td></tr>
                        ) : transfers.data.map((transfer) => (
                                <tr key={transfer.id}>
                                    <td><strong>{transfer.transfer_number}</strong></td>
                                    <td>{transfer.source_location.name}<small className="table-subline">{transfer.source_location.code}</small></td>
                                    <td>{transfer.destination_location.name}<small className="table-subline">{transfer.destination_location.code}</small></td>
                                    <td>{transfer.items.length}</td>
                                    <td>{transfer.items.reduce((sum, item) => sum + item.requested_quantity, 0)}</td>
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
