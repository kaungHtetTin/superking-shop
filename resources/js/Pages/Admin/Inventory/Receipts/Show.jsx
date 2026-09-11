import { Head, Link, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';
import { formatSelectedUnitQuantity } from '@/Utils/unitLabel';

const statusTone = {
    posted: 'success',
    draft: 'warning',
    reversed: 'danger',
};

const formatDateTime = (value) => value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '-';

export default function ReceiptShow({ receipt, priceChanges = [] }) {
    const { app_base, flash } = usePage().props;
    const t = usePhraseTranslation();
    const lineCount = receipt.items.length;
    const totalCost = receipt.items.reduce((sum, item) => sum + Number(item.received_quantity || 0) * Number(item.unit_cost || 0), 0);
    const recordedAt = receipt.received_at || receipt.created_at;

    return (
        <AdminLayout
            title={receipt.receipt_number}
            eyebrow={t('Stock receipt')}
            contentClassName="record-detail-page"
            action={(
                <div className="inline-actions">
                    {receipt.status === 'draft' && (
                        <Link className="btn secondary" href={routeWithBase(`/admin/inventory/receipts/${receipt.id}/edit`, app_base)}>
                            <Icon name="edit" size={14} /> {t('Edit')}
                        </Link>
                    )}
                    <Link className="btn secondary" href={routeWithBase('/admin/inventory/receipts', app_base)}>
                        <Icon name="arrowLeft" size={14} /> {t('Back to receipts')}
                    </Link>
                </div>
            )}
        >
            <Head title={receipt.receipt_number} />
            <AdminFlash flash={flash} />
            {priceChanges.length > 0 && <section className="panel pricing-panel"><h2>{priceChanges.length} automatic prices updated</h2><details><summary>View committed price changes</summary><div className="table-wrap"><table><thead><tr><th>Product / unit</th><th>Price type</th><th>Old price</th><th>New price</th><th>Buying cost</th></tr></thead><tbody>{priceChanges.map(change => { const snapshot = typeof change.rule_snapshot === 'string' ? JSON.parse(change.rule_snapshot) : change.rule_snapshot; const item = receipt.items.find(item => item.product_id === change.product_id); return <tr key={change.id}><td>{item?.product?.name || `Product #${change.product_id}`} / unit #{change.product_unit_id}</td><td>{snapshot?.name}</td><td>{formatMoney(change.old_price)}</td><td>{formatMoney(change.new_price)}</td><td>{change.cost_used}</td></tr>; })}</tbody></table></div></details></section>}

            <section className="panel glass record-detail-card">
                <header className="record-detail-header">
                    <div className="record-detail-title">
                        <span className="record-detail-icon" aria-hidden="true"><Icon name="receipt" size={19} /></span>
                        <div>
                            <p className="eyebrow">{t('Receipt summary')}</p>
                            <h2>{receipt.receipt_number}</h2>
                            <p>{t('Received into')} <strong>{receipt.location.name}</strong> · {receipt.location.code}</p>
                        </div>
                    </div>
                    <StatusBadge status={statusTone[receipt.status] || 'neutral'} label={t(receipt.status)} />
                </header>

                <div className="record-detail-facts">
                    <div><small>{t('Quantity format')}</small><strong>{t('Equivalent units')}</strong></div>
                    <div><small>{t('Product lines')}</small><strong>{lineCount.toLocaleString()}</strong></div>
                    <div><small>{t('Stock value')}</small><strong>{formatMoney(totalCost)}</strong></div>
                    <div><small>{t('Received at')}</small><strong>{formatDateTime(recordedAt)}</strong></div>
                </div>

                <div className="record-detail-meta">
                    <div><small>{t('Warehouse')}</small><strong>{receipt.location.name}</strong><span>{receipt.location.code}</span></div>
                    <div><small>{t('Supplier / reference')}</small><strong>{receipt.supplier_reference || t('None')}</strong></div>
                    <div><small>{t('Created by')}</small><strong>{receipt.creator?.name || t('Admin')}</strong></div>
                    <div><small>{t('Received by')}</small><strong>{receipt.receiver?.name || receipt.creator?.name || t('Admin')}</strong></div>
                    {receipt.inventory_import && (
                        <div><small>{t('Import batch')}</small><strong>{receipt.inventory_import.batch_number}</strong><span>{receipt.inventory_import.original_filename}</span></div>
                    )}
                    {receipt.notes && <div className="wide"><small>{t('Notes')}</small><strong>{receipt.notes}</strong></div>}
                </div>

                <div className="record-detail-lines-heading">
                    <div><p className="eyebrow">{t('Received items')}</p><h3>{t(':count product lines', { count: lineCount })}</h3></div>
                    <small>{t('Quantities and acquisition cost recorded by this receipt.')}</small>
                </div>

                <div className="table-wrap record-detail-lines">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th className="record-line-number">#</th>
                                <th>{t('Product / unit')}</th>
                                <th className="numeric-cell">{t('Expected')}</th>
                                <th className="numeric-cell">{t('Received')}</th>
                                <th className="numeric-cell">{t('FOC')}</th>
                                <th className="numeric-cell">{t('Unit cost')}</th>
                                <th className="numeric-cell">{t('Line total')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {receipt.items.map((item, index) => (
                                <tr key={item.id}>
                                    <td className="record-line-number">{String(index + 1).padStart(2, '0')}</td>
                                    <td>
                                        <div className="record-detail-product">
                                            <span aria-hidden="true"><Icon name="box" size={14} /></span>
                                            <div>
                                                <strong>{item.product.name}</strong>
                                                <small className="table-subline">{item.product.product_code} · {item.unit.name} ({item.unit.code})</small>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="numeric-cell">{item.expected_quantity == null ? '—' : formatSelectedUnitQuantity(item.expected_quantity, item.unit, item.product.units)}</td>
                                    <td className="numeric-cell"><strong>{formatSelectedUnitQuantity(item.received_quantity, item.unit, item.product.units)}</strong></td>
                                    <td className="numeric-cell"><strong>{formatSelectedUnitQuantity(item.free_quantity, item.unit, item.product.units)}</strong></td>
                                    <td className="numeric-cell">{formatMoney(item.unit_cost || 0)}</td>
                                    <td className="numeric-cell"><strong>{formatMoney(Number(item.received_quantity || 0) * Number(item.unit_cost || 0))}</strong></td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan="3">{t('Receipt total')}</td>
                                <td />
                                <td />
                                <td />
                                <td className="numeric-cell">{formatMoney(totalCost)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </section>
        </AdminLayout>
    );
}
