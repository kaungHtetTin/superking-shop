import { useEffect, useMemo, useState } from 'react';
import { Head, router } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

const code128Patterns = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const money = formatMoney;

function code128Values(value) {
    const text = String(value || '');
    const values = [104];

    for (const char of text) {
        const code = char.charCodeAt(0);
        values.push(code >= 32 && code <= 127 ? code - 32 : 0);
    }

    const checksum = values.reduce((sum, code, index) => sum + (index === 0 ? code : code * index), 0) % 103;
    return [...values, checksum, 106];
}

function BarcodeSvg({ value }) {
    const bars = useMemo(() => {
        let x = 10;
        const rects = [];

        code128Values(value).forEach((code) => {
            const pattern = code128Patterns[code];
            [...pattern].forEach((width, index) => {
                const moduleWidth = Number(width);
                if (index % 2 === 0) {
                    rects.push({ x, width: moduleWidth });
                }
                x += moduleWidth;
            });
        });

        return { rects, width: x + 10 };
    }, [value]);

    return (
        <svg className="barcode-svg" viewBox={`0 0 ${bars.width} 42`} preserveAspectRatio="none" role="img" aria-label={value}>
            {bars.rects.map((rect, index) => (
                <rect key={`${rect.x}-${index}`} x={rect.x} y="0" width={rect.width} height="42" />
            ))}
        </svg>
    );
}

function BarcodeLabel({ product }) {
    const retail = product.default_selling_unit?.retail_price?.price;
    return (
        <div className="barcode-label">
            <div className="barcode-label-head">
                <strong>{product.name || '-'}</strong>
                <span>{retail != null ? money(retail) : '-'}</span>
            </div>
            <small>{product.product_code} / {product.default_selling_unit?.name || '-'}</small>
            <BarcodeSvg value={product.barcode} />
            <b>{product.barcode}</b>
        </div>
    );
}

export default function Barcodes({ products, categories, filters, app_base }) {
    const t = usePhraseTranslation();
    const productRows = products.data || [];
    const [filterState, setFilterState] = useState({
        q: filters.q || '',
        category_id: filters.category_id || '',
        per_page: filters.per_page || 25,
    });
    const [selected, setSelected] = useState({});
    const [copies, setCopies] = useState({});

    useEffect(() => {
        document.body.classList.add('barcode-print-mode');
        return () => document.body.classList.remove('barcode-print-mode');
    }, []);

    const selectedProducts = useMemo(() => Object.values(selected), [selected]);
    const printItems = useMemo(() => selectedProducts.flatMap((product) => {
        const count = Math.max(1, Number(copies[product.id] || 1));
        return Array.from({ length: count }, (_, index) => ({ product, key: `${product.id}-${index}` }));
    }), [copies, selectedProducts]);

    const applyFilters = (event) => {
        event.preventDefault();
        router.get(routeWithBase('/admin/products/barcodes', app_base), {
            q: filterState.q.trim() || undefined,
            category_id: filterState.category_id || undefined,
            per_page: filterState.per_page,
        }, { preserveState: true, replace: true });
    };

    const resetFilters = () => {
        router.get(routeWithBase('/admin/products/barcodes', app_base));
    };

    const toggleProduct = (product) => {
        setSelected((current) => {
            const next = { ...current };
            if (next[product.id]) {
                delete next[product.id];
            } else {
                next[product.id] = product;
            }
            return next;
        });
        setCopies((current) => ({ ...current, [product.id]: current[product.id] || 1 }));
    };

    const selectVisible = () => {
        setSelected((current) => ({
            ...current,
            ...Object.fromEntries(productRows.map((product) => [product.id, product])),
        }));
        setCopies((current) => ({
            ...current,
            ...Object.fromEntries(productRows.map((product) => [product.id, current[product.id] || 1])),
        }));
    };

    return (
        <AdminLayout
            title={t('Barcode printing')}
            eyebrow={t('Catalog')}
            contentClassName="barcode-print-page"
            action={
                <button type="button" className="btn primary no-print" onClick={() => window.print()} disabled={printItems.length === 0}>
                    <Icon name="download" size={14} />
                    {t('Print labels')}
                </button>
            }
        >
            <Head title={t('Barcode Printing')} />

            <section className="panel glass no-print barcode-list-panel">
                <PanelHeading
                    eyebrow={`${selectedProducts.length} ${t('selected')}`}
                    title={t('Product barcode list')}
                    action={
                        <div className="inline-actions">
                            <button type="button" className="btn secondary" onClick={selectVisible}>{t('Select visible')}</button>
                            <button type="button" className="btn secondary" onClick={() => setSelected({})}>{t('Clear')}</button>
                        </div>
                    }
                />

                <form className="filter-toolbar barcode-filter" onSubmit={applyFilters}>
                    <label className="search-box">
                        <Icon name="search" size={14} />
                        <input
                            value={filterState.q}
                            onChange={(event) => setFilterState({ ...filterState, q: event.target.value })}
                            placeholder={t('Search product, product code, or barcode...')}
                        />
                    </label>
                    <select value={filterState.category_id} onChange={(event) => setFilterState({ ...filterState, category_id: event.target.value })}>
                        <option value="">{t('All categories')}</option>
                        {categories.map((category) => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                    </select>
                    <select value={filterState.per_page} onChange={(event) => setFilterState({ ...filterState, per_page: Number(event.target.value) })}>
                        <option value="10">{t('10 per page')}</option>
                        <option value="25">{t('25 per page')}</option>
                        <option value="50">{t('50 per page')}</option>
                        <option value="100">{t('100 per page')}</option>
                    </select>
                    <button type="submit" className="btn primary">{t('Search')}</button>
                    <button type="button" className="btn secondary" onClick={resetFilters}>{t('Reset')}</button>
                </form>

                <div className="table-wrap barcode-product-table">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('Print')}</th>
                                <th>{t('Product')}</th>
                                <th>{t('Category')}</th>
                                <th>{t('Barcode')}</th>
                                <th>{t('Retail price')}</th>
                                <th>{t('Copies')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {productRows.length === 0 ? (
                                <tr><td colSpan={6}><span className="muted">{t('No products match these filters.')}</span></td></tr>
                            ) : productRows.map((product) => (
                                <tr key={product.id}>
                                    <td>
                                        <input type="checkbox" checked={!!selected[product.id]} onChange={() => toggleProduct(product)} />
                                    </td>
                                    <td>
                                        <strong>{product.name || '-'}</strong>
                                        <small>{product.product_code} / {product.default_selling_unit?.name || '-'}</small>
                                    </td>
                                    <td>{product.category?.name || '-'}</td>
                                    <td><strong>{product.barcode}</strong></td>
                                    <td>{product.default_selling_unit?.retail_price?.price != null ? money(product.default_selling_unit.retail_price.price) : '-'}</td>
                                    <td>
                                        <input
                                            className="barcode-copy-input"
                                            type="number"
                                            min="1"
                                            value={copies[product.id] || 1}
                                            onChange={(event) => setCopies({ ...copies, [product.id]: event.target.value })}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={products} label={t('products')} />
            </section>

            <div className="barcode-print-sheet" aria-hidden={printItems.length === 0}>
                {printItems.map((item) => <BarcodeLabel key={item.key} product={item.product} />)}
            </div>
        </AdminLayout>
    );
}
