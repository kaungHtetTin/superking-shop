import { useEffect, useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { ColumnVisibilityControl, PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase, storageUrl } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';
import { formatCompoundQuantity } from '@/Utils/unitLabel';

export default function Index({ products, categories = [], filters = {}, app_base }) {
    const { app_url, flash, errors: pageErrors } = usePage().props;
    const { delete: destroy, patch } = useForm({});
    const serverProductRows = products.data || products;
    const [productRows, setProductRows] = useState(serverProductRows);
    const [deleteNotice, setDeleteNotice] = useState('');
    const t = usePhraseTranslation();
    const [visibleColumns, setVisibleColumns] = useState({ category: true, stock: true, status: true });
    const [filterDraft, setFilterDraft] = useState({
        q: filters.q || '',
        category_id: String(filters.category_id || ''),
        stock: filters.stock || '',
        status: filters.status || '',
    });
    const toggleColumn = (key) => setVisibleColumns((current) => ({ ...current, [key]: current[key] === false }));

    useEffect(() => {
        setProductRows(serverProductRows);
    }, [products]);

    useEffect(() => {
        setFilterDraft({
            q: filters.q || '',
            category_id: String(filters.category_id || ''),
            stock: filters.stock || '',
            status: filters.status || '',
        });
    }, [filters.q, filters.category_id, filters.stock, filters.status]);

    const navigateWithFilters = (nextFilters) => {
        const params = Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value !== '' && value != null));
        router.get(routeWithBase('/admin/products', app_base), params, { preserveScroll: true });
    };

    const applyFilters = (event) => {
        event.preventDefault();
        navigateWithFilters(filterDraft);
    };

    const applySelectFilter = (key, value) => {
        const next = { ...filterDraft, [key]: value };
        setFilterDraft(next);
        navigateWithFilters(next);
    };

    const resetFilters = () => {
        const empty = { q: '', category_id: '', stock: '', status: '' };
        setFilterDraft(empty);
        navigateWithFilters(empty);
    };

    const handleDelete = (id) => {
        if (confirm(t('Are you sure you want to delete this product?'))) {
            const previousRows = productRows;
            setProductRows((rows) => rows.filter((product) => Number(product.id) !== Number(id)));
            destroy(routeWithBase(`/admin/products/${id}`, app_base), {
                preserveScroll: true,
                onSuccess: () => {
                    setProductRows((rows) => rows.filter((product) => Number(product.id) !== Number(id)));
                    setDeleteNotice(t('Product deleted successfully.'));
                    window.setTimeout(() => setDeleteNotice(''), 3000);
                },
                onError: () => setProductRows(previousRows),
            });
        }
    };

    const handleToggleStatus = (product) => {
        const action = product.status === 'active' ? 'deactivate' : 'activate';
        if (confirm(t(`Are you sure you want to ${action} this product?`))) {
            patch(routeWithBase(`/admin/products/${product.id}/toggle-status`, app_base), { preserveScroll: true });
        }
    };

    const defaultRetailPrice = (product) => product.default_selling_unit?.prices?.find((price) => price.price_type === 'retail')?.price;

    const getTotalStock = (product) => product.total_on_hand ?? 0;

    return (
        <AdminLayout
            title={t('Products')}
            eyebrow={t('Catalog management')}
            action={
                <div className="inline-actions">
                    <Link href={routeWithBase('/admin/products/import', app_base)} className="btn secondary">
                        <Icon name="upload" size={14} />
                        {t('Import new products')}
                    </Link>
                    <a href={routeWithBase('/admin/products/export', app_base)} className="btn secondary">
                        <Icon name="download" size={14} />
                        {t('Export CSV')}
                    </a>
                    <Link href={routeWithBase('/admin/products/barcodes', app_base)} className="btn secondary">
                        <Icon name="barcode" size={14} />
                        {t('Print barcodes')}
                    </Link>
                    <Link href={routeWithBase('/admin/products/create', app_base)} className="btn primary">
                        <Icon name="plus" size={14} />
                        {t('Add product')}
                    </Link>
                </div>
            }
        >
            <Head title={t('Manage Products')} />
            <AdminFlash flash={flash} errors={pageErrors} />
            {deleteNotice && <div className="flash success">{deleteNotice}</div>}

            <section className="panel glass">
                <PanelHeading
                    eyebrow={t('Inventory')}
                    title={t('Shop products')}
                    action={
                        <ColumnVisibilityControl
                            columns={[
                                { key: 'product', label: 'Product', locked: true },
                                { key: 'category', label: 'Category' },
                                { key: 'price', label: 'Price', locked: true },
                                { key: 'stock', label: 'Stock' },
                                { key: 'status', label: 'Status' },
                            ]}
                            visible={visibleColumns}
                            onToggle={toggleColumn}
                        />
                    }
                />
                <form className="inventory-filterbar" onSubmit={applyFilters} aria-label={t('Filter products')}>
                    <div className="search-box">
                        <Icon name="search" size={15} />
                        <input
                            value={filterDraft.q}
                            onChange={(event) => setFilterDraft((current) => ({ ...current, q: event.target.value }))}
                            placeholder={t('Name, code, SKU, or barcode')}
                            aria-label={t('Search products')}
                        />
                    </div>
                    <select value={filterDraft.category_id} onChange={(event) => applySelectFilter('category_id', event.target.value)} aria-label={t('Category')}>
                        <option value="">{t('All categories')}</option>
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                    <select value={filterDraft.stock} onChange={(event) => applySelectFilter('stock', event.target.value)} aria-label={t('Stock')}>
                        <option value="">{t('All stock levels')}</option>
                        <option value="in_stock">{t('In stock')}</option>
                        <option value="low_stock">{t('Low stock')}</option>
                        <option value="out_of_stock">{t('Out of stock')}</option>
                    </select>
                    <select value={filterDraft.status} onChange={(event) => applySelectFilter('status', event.target.value)} aria-label={t('Status')}>
                        <option value="">{t('All statuses')}</option>
                        <option value="active">{t('Active')}</option>
                        <option value="inactive">{t('Inactive')}</option>
                        <option value="draft">{t('Draft')}</option>
                    </select>
                    <button type="submit" className="icon-btn" aria-label={t('Search')} title={t('Search')}><Icon name="search" size={15} /></button>
                    <button type="button" className="icon-btn" onClick={resetFilters} aria-label={t('Reset filters')} title={t('Reset filters')}><Icon name="close" size={15} /></button>
                </form>
                <div className="table-wrap">
                    <table className="products-table">
                        <thead>
                            <tr>
                                <th>{t('Product')}</th>
                                {visibleColumns.category !== false && <th>{t('Category')}</th>}
                                <th className="numeric-cell">{t('Price')}</th>
                                {visibleColumns.stock !== false && <th className="numeric-cell">{t('Stock')}</th>}
                                {visibleColumns.status !== false && <th>{t('Status')}</th>}
                                <th className="table-actions-column" />
                            </tr>
                        </thead>
                        <tbody>
                            {productRows.length === 0 ? (
                                <tr>
                                    <td colSpan={3 + Object.values(visibleColumns).filter(Boolean).length}>
                                        <span className="muted">{t('No products found.')}</span>
                                    </td>
                                </tr>
                            ) : (
                                productRows.map((product) => {
                                    const stock = getTotalStock(product);
                                    const hasHistory = Boolean(product.has_inventory_history || product.has_sales_history);
                                    const status = product.status === 'active' ? 'success' : product.status === 'draft' ? 'warning' : 'neutral';

                                    return (
                                        <tr key={product.id}>
                                            <td>
                                                <div className="rider-cell">
                                                    {product.primary_image ? (
                                                        <img
                                                            src={storageUrl(product.primary_image.image_path, app_url)}
                                                            alt=""
                                                            style={{
                                                                width: 32,
                                                                height: 32,
                                                                borderRadius: 6,
                                                                objectFit: 'cover',
                                                            }}
                                                        />
                                                    ) : (
                                                        <span>
                                                            <Icon name="image" size={13} />
                                                        </span>
                                                    )}
                                                    <div>
                                                        <strong>{product.name}</strong>
                                                        <small>{[product.product_code, product.sku, product.default_selling_unit?.name || t('No selling unit')].filter(Boolean).join(' · ')}</small>
                                                    </div>
                                                </div>
                                            </td>
                                            {visibleColumns.category !== false && <td>{product.category?.name || '-'}</td>}
                                            <td className="numeric-cell">
                                                <strong>{defaultRetailPrice(product) != null ? formatMoney(defaultRetailPrice(product)) : '-'}</strong>
                                            </td>
                                            {visibleColumns.stock !== false && <td className="numeric-cell">
                                                <strong style={{ color: stock <= Number(product.min_quantity || 0) ? '#ce4444' : undefined }}>
                                                    {formatCompoundQuantity(stock, product.units)}
                                                </strong>
                                            </td>}
                                            {visibleColumns.status !== false && <td>
                                                <StatusBadge status={status} label={t(product.status || 'active')} />
                                                {product.is_featured && (
                                                    <StatusBadge status="info" label={t('FEATURED')} />
                                                )}
                                            </td>}
                                            <td className="table-actions-column">
                                                <div className="inline-actions">
                                                    <Link
                                                        href={`${routeWithBase(`/admin/products/${product.id}/edit`, app_base)}?return_page=${products.current_page || 1}`}
                                                        className="icon-btn small"
                                                        aria-label={t('Edit product')}
                                                        title={t('Edit product')}
                                                    >
                                                        <Icon name="edit" size={13} />
                                                    </Link>
                                                    {hasHistory ? (
                                                        <button
                                                            type="button"
                                                            className={`icon-btn small ${product.status === 'active' ? 'danger' : ''}`}
                                                            aria-label={t(product.status === 'active' ? 'Deactivate product' : 'Activate product')}
                                                            title={t(product.status === 'active'
                                                                ? 'This product has history and cannot be deleted. Deactivate it instead.'
                                                                : 'Activate product')}
                                                            onClick={() => handleToggleStatus(product)}
                                                        >
                                                            <Icon name={product.status === 'active' ? 'close' : 'check'} size={13} />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="icon-btn small danger"
                                                            aria-label={t('Delete product')}
                                                            title={t('Delete product permanently')}
                                                            onClick={() => handleDelete(product.id)}
                                                        >
                                                            <Icon name="trash" size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={products} label={t('products')} />
            </section>
        </AdminLayout>
    );
}
