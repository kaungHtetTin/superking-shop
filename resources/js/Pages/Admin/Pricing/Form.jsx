import { useState } from 'react';
import axios from 'axios';
import { Link, useForm } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import { routeWithBase } from '@/Utils/url';
import { automaticPrice } from '@/Utils/automaticPricing';
import { PanelHeading } from '@/Components/Admin/shared';

function PricingShell({ embedded, children, ...props }) { return embedded ? <><PanelHeading eyebrow="Prices" title={props.title} action={props.action} /><p className="settings-section-description">Configure how this price type calculates product selling prices.</p>{children}</> : <AdminLayout {...props}>{children}</AdminLayout>; }

export default function Form({ rule, app_base, embedded = false }) {
    const base = routeWithBase('/admin/settings/prices', app_base);
    const params = new URLSearchParams(window.location.search);
    const back = `${base}?q=${encodeURIComponent(params.get('return_q') || '')}&page=${params.get('return_page') || 1}`;
    const form = useForm({ name: rule?.name || '', pricing_mode: rule?.pricing_mode || 'manual', markup_percent: String(Number(rule?.markup_percent || 0)), rounding: String(rule?.rounding || 1), minimum_profit: String(Number(rule?.minimum_profit || 0)), version: rule?.version, apply_to_existing: false, preview_token: null, return_q: params.get('return_q') || '', return_page: params.get('return_page') || 1 });
    const [cost, setCost] = useState('1000');
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const change = (key, value) => { form.setData({ ...form.data, [key]: value, preview_token: null }); setPreview(null); setError(''); };
    const review = async () => {
        setBusy(true); setError('');
        try { const { data } = await axios.post(`${base}/preview`, { ...form.data, rule_id: rule?.id }); setPreview(data); form.setData('preview_token', data.token); }
        catch (exception) { setError(Object.values(exception.response?.data?.errors || {}).flat().join(' ') || exception.response?.data?.message || 'Could not review pricing. Try again.'); }
        finally { setBusy(false); }
    };
    const submit = event => {
        event.preventDefault();
        const options = { onError: errors => { setError(Object.values(errors).flat().join(' ')); setPreview(null); form.setData('preview_token', null); } };
        rule ? form.patch(`${base}/${rule.id}`, options) : form.post(base, options);
    };
    const amount = automaticPrice(cost, form.data);
    const fieldError = key => form.errors[key] && <small className="field-error" role="alert">{form.errors[key]}</small>;
    return <PricingShell embedded={embedded} title={rule ? 'Edit price type' : 'New price type'} eyebrow="Settings · Prices" action={<Link className="btn secondary" href={back}>Back to prices</Link>}>
        <form className={embedded ? 'settings-pricing-content pricing-rule-form' : 'panel pricing-panel pricing-rule-form'} onSubmit={submit}>
            {(error || Object.keys(form.errors).length > 0) && <div className="flash error" role="alert">{error || Object.values(form.errors).flat().join(' ')}</div>}
            <div className="crud-grid">
                <label className="form-field"><span>Price type name</span><input autoFocus required maxLength={50} value={form.data.name} onChange={event => change('name', event.target.value)} />{fieldError('name')}<small>1–50 characters. Commas and slashes are not allowed.</small></label>
                <label className="form-field"><span>Pricing mode</span><select value={form.data.pricing_mode} onChange={event => { change('pricing_mode', event.target.value); if (event.target.value === 'manual') form.setData({ ...form.data, pricing_mode: 'manual', apply_to_existing: false, preview_token: null }); }}><option value="manual">Manual</option><option value="automatic">Automatic</option></select></label>
                {form.data.pricing_mode === 'automatic' && <>
                    <label className="form-field"><span>Markup (%)</span><input type="number" required min="0" max="1000" step="0.0001" value={form.data.markup_percent} onChange={event => change('markup_percent', event.target.value)} />{fieldError('markup_percent')}</label>
                    <label className="form-field"><span>Rounding increment</span><input type="number" required min="1" max="100000" step="1" value={form.data.rounding} onChange={event => change('rounding', event.target.value)} />{fieldError('rounding')}<small>Always rounds upward in currency units.</small></label>
                    <label className="form-field"><span>Minimum markup over buying cost per base unit</span><input type="number" required min="0" step="1" value={form.data.minimum_profit} onChange={event => change('minimum_profit', event.target.value)} />{fieldError('minimum_profit')}<small>Catalog-price floor before discounts and free items; not guaranteed accounting profit.</small></label>
                    <label className="form-field"><span>Example buying cost</span><input type="number" min="0" step="0.000001" value={cost} onChange={event => setCost(event.target.value)} /><small aria-live="polite">{amount === null ? 'Cost required' : `Selling price ${amount} · Markup over buying cost ${(Number(amount) - Number(cost)).toFixed(2)}`}</small></label>
                </>}
            </div>
            <p className="muted">{form.data.pricing_mode === 'automatic' ? 'Ordinary saves update existing Automatic rows only. New products follow this rule. Other units use the rounded base price × their conversion factor.' : 'Manual mode preserves saved amounts and turns existing Automatic rows into Manual overrides.'}</p>
            {form.data.pricing_mode === 'automatic' && <div className="pricing-impact">
                <label className="summary-toggle"><input type="checkbox" checked={form.data.apply_to_existing} onChange={event => change('apply_to_existing', event.target.checked)} /><span>Apply to all active products, replacing Manual overrides and adding missing prices</span></label>
                {form.data.apply_to_existing && <><button type="button" className="btn secondary" disabled={busy || form.processing} onClick={review}>{busy ? 'Reviewing…' : 'Review impact'}</button>{preview && <div role="status"><h3>Confirm bulk pricing</h3><p>{preview.active_products} active products · {preview.automatic_rows} Automatic rows · {preview.manual_overrides} Manual overrides · {preview.missing_rows} missing rows · {preview.products_without_cost} products without cost.</p><p>Manual overrides will become Automatic. Missing-cost amounts are retained; new missing-cost rows remain unavailable.</p><details><summary>Preview examples (up to 30)</summary><div className="table-wrap"><table><thead><tr><th>Product / unit</th><th>Old</th><th>New</th><th>Buying cost</th></tr></thead><tbody>{preview.examples.map((row, index) => <tr key={index}><td>{row.product} / {row.unit}</td><td>{row.old_price ?? 'Missing'}</td><td>{row.new_price ?? 'Cost required'}</td><td>{row.cost}</td></tr>)}</tbody></table></div></details></div>}</>}
            </div>}
            <div className="pricing-actions"><Link className="btn secondary" href={back}>Cancel</Link><button className="btn primary" disabled={form.processing || busy || (form.data.apply_to_existing && !preview)}>{form.processing ? 'Saving…' : form.data.apply_to_existing ? 'Confirm and apply pricing' : 'Save price type'}</button></div>
        </form>
    </PricingShell>;
}
