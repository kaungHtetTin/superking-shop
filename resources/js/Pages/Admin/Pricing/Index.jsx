import { useState } from 'react';
import { Link, router } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { routeWithBase } from '@/Utils/url';
import { PanelHeading } from '@/Components/Admin/shared';
import Icon from '@/Components/Admin/icons';

function PricingShell({ embedded, children, ...props }) { return embedded ? <><PanelHeading eyebrow="Prices" title="Product price types" action={props.action} />{children}</> : <AdminLayout {...props}>{children}</AdminLayout>; }

export default function Index({ rules, filters, app_base, embedded = false }) {
    const [search, setSearch] = useState(filters.q || '');
    const [error, setError] = useState('');
    const base = routeWithBase('/admin/settings/prices', app_base);
    const returnQuery = `?return_q=${encodeURIComponent(filters.q || '')}&return_page=${rules.current_page}`;
    const remove = rule => {
        if (!window.confirm(`Delete ${rule.name}? Saved inactive-product prices will remain Manual.`)) return;
        router.delete(`${base}/${rule.id}${returnQuery}`, { onError: errors => setError(Object.values(errors).join(' ')) });
    };
    return <PricingShell embedded={embedded} title="Prices" eyebrow="Settings" action={<div className="pricing-actions"><Link className="btn primary" href={`${base}/create${returnQuery}`}>New price type</Link></div>}>
        {error && <div className="flash error" role="alert">{error}</div>}
        <section className={embedded ? 'settings-pricing-content' : 'panel pricing-panel'}>
            {!embedded && <h2>Product price types</h2>}<p className={embedded ? 'settings-section-description' : 'muted'}>Automatic prices follow buying cost. Manual overrides are preserved on ordinary rule saves.</p>
            <form className="pricing-search" onSubmit={event => { event.preventDefault(); router.get(base, { q: search }); }}><label className="form-field"><span>Search price types</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Price type name" /></label><button className="btn primary">Search</button></form>
            <div className="table-wrap pricing-rule-table"><table><thead><tr><th>Name</th><th>Mode</th><th>Markup</th><th>Round up to</th><th>Minimum profit</th><th>Active products</th><th className="table-actions-column">Actions</th></tr></thead><tbody>{rules.data.map(rule => <tr key={rule.id}>
                <td data-label="Name"><strong>{rule.name}</strong></td><td data-label="Mode">{rule.pricing_mode === 'automatic' ? 'Automatic' : 'Manual'}</td><td data-label="Markup">{rule.markup_percent}%</td><td data-label="Round up to">{rule.rounding}</td><td data-label="Minimum profit">{rule.minimum_profit}</td><td data-label="Active products">{rule.active_product_count}</td>
                <td data-label="Actions" className="table-actions-column"><div className="inline-actions pricing-row-actions">
                    <Link className="icon-btn small" href={`${base}/${rule.id}/edit${returnQuery}`} aria-label={`Edit ${rule.name}`} title={`Edit ${rule.name}`}><Icon name="edit" size={14} /></Link>
                    <button type="button" className="icon-btn small danger" aria-disabled={!!rule.delete_disabled_reason} aria-label={`Delete ${rule.name}`} aria-describedby={rule.delete_disabled_reason ? `price-delete-reason-${rule.id}` : undefined} title={rule.delete_disabled_reason || `Delete ${rule.name}`} onClick={() => { if (!rule.delete_disabled_reason) remove(rule); }}><Icon name="trash" size={14} /></button>
                    {rule.delete_disabled_reason && <span id={`price-delete-reason-${rule.id}`} className="pricing-action-hint" role="tooltip">{rule.delete_disabled_reason}</span>}
                </div></td>
            </tr>)}</tbody></table>{!rules.data.length && <p className="muted">No price types match your search.</p>}</div>
            <AdminPagination paginator={rules} label="price types" />
        </section>
    </PricingShell>;
}
