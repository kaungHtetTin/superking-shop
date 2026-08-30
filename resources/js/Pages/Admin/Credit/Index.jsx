import { Head, Link, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

export default function CreditReport({ customers, filters = {}, aging = {}, collections = [] }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const navigate = (changes) => router.get(routeWithBase('/admin/credit', app_base), { ...filters, ...changes }, { preserveState: true, preserveScroll: true });
    const cards = [
        ['Current', aging.current, 'current'], ['1–30 days', aging.days_1_30, '1_30'], ['31–60 days', aging.days_31_60, '31_60'], ['61–90 days', aging.days_61_90, '61_90'], ['90+ days', aging.days_90_plus, '90_plus'],
    ];
    const maxCollection = Math.max(1, ...collections.map((row) => Number(row.amount || 0)));

    return <AdminLayout title={t('Credit accounts')} eyebrow={t('Accounts receivable')}>
        <Head title={t('Credit accounts')} />
        <section className="panel glass" style={{ marginBottom: 14 }}>
            <div className="stack-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <PanelHeading eyebrow={t('Aging report')} title={t('Outstanding customer credit')} />
                <a className="btn secondary" href={routeWithBase(`/admin/credit/export?bucket=${filters.bucket || 'all'}`, app_base)}><Icon name="download" size={14} />{t('Export CSV')}</a>
            </div>
            <div className="metrics-grid four" style={{ marginTop: 12 }}>
                <article className="metric-card glass"><small>{t('Total receivable')}</small><strong>{formatMoney(aging.total)}</strong><p>{customers.total || 0} {t('customer accounts')}</p></article>
                {cards.map(([label, value, bucket]) => <button type="button" key={bucket} className={`metric-card glass${filters.bucket === bucket ? ' is-active' : ''}`} style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => navigate({ bucket, page: 1 })}><small>{t(label)}</small><strong>{formatMoney(value)}</strong><p>{t(bucket === 'current' ? 'Not yet overdue' : 'Past due')}</p></button>)}
            </div>
        </section>

        <section className="panel glass" style={{ marginBottom: 14 }}>
            <form className="toolbar" onSubmit={(event) => { event.preventDefault(); navigate({ q: new FormData(event.currentTarget).get('q'), page: 1 }); }}>
                <label className="search-box"><Icon name="search" size={15} /><input name="q" defaultValue={filters.q || ''} placeholder={t('Search customer, email or phone')} /></label>
                <select value={filters.bucket || 'all'} onChange={(e) => navigate({ bucket: e.target.value, page: 1 })}><option value="all">{t('All aging buckets')}</option>{cards.map(([label, , bucket]) => <option key={bucket} value={bucket}>{t(label)}</option>)}</select>
                <button className="btn primary" type="submit">{t('Search')}</button>
            </form>
            <div className="table-wrap">
                <table><thead><tr><th>{t('Customer')}</th><th>{t('Status')}</th><th>{t('Invoices')}</th><th>{t('Oldest due')}</th><th>{t('Outstanding')}</th><th>{t('Overdue')}</th><th /></tr></thead>
                    <tbody>{!customers.data.length ? <tr><td colSpan={7}><span className="muted">{t('No credit balances match these filters.')}</span></td></tr> : customers.data.map((customer) => <tr key={customer.id}>
                        <td><strong>{customer.name}</strong><small>{customer.phone || customer.email || '-'}</small></td>
                        <td><StatusBadge status={customer.credit_status === 'active' ? 'success' : 'warning'} label={t(customer.credit_status)} /></td>
                        <td>{customer.invoice_count}</td><td>{customer.oldest_due_date || '-'}</td><td><strong>{formatMoney(customer.outstanding)}</strong></td><td><strong style={{ color: Number(customer.overdue) > 0 ? 'var(--danger)' : undefined }}>{formatMoney(customer.overdue)}</strong></td>
                        <td><Link className="btn secondary small" href={routeWithBase(`/admin/customers/${customer.id}`, app_base)}>{t('Open')}</Link></td>
                    </tr>)}</tbody>
                </table>
            </div>
            <AdminPagination paginator={customers} />
        </section>

        <section className="panel glass">
            <PanelHeading eyebrow={t('Last 30 days')} title={t('Credit collections')} />
            {!collections.length ? <p className="muted">{t('No credit payments in this period.')}</p> : <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>{collections.map((row) => <div key={row.day} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 130px', alignItems: 'center', gap: 10 }}><small>{row.day}</small><div style={{ height: 8, borderRadius: 8, background: 'var(--surface-muted)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${Math.max(2, Number(row.amount) / maxCollection * 100)}%`, background: 'var(--accent)' }} /></div><strong style={{ textAlign: 'right' }}>{formatMoney(row.amount)}</strong></div>)}</div>}
        </section>
    </AdminLayout>;
}
