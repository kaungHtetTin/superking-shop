import { Head, Link, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { routeWithBase } from '@/Utils/url';
import useInventoryRealtime from '@/Utils/useInventoryRealtime';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

function formatDateTime(value) {
    if (!value) return '-';

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function formatUpdateTime(value) {
    if (!value) return '-';

    return new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

export default function TransferShow({ transfer, lastUpdated, pollIntervalMs = 20000 }) {
    const { app_base, flash } = usePage().props;
    const t = usePhraseTranslation();
    const { state: realtimeState, lastEventAt } = useInventoryRealtime({
        locationIds: [transfer.source_location_id, transfer.destination_location_id],
        transferId: transfer.id,
        only: ['transfer', 'lastUpdated'],
        pollIntervalMs,
        listenBalance: false,
        listenTransfers: true,
    });
    const totalUnits = transfer.items.reduce((sum, item) => sum + Number(item.requested_quantity || 0), 0);
    const lineCount = transfer.items.length;
    const completedAt = transfer.received_at || transfer.created_at;
    const creatorName = transfer.creator?.name || t('Admin');

    return (
        <AdminLayout
            title={transfer.transfer_number}
            eyebrow={t('Stock transfer')}
            contentClassName="transfer-detail-page"
            action={
                <Link className="btn secondary" href={routeWithBase('/admin/inventory/transfers', app_base)}>
                    <Icon name="arrowLeft" size={14} /> {t('Back to transfers')}
                </Link>
            }
        >
            <Head title={transfer.transfer_number} />
            <AdminFlash flash={flash} />

            <section className="panel glass transfer-detail-document">
                <header className="transfer-detail-header">
                    <div className="transfer-detail-title">
                        <span className="transfer-detail-title-icon" aria-hidden="true">
                            <Icon name="truck" size={18} />
                        </span>
                        <div>
                            <p className="eyebrow">{t('Transfer summary')}</p>
                            <h2>{t('Warehouse stock movement')}</h2>
                            <p>{t('Completed by')} <strong>{creatorName}</strong></p>
                        </div>
                    </div>

                    <div className="transfer-detail-state">
                        <span className="status status-success">
                            <span className="status-dot" />
                            {t(transfer.status || 'received')}
                        </span>
                        <small className={`realtime-indicator ${realtimeState}`}>
                            <span />
                            {t('Realtime')} {t(realtimeState)} · {t('Updated')} {formatUpdateTime(lastEventAt || lastUpdated)}
                        </small>
                    </div>
                </header>

                <div className="transfer-route-summary">
                    <div className="transfer-location-card">
                        <span className="transfer-location-icon" aria-hidden="true">
                            <Icon name="box" size={17} />
                        </span>
                        <div>
                            <small>{t('Source')}</small>
                            <strong>{transfer.source_location.name}</strong>
                            <span>{transfer.source_location.code}</span>
                        </div>
                    </div>

                    <div className="transfer-detail-direction" aria-hidden="true">
                        <span><Icon name="arrowLeft" size={15} /></span>
                        <small>{t('Stock moved')}</small>
                    </div>

                    <div className="transfer-location-card destination">
                        <span className="transfer-location-icon" aria-hidden="true">
                            <Icon name="box" size={17} />
                        </span>
                        <div>
                            <small>{t('Destination')}</small>
                            <strong>{transfer.destination_location.name}</strong>
                            <span>{transfer.destination_location.code}</span>
                        </div>
                    </div>
                </div>

                <div className="transfer-detail-facts">
                    <div>
                        <small>{t('Total units')}</small>
                        <strong>{totalUnits.toLocaleString()}</strong>
                    </div>
                    <div>
                        <small>{t('Product lines')}</small>
                        <strong>{lineCount.toLocaleString()}</strong>
                    </div>
                    <div>
                        <small>{t('Transferred at')}</small>
                        <strong>{formatDateTime(completedAt)}</strong>
                    </div>
                    <div>
                        <small>{t('Reference')}</small>
                        <strong>{transfer.transfer_number}</strong>
                    </div>
                    <div>
                        <small>{t('Transfer value')}</small>
                        <strong>{formatMoney(transfer.total_amount)}</strong>
                    </div>
                    <div>
                        <small>{t('Finance impact')}</small>
                        <strong>{t('None')}</strong>
                    </div>
                </div>

                <div className="transfer-lines-heading">
                    <div>
                        <p className="eyebrow">{t('Movement lines')}</p>
                        <h3>{t(':count products transferred', { count: lineCount })}</h3>
                    </div>
                    <small>{t('Source quantities decrease and destination quantities increase.')}</small>
                </div>

                <div className="table-wrap transfer-detail-lines">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th className="transfer-line-number">#</th>
                                <th>{t('Product / unit')}</th>
                                <th className="numeric-cell">{t('Moved')}</th>
                                <th className="numeric-cell">{t('Unit cost')}</th>
                                <th className="numeric-cell">{t('Amount')}</th>
                                <th className="numeric-cell">{transfer.source_location.code}</th>
                                <th className="numeric-cell">{transfer.destination_location.code}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transfer.items.map((item, index) => (
                                <tr key={item.id}>
                                    <td className="transfer-line-number">{String(index + 1).padStart(2, '0')}</td>
                                    <td>
                                        <div className="transfer-line-product">
                                            <span aria-hidden="true"><Icon name="box" size={14} /></span>
                                            <div>
                                                <strong>{item.product.name}</strong>
                                                <small className="table-subline">{item.product.product_code} · {item.unit.name} ({item.unit.code})</small>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="numeric-cell">
                                        <span className="transfer-quantity-badge moved">{Number(item.requested_quantity).toLocaleString()}</span>
                                    </td>
                                    <td className="numeric-cell">{formatMoney(item.unit_cost)}</td>
                                    <td className="numeric-cell"><strong>{formatMoney(item.line_total)}</strong></td>
                                    <td className="numeric-cell">
                                        <span className="transfer-quantity-badge negative">−{Number(item.requested_quantity).toLocaleString()}</span>
                                    </td>
                                    <td className="numeric-cell">
                                        <span className="transfer-quantity-badge positive">+{Number(item.requested_quantity).toLocaleString()}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan="2">{t('Transfer total')}</td>
                                <td className="numeric-cell">{totalUnits.toLocaleString()}</td>
                                <td />
                                <td className="numeric-cell"><strong>{formatMoney(transfer.total_amount)}</strong></td>
                                <td className="numeric-cell quantity-negative">−{totalUnits.toLocaleString()}</td>
                                <td className="numeric-cell quantity-positive">+{totalUnits.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </section>
        </AdminLayout>
    );
}
