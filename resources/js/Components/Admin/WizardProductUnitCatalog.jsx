import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { usePage } from '@/spa/router';
import Icon from '@/Components/Admin/icons';
import { routeWithBase, storageUrl } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

function UnitIdentity({ unit }) {
    const { app_url } = usePage().props;
    const image = unit.image_path ? storageUrl(unit.image_path, app_url) : null;

    return (
        <div className="line-product-identity">
            <span className="receipt-product-thumb" aria-hidden="true">{image ? <img src={image} alt="" /> : <Icon name="box" size={16} />}</span>
            <span><strong>{unit.product_name}</strong><small>{unit.product_code} · {unit.unit_name} ({unit.unit_code})</small></span>
        </div>
    );
}

export default function WizardProductUnitCatalog({
    locationId,
    categories = [],
    selectedUnitIds = [],
    selectedProductIds = [],
    onToggle,
    isDisabled = () => false,
    perPage = 10,
    emptyLabel = 'No product units match these filters.',
}) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const [query, setQuery] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [appliedFilters, setAppliedFilters] = useState({ query: '', categoryId: '' });
    const [catalog, setCatalog] = useState([]);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const requestIdRef = useRef(0);
    const selectedIdSet = new Set(selectedUnitIds.map(Number));
    const selectedProductIdSet = new Set(selectedProductIds.map(Number));

    const loadPage = useCallback(async (nextPage, filters) => {
        if (!locationId) return;
        const requestId = ++requestIdRef.current;
        setLoading(true);
        try {
            const response = await axios.get(routeWithBase('/admin/inventory/products/search', app_base), {
                params: {
                    q: filters.query || undefined,
                    category_id: filters.categoryId || undefined,
                    location_id: locationId,
                    paginated: 1,
                    page: nextPage,
                    per_page: perPage,
                    group_by_product: 1,
                },
            });
            if (requestId !== requestIdRef.current) return;
            const payload = response.data || {};
            const rows = Array.isArray(payload.data) ? payload.data : [];
            setCatalog(rows);
            setPage(Number(payload.current_page || nextPage));
            setLastPage(Number(payload.last_page || 1));
            setTotal(Number(payload.total || rows.length));
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [app_base, locationId, perPage]);

    useEffect(() => {
        const initialFilters = { query: '', categoryId: '' };
        setQuery('');
        setCategoryId('');
        setAppliedFilters(initialFilters);
        setPage(1);
        loadPage(1, initialFilters);
    }, [loadPage]);

    const applyFilters = () => {
        const filters = { query: query.trim(), categoryId };
        setAppliedFilters(filters);
        loadPage(1, filters);
    };
    const changeCategory = (value) => {
        const filters = { query: query.trim(), categoryId: value };
        setCategoryId(value);
        setAppliedFilters(filters);
        loadPage(1, filters);
    };
    const goToPage = (nextPage) => {
        if (loading || nextPage < 1 || nextPage > lastPage || nextPage === page) return;
        loadPage(nextPage, appliedFilters);
    };

    return (
        <div className="wizard-sku-catalog" style={{ '--wizard-sku-columns': 4 }}>
            <div className="receipt-product-toolbar">
                <label className="search-box"><Icon name="search" size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyFilters(); } }} placeholder={t('Product name, code, barcode, or unit')} /></label>
                <label className="receipt-category-select" aria-label={t('Category filter')}><Icon name="tag" size={14} /><select value={categoryId} onChange={(event) => changeCategory(event.target.value)}><option value="">{t('All categories')}</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <button type="button" className="btn secondary" onClick={applyFilters} disabled={loading}>{loading ? t('Loading...') : t('Find products')}</button>
            </div>

            {catalog.length > 0 && <div className="wizard-sku-list-head" aria-hidden="true"><span>{t('Product / Base unit')}</span><span>{t('On hand')}</span><span>{t('Available')}</span><span>{t('Select')}</span></div>}
            <div className="receipt-product-catalog wizard-sku-catalog-scroll wizard-console-frame" aria-busy={loading}>
                {loading && catalog.length === 0 ? <div className="spa-inline-list-skeleton" role="status" aria-label={t('Loading products')}>{Array.from({ length: 6 }, (_, index) => <div className="spa-inline-list-skeleton-row" key={index}><span className="spa-skeleton-block media" /><span className="spa-skeleton-block line" /><span className="spa-skeleton-block line short" /><span className="spa-skeleton-block button" /></div>)}</div> : catalog.length === 0 ? <div className="empty-document-lines">{t(emptyLabel)}</div> : catalog.map((unit) => { const selected = selectedProductIdSet.size > 0 ? selectedProductIdSet.has(Number(unit.product_id)) : selectedIdSet.has(Number(unit.id)); const disabled = isDisabled(unit, selected); return <label key={unit.id} className={`receipt-product-row wizard-sku-row${selected ? ' selected' : ''}`}><UnitIdentity unit={unit} /><span><strong>{unit.on_hand_qty}</strong><small>{unit.unit_code}</small></span><span><strong>{unit.available_qty}</strong><small>{unit.unit_code}</small></span><span className="wizard-sku-check"><input type="checkbox" checked={selected} disabled={disabled} onChange={() => !disabled && onToggle(unit, !selected)} /></span></label>; })}
            </div>

            <div className="receipt-product-pagination" aria-label={t('Product pagination')}>
                <small>{total > 0 ? `${t('Showing')} ${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} ${t('of')} ${total}` : t('No products')}</small>
                <div><button type="button" disabled={loading || page <= 1} onClick={() => goToPage(page - 1)}>{t('Previous')}</button><span className="muted">{t('Page')} {page} {t('of')} {lastPage}</span><button type="button" disabled={loading || page >= lastPage} onClick={() => goToPage(page + 1)}>{t('Next')}</button></div>
            </div>
        </div>
    );
}
