import { Head, Link, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import AdminPagination from '@/Components/Admin/AdminPagination';
import Icon from '@/Components/Admin/icons';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import useInventoryRealtime from '@/Utils/useInventoryRealtime';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatCompoundQuantity, formatSelectedUnitQuantity } from '@/Utils/unitLabel';

export default function ProductShow({ product, balances, movements, locations, types, filters, realtime, lastUpdated, pollIntervalMs = 20000 }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const { state: realtimeState, lastEventAt } = useInventoryRealtime({ locationIds: realtime?.locationIds || balances.map((balance) => balance.location_id), includeAll: realtime?.canAll, productId: product.id, only: ['balances', 'movements', 'types', 'lastUpdated'], pollIntervalMs, listenBalance: true, listenTransfers: false });
    const changeFilter = (key, value) => router.get(routeWithBase(`/admin/inventory/products/${product.id}`, app_base), { ...filters, [key]: value }, { preserveState: true, replace: true });

    return (
        <AdminLayout title={product.product_code} eyebrow={t('Inventory history')} action={<a className="btn secondary" href={routeWithBase(`/admin/inventory/products/${product.id}/export`, app_base)}><Icon name="download" size={14} />{t('Export')}</a>}>
            <Head title={t(':value Inventory', { value: product.product_code })} />
            <div className="sticky-toolbar"><Link className="back-link" href={routeWithBase('/admin/inventory', app_base)}><Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} />{t('Back to inventory')}</Link></div>
            <section className="product-balance-strip">
                <div className="product-identity"><span>{product.name}</span><strong>{product.product_code}</strong><small>{product.barcode || t('No barcode')} · {product.base_unit?.name || t('Base unit')}</small></div>
                {balances.map((balance) => <div key={balance.id}><span>{balance.location.name}</span><strong>{formatCompoundQuantity(balance.available_qty, product.units)}</strong><small>{t(':onHand on hand / :reserved reserved', { onHand: formatCompoundQuantity(balance.on_hand_qty, product.units), reserved: formatCompoundQuantity(balance.reserved_qty, product.units) })}</small></div>)}
            </section>
            <section className="panel">
                <PanelHeading eyebrow={t('Ledger')} title={t('Movement history')} action={<small className="muted">{t('Realtime')} {t(realtimeState)} · {t('Updated')} {new Date(lastEventAt || lastUpdated).toLocaleTimeString()}</small>} />
                <div className="inventory-filterbar"><select value={filters.location || ''} onChange={(event) => changeFilter('location', event.target.value)}><option value="">{t('All warehouses')}</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select><select value={filters.type || ''} onChange={(event) => changeFilter('type', event.target.value)}><option value="">{t('All movement types')}</option>{types.map((type) => <option key={type} value={type}>{t(type.replaceAll('_', ' '))}</option>)}</select><input type="date" value={filters.from || ''} onChange={(event) => changeFilter('from', event.target.value)} aria-label={t('From date')} /><input type="date" value={filters.to || ''} onChange={(event) => changeFilter('to', event.target.value)} aria-label={t('To date')} /></div>
                <div className="table-wrap"><table className="data-table"><thead><tr><th>{t('Time')}</th><th>{t('Warehouse')}</th><th>{t('Movement')}</th><th>{t('Entered unit')}</th><th>{t('Base change')}</th><th>{t('Before')}</th><th>{t('After')}</th><th>{t('User / reason')}</th></tr></thead><tbody>
                    {movements.data.length === 0 ? <tr><td colSpan="8" className="empty-table-cell">{t('No movements found.')}</td></tr> : movements.data.map((movement) => <tr key={movement.id}><td><strong>{new Date(movement.occurred_at).toLocaleDateString()}</strong><small className="table-subline">{new Date(movement.occurred_at).toLocaleTimeString()}</small></td><td>{movement.location.code}</td><td>{movement.type.replaceAll('_', ' ')}</td><td>{movement.unit_quantity != null ? formatSelectedUnitQuantity(movement.unit_quantity, movement.unit, product.units) : '-'}</td><td className={movement.quantity_delta >= 0 ? 'quantity-positive' : 'quantity-negative'}>{formatCompoundQuantity(movement.quantity_delta, product.units, { signed: true })}</td><td>{formatCompoundQuantity(movement.on_hand_before, product.units)}</td><td>{formatCompoundQuantity(movement.on_hand_after, product.units)}</td><td>{movement.creator?.name || t('System')}<small className="table-subline">{movement.reason_code || movement.notes || '-'}</small>{movement.document && <small className="table-subline"><Link href={movement.document.href}>{movement.document.label}</Link></small>}</td></tr>)}
                </tbody></table></div>
                <AdminPagination paginator={movements} label={t('movements')} />
            </section>
        </AdminLayout>
    );
}
