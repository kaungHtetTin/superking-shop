import { useState } from 'react';
import { Head, Link, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function Index({ counts, locations, filters, canCreate }) {
    const { app_base, flash, errors } = usePage().props;
    const t = usePhraseTranslation();
    const [draft, setDraft] = useState({ location_id: filters.location_id || '', status: filters.status || '', q: filters.q || '' });
    const apply = (event) => { event.preventDefault(); router.get(routeWithBase('/admin/inventory/cycle-counts', app_base), draft); };
    return <AdminLayout title={t('Cycle Counting')} eyebrow={t('Warehouse inventory')} action={canCreate && <Link className="btn primary" href={routeWithBase(`/admin/inventory/cycle-counts/create${draft.location_id ? `?location_id=${draft.location_id}` : ''}`, app_base)}>{t('Start cycle count')}</Link>}>
        <Head title={t('Cycle Counting')} /><AdminFlash flash={flash} errors={errors} />
        <section className="panel glass cycle-count-panel">
            <PanelHeading title={t('Warehouse count sessions')} eyebrow={t('Physical inventory')} />
            <form className="cycle-count-filters" onSubmit={apply}>
                <label className="form-field"><span>{t('Count number')}</span><input value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} /></label>
                <label className="form-field"><span>{t('Warehouse')}</span><select value={draft.location_id} onChange={(e) => setDraft({ ...draft, location_id: e.target.value })}><option value="">{t('All accessible warehouses')}</option>{locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select></label>
                <label className="form-field"><span>{t('Status')}</span><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}><option value="">{t('All statuses')}</option>{['draft', 'posted', 'cancelled'].map((status) => <option key={status} value={status}>{t(status)}</option>)}</select></label>
                <button className="btn secondary" type="submit">{t('Apply')}</button>
                <Link className="btn secondary" href={routeWithBase('/admin/inventory/cycle-counts', app_base)}>{t('Reset')}</Link>
            </form>
            <div className="table-wrap cycle-count-table" tabIndex={0} role="region" aria-label={t('Cycle count sessions')}><table><thead><tr>{['Count', 'Warehouse', 'Products', 'Created by', 'Created at', 'Status', 'Actions'].map((label) => <th key={label}>{t(label)}</th>)}</tr></thead><tbody>
                {!counts.data.length && <tr><td colSpan={7}>{t('No cycle counts found.')}</td></tr>}
                {counts.data.map((count) => <tr key={count.id}><td><Link href={routeWithBase(`/admin/inventory/cycle-counts/${count.id}`, app_base)}>{count.count_number}</Link></td><td>{count.location.name}</td><td>{count.items_count}</td><td>{count.creator?.name}</td><td>{new Date(count.created_at).toLocaleString()}</td><td><StatusBadge status={count.status === 'posted' ? 'success' : count.status === 'draft' ? 'warning' : 'neutral'} label={t(count.status)} /></td><td className="table-actions-column"><Link className="btn secondary" href={routeWithBase(`/admin/inventory/cycle-counts/${count.id}`, app_base)}>{t('Review')}</Link></td></tr>)}
            </tbody></table></div>
            <AdminPagination paginator={counts} label={t('count sessions')} />
        </section>
    </AdminLayout>;
}
