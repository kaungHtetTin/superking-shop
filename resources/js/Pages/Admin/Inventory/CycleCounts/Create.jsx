import { useEffect, useState } from 'react';
import axios from 'axios';
import { Head, Link, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function Create({ locations, selectedLocationId }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const form = useForm({ location_id: selectedLocationId || locations[0]?.id || '', product_ids: [], notes: '' });
    const [selected, setSelected] = useState([]);
    const [query, setQuery] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [results, setResults] = useState({ data: [], last_page: 1 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        if (!form.data.location_id) return undefined;
        const abort = new AbortController();
        setLoading(true); setError('');
        axios.get(routeWithBase('/admin/inventory/products/search', app_base), { params: { location_id: form.data.location_id, q: search, group_by_product: 1, paginated: 1, per_page: 15, page }, signal: abort.signal })
            .then(({ data }) => { if (!abort.signal.aborted) setResults(data); })
            .catch((failure) => { if (!abort.signal.aborted) setError(failure.response?.data?.message || t('Could not load products. Try again.')); })
            .finally(() => { if (!abort.signal.aborted) setLoading(false); });
        return () => abort.abort();
    }, [form.data.location_id, search, page, retry]);
    const toggle = (product) => {
        const next = selected.some((item) => item.product_id === product.product_id) ? selected.filter((item) => item.product_id !== product.product_id) : [...selected, product];
        if (next.length > 200) return;
        setSelected(next); form.setData('product_ids', next.map((item) => item.product_id));
    };
    const submit = (event) => { event.preventDefault(); form.post(routeWithBase('/admin/inventory/cycle-counts', app_base)); };
    return <AdminLayout title={t('Start cycle count')} eyebrow={t('Warehouse inventory')} action={<Link className="btn secondary" href={routeWithBase('/admin/inventory/cycle-counts', app_base)}>{t('Back to cycle counts')}</Link>}>
        <Head title={t('Start cycle count')} />
        <section className="panel glass cycle-count-panel">
            <PanelHeading title={t('Select warehouse and products')} eyebrow={t('New count session')} />
            <p className="muted">{t('Choose up to 200 products to count in one warehouse. System quantities and unit costs are captured when you start. Count all physical stock, including reserved items, in base units.')}</p>
            {!locations.length && <div className="flash error">{t('No active accessible warehouses.')}</div>}
            {!!Object.keys(form.errors).length && <div className="flash error">{Object.values(form.errors).map((message, i) => <div key={i}>{message}</div>)}</div>}
            <form className="cycle-count-picker-toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(query); }} aria-label={t('Find products for cycle count')}>
                <label className="form-field cycle-count-picker-search">
                    <span>{t('Search products')}</span>
                    <span className="search-box"><Icon name="search" size={15} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Name, code, SKU, or barcode')} disabled={form.processing} /></span>
                </label>
                <label className="form-field cycle-count-picker-warehouse">
                    <span>{t('Warehouse')}</span>
                    <select disabled={form.processing} value={form.data.location_id} onChange={(event) => { form.setData({ ...form.data, location_id: event.target.value, product_ids: [] }); setSelected([]); setPage(1); }}>
                        <option value="" disabled>{t('Choose warehouse')}</option>
                        {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                    </select>
                </label>
                <button className="btn secondary" type="submit" disabled={loading || !form.data.location_id || form.processing}><Icon name="search" size={14} />{t('Search')}</button>
            </form>
            {error && <div className="flash error">{error} <button type="button" className="btn secondary" onClick={() => setRetry(retry + 1)}>{t('Retry')}</button></div>}
            <div className="table-wrap cycle-count-table cycle-count-picker-table" aria-busy={loading} tabIndex={0} role="region" aria-label={t('Select products to count')}><table><colgroup><col className="cycle-count-picker-check" /><col /><col className="cycle-count-picker-unit" /><col className="cycle-count-picker-stock" /></colgroup><thead><tr>{['Select', 'Product', 'Base unit', 'System quantity'].map((label) => <th key={label}>{t(label)}</th>)}</tr></thead><tbody>
                {loading ? <tr><td colSpan={4}>{t('Loading products...')}</td></tr> : results.data.map((product) => <tr key={product.product_id} className={selected.some((item) => item.product_id === product.product_id) ? 'is-selected' : undefined}><td><label className="cycle-count-picker-checkbox"><input type="checkbox" aria-label={`${t('Select')} ${product.product_name}`} checked={selected.some((item) => item.product_id === product.product_id)} disabled={form.processing || (selected.length >= 200 && !selected.some((item) => item.product_id === product.product_id))} onChange={() => toggle(product)} /></label></td><td><strong>{product.product_name}</strong><small>{product.product_code}</small></td><td>{product.unit_name}</td><td>{Number(product.on_hand_qty).toLocaleString()}</td></tr>)}
                {!loading && !results.data.length && <tr><td colSpan={4}>{t('No products found.')}</td></tr>}
            </tbody></table></div>
            <div className="inline-actions cycle-count-actions"><button className="btn secondary" type="button" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>{t('Previous')}</button><span>{page} / {results.last_page || 1}</span><button className="btn secondary" type="button" disabled={loading || page >= results.last_page} onClick={() => setPage(page + 1)}>{t('Next')}</button></div>
            <form onSubmit={submit}>
                <section className="cycle-count-selected" aria-labelledby="cycle-count-selected-title">
                    <div className="cycle-count-selected-heading">
                        <div><h3 id="cycle-count-selected-title">{t('Selected products')}</h3><span className="muted" aria-live="polite">{selected.length} / 200 {t('products selected')}</span></div>
                        {selected.length > 0 && <button type="button" className="btn secondary" disabled={form.processing} onClick={() => { setSelected([]); form.setData('product_ids', []); }}>{t('Clear selection')}</button>}
                    </div>
                    {selected.length === 0 ? <p className="cycle-count-selected-empty muted">{t('Select products from the table above to add them to this count.')}</p> : (
                        <ul className="cycle-count-selected-list">
                            {selected.map((product) => <li className="cycle-count-selected-item" key={product.product_id}>
                                <span className="cycle-count-selected-icon" aria-hidden="true"><Icon name="check" size={14} /></span>
                                <div className="cycle-count-selected-info"><strong>{product.product_name}</strong><small>{product.product_code} / {product.unit_name}</small></div>
                                <button type="button" className="icon-btn small" disabled={form.processing} onClick={() => toggle(product)} aria-label={`${t('Remove')} ${product.product_name}`} title={t('Remove product')}><Icon name="close" size={14} /></button>
                            </li>)}
                        </ul>
                    )}
                </section>
                <label className="form-field"><span>{t('Notes')}</span><textarea maxLength={2000} value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} /></label>
                <div className="inline-actions cycle-count-actions"><button type="submit" className="btn primary" disabled={form.processing || !form.data.location_id || !selected.length}>{t(form.processing ? 'Starting...' : 'Start count')}</button></div>
            </form>
        </section>
    </AdminLayout>;
}
