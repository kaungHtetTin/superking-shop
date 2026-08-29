import { useEffect, useState } from 'react';
import { Head, Link, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import AdminPagination from '@/Components/Admin/AdminPagination';
import Icon from '@/Components/Admin/icons';
import { ColumnVisibilityControl, PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase, storageUrl } from '@/Utils/url';
import useInventoryRealtime from '@/Utils/useInventoryRealtime';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function InventoryIndex({ balances, locations, categories, filters, can, lastUpdated, pollIntervalMs = 20000 }) {
    const { app_base, app_url } = usePage().props;
    const t = usePhraseTranslation();
    const [query, setQuery] = useState(filters.q || '');
    const [updatedAt, setUpdatedAt] = useState(lastUpdated);
    const [visibleColumns, setVisibleColumns] = useState({ image: true, warehouse: true, reserved: true, reorder: true, status: true });
    const { state: realtimeState, lastEventAt } = useInventoryRealtime({
        locationIds: locations.map((location) => location.id),
        includeAll: can.realtimeAll,
        only: ['balances', 'lastUpdated'],
        pollIntervalMs,
        listenBalance: true,
        listenTransfers: true,
    });

    useEffect(() => {
        setUpdatedAt(lastUpdated);
    }, [lastUpdated]);

    const applyFilters = (patch = {}) => {
        router.get(routeWithBase('/admin/inventory', app_base), { ...filters, q: query, ...patch }, { preserveState: true, replace: true });
    };
    const toggleColumn = (key) => setVisibleColumns((current) => ({ ...current, [key]: current[key] === false }));

    return (
        <AdminLayout
            title={t('Inventory')}
            eyebrow={t('Stock control')}
            action={
                <div className="inline-actions">
                    {can.transfer && <Link className="btn secondary" href={routeWithBase('/admin/inventory/transfers/create', app_base)}><Icon name="truck" size={14} /> {t('Transfer')}</Link>}
                    {can.receive && <Link className="btn primary" href={routeWithBase('/admin/inventory/receipts/create', app_base)}><Icon name="plus" size={14} /> {t('Receive')}</Link>}
                </div>
            }
        >
            <Head title={t('Inventory')} />
            <section className="panel glass">
                <PanelHeading
                    eyebrow={t('Live balances')}
                    title={t('Stock by warehouse')}
                    action={
                        <div className="inline-actions">
                            <span className={`realtime-indicator ${realtimeState}`}><span />{t('Realtime')} {t(realtimeState)} · {new Date(lastEventAt || updatedAt).toLocaleTimeString()}</span>
                            <ColumnVisibilityControl
                                columns={[
                                    { key: 'image', label: 'Image' },
                                    { key: 'product', label: 'Product', locked: true },
                                    { key: 'warehouse', label: 'Warehouse' },
                                    { key: 'onHand', label: 'On hand', locked: true },
                                    { key: 'reserved', label: 'Reserved' },
                                    { key: 'available', label: 'Available', locked: true },
                                    { key: 'reorder', label: 'Minimum' },
                                    { key: 'status', label: 'Status' },
                                ]}
                                visible={visibleColumns}
                                onToggle={toggleColumn}
                            />
                        </div>
                    }
                />
                <div className="inventory-filterbar">
                    <div className="search-box">
                        <Icon name="search" size={15} />
                        <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && applyFilters()} placeholder={t('Product, product code, or barcode')} />
                    </div>
                    <select value={filters.location} onChange={(event) => applyFilters({ location: event.target.value })}>
                        <option value="all">{t('All warehouses')}</option>
                        {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                    </select>
                    <select value={filters.category} onChange={(event) => applyFilters({ category: event.target.value })}>
                        <option value="all">{t('All categories')}</option>
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                    <label><input type="checkbox" checked={filters.out_of_stock} onChange={(event) => applyFilters({ out_of_stock: event.target.checked })} /> {t('Out of stock')}</label>
                    <button type="button" className="icon-btn" onClick={() => applyFilters()} aria-label={t('Search')} title={t('Search')}><Icon name="search" size={15} /></button>
                    <a className="icon-btn" href={routeWithBase('/admin/inventory/export', app_base)} aria-label={t('Export balances')} title={t('Export balances')}><Icon name="download" size={15} /></a>
                </div>

                <div className="table-wrap">
                    <table className="data-table inventory-table">
                        <thead><tr>{visibleColumns.image !== false && <th className="inventory-image-column">{t('Image')}</th>}<th className="inventory-product-column">{t('Product')}</th>{visibleColumns.warehouse !== false && <th>{t('Warehouse')}</th>}<th className="numeric-cell">{t('On hand (base)')}</th>{visibleColumns.reserved !== false && <th className="numeric-cell">{t('Reserved (base)')}</th>}<th className="numeric-cell">{t('Available')}</th>{visibleColumns.reorder !== false && <th className="numeric-cell">{t('Minimum')}</th>}{visibleColumns.status !== false && <th>{t('Status')}</th>}<th className="table-actions-column" /></tr></thead>
                        <tbody>
                            {balances.data.length === 0 ? (
                                <tr><td colSpan={4 + Object.values(visibleColumns).filter(Boolean).length} className="empty-table-cell">{t('No products match these filters.')}</td></tr>
                            ) : balances.data.map((balance) => {
                                const available = balance.on_hand_qty - balance.reserved_qty;
                                const status = available <= 0 ? 'danger' : available <= balance.min_quantity ? 'warning' : 'success';
                                const imagePath = balance.product?.image_path;
                                return (
                                    <tr key={balance.id}>
                                        {visibleColumns.image !== false && <td className="inventory-image-column">
                                            <div className="inventory-image-cell">
                                                {imagePath ? (
                                                    <img src={storageUrl(imagePath, app_url)} alt="" />
                                                ) : (
                                                    <Icon name="box" size={17} />
                                                )}
                                            </div>
                                        </td>}
                                        <td className="inventory-product-column"><strong>{balance.product.name}</strong><small className="table-subline">{balance.product.product_code} · {balance.product.base_unit?.code || t('base')}</small></td>
                                        {visibleColumns.warehouse !== false && <td><strong>{balance.location.name}</strong><small className="table-subline">{balance.location.code}</small></td>}
                                        <td className="quantity-cell">{balance.on_hand_qty}</td>
                                        {visibleColumns.reserved !== false && <td className="quantity-cell">{balance.reserved_qty}</td>}
                                        <td className="quantity-cell strong">{balance.stock_display?.quantity ?? available} {balance.stock_display?.unit || ''}</td>
                                        {visibleColumns.reorder !== false && <td className="quantity-cell">{balance.min_quantity}</td>}
                                        {visibleColumns.status !== false && <td><StatusBadge status={status} label={t(status === 'danger' ? 'Out' : status === 'warning' ? 'Low' : 'Healthy')} /></td>}
                                        <td className="table-actions-column">
                                            <div className="inline-actions">
                                                {can.history && <Link className="icon-btn small" href={routeWithBase(`/admin/inventory/products/${balance.product_id}`, app_base)} aria-label={t('View stock history')} title={t('View stock history')}><Icon name="history" size={14} /></Link>}
                                                {can.adjust && (
                                                    <Link
                                                        className="icon-btn small"
                                                        href={routeWithBase(`/admin/inventory/adjustments/create?product_unit_id=${balance.product.default_selling_unit?.id || balance.product.base_unit?.id}${balance.location_id ? `&location_id=${balance.location_id}` : ''}`, app_base)}
                                                        aria-label={t('Adjust stock')}
                                                        title={t('Adjust stock')}
                                                    >
                                                        <Icon name="edit" size={14} />
                                                    </Link>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={balances} label={t('products')} />
            </section>
        </AdminLayout>
    );
}
