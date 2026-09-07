import { Head, Link, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

function CreditMetricCard({ label, value, caption, icon, tone = 'primary', active = false, onClick }) {
    const t = usePhraseTranslation();

    return (
        <button type="button" className={`metric-card glass credit-kpi-card tone-${tone}${active ? ' is-active' : ''}`} onClick={onClick} aria-pressed={active}>
            <span className="icon-well"><Icon name={icon} size={14} /></span>
            <small>{t(label)}</small>
            <strong>{formatMoney(value)}</strong>
            <p>{caption}</p>
        </button>
    );
}

export default function CreditReport({ customers, filters = {}, aging = {}, collections = [] }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const navigate = (changes) => router.get(routeWithBase('/admin/credit', app_base), { ...filters, ...changes }, { preserveState: true, preserveScroll: true });
    const cards = [
        { label: 'Current', value: aging.current, bucket: 'current', caption: 'Not yet overdue', icon: 'check', tone: 'success' },
        { label: '1–30 days', value: aging.days_1_30, bucket: '1_30', caption: 'Past due', icon: 'history', tone: 'warning' },
        { label: '31–60 days', value: aging.days_31_60, bucket: '31_60', caption: 'Past due', icon: 'history', tone: 'warning' },
        { label: '61–90 days', value: aging.days_61_90, bucket: '61_90', caption: 'Past due', icon: 'history', tone: 'danger' },
        { label: '90+ days', value: aging.days_90_plus, bucket: '90_plus', caption: 'Past due', icon: 'history', tone: 'danger' },
    ];
    const maxCollection = Math.max(1, ...collections.map((row) => Number(row.amount || 0)));
    const hasFilters = Boolean(filters.q || (filters.bucket && filters.bucket !== 'all'));
    const exportHref = routeWithBase(`/admin/credit/export?bucket=${filters.bucket || 'all'}`, app_base);

    const clearFilters = () => router.get(routeWithBase('/admin/credit', app_base), {}, { preserveState: true, preserveScroll: true });

    return (
        <AdminLayout title={t('Credit accounts')} eyebrow={t('Accounts receivable')} action={<a className="btn secondary" href={exportHref}><Icon name="download" size={14} /> {t('Export CSV')}</a>}>
            <Head title={t('Credit accounts')} />

            <div className="credit-report-page">
                <div className="metrics-grid six compact-kpi-strip credit-kpi-strip">
                    <CreditMetricCard label="Total receivable" value={aging.total} caption={`${customers.total || 0} ${t('customer accounts')}`} icon="wallet" active={!filters.bucket || filters.bucket === 'all'} onClick={() => navigate({ bucket: 'all', page: 1 })} />
                    {cards.map((card) => <CreditMetricCard key={card.bucket} {...card} caption={t(card.caption)} active={filters.bucket === card.bucket} onClick={() => navigate({ bucket: card.bucket, page: 1 })} />)}
                </div>

                <section className="panel glass credit-accounts-panel">
                    <PanelHeading eyebrow={t('Accounts receivable')} title={t('Customer credit accounts')} action={<span className="status status-neutral"><span className="status-dot" />{customers.total || 0} {t('shown')}</span>} />

                    <form className="credit-filter-toolbar" aria-label={t('Filter credit accounts')} onSubmit={(event) => { event.preventDefault(); navigate({ q: new FormData(event.currentTarget).get('q'), page: 1 }); }}>
                        <label className="form-field credit-filter__search">
                            <span>{t('Search customers')}</span>
                            <span className="search-box"><Icon name="search" size={15} /><input name="q" type="search" defaultValue={filters.q || ''} placeholder={t('Name, email or phone')} /></span>
                        </label>
                        <label className="form-field credit-filter__bucket">
                            <span>{t('Aging bucket')}</span>
                            <select value={filters.bucket || 'all'} onChange={(event) => navigate({ bucket: event.target.value, page: 1 })}>
                                <option value="all">{t('All aging buckets')}</option>
                                {cards.map(({ label, bucket }) => <option key={bucket} value={bucket}>{t(label)}</option>)}
                            </select>
                        </label>
                        <div className="inline-actions credit-filter__actions">
                            <button className="btn primary" type="submit"><Icon name="search" size={14} /> {t('Search')}</button>
                            {hasFilters && <button className="btn secondary" type="button" onClick={clearFilters}>{t('Clear')}</button>}
                        </div>
                    </form>

                    <div className="table-wrap credit-table-wrap">
                        <table className="credit-table">
                            <thead><tr><th>{t('Customer')}</th><th>{t('Status')}</th><th className="numeric-cell">{t('Invoices')}</th><th>{t('Oldest due')}</th><th className="numeric-cell">{t('Outstanding')}</th><th className="numeric-cell">{t('Overdue')}</th><th className="table-actions-column">{t('Actions')}</th></tr></thead>
                            <tbody>
                                {!customers.data.length ? (
                                    <tr><td colSpan={7}><div className="credit-empty-state"><Icon name="wallet" size={20} /><strong>{t('No credit balances found')}</strong><span className="muted">{t('Try changing the search or aging bucket.')}</span></div></td></tr>
                                ) : customers.data.map((customer) => (
                                    <tr key={customer.id}>
                                        <td><strong>{customer.name}</strong><small>{customer.phone || customer.email || '—'}</small></td>
                                        <td><StatusBadge status={customer.credit_status === 'active' ? 'success' : 'warning'} label={t(customer.credit_status)} /></td>
                                        <td className="numeric-cell">{customer.invoice_count}</td>
                                        <td>{customer.oldest_due_date || '—'}</td>
                                        <td className="money-cell"><strong>{formatMoney(customer.outstanding)}</strong></td>
                                        <td className={`money-cell${Number(customer.overdue) > 0 ? ' text-danger' : ''}`}><strong>{formatMoney(customer.overdue)}</strong></td>
                                        <td className="table-actions-column"><Link className="icon-btn small" href={routeWithBase(`/admin/customers/${customer.id}`, app_base)} aria-label={`${t('Open customer')} ${customer.name}`} title={t('Open customer')}><Icon name="external" size={13} /></Link></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="credit-pagination"><AdminPagination paginator={customers} /></div>
                </section>

                <section className="panel glass credit-collections-panel">
                    <PanelHeading eyebrow={t('Last 30 days')} title={t('Credit collections')} />
                    {!collections.length ? (
                        <div className="credit-empty-state credit-empty-state--compact"><Icon name="chart" size={20} /><strong>{t('No collections yet')}</strong><span className="muted">{t('No credit payments in this period.')}</span></div>
                    ) : (
                        <div className="credit-collection-list">
                            {collections.map((row) => <div className="credit-collection-row" key={row.day}><small>{row.day}</small><div className="credit-collection-track" role="progressbar" aria-label={`${row.day}: ${formatMoney(row.amount)}`} aria-valuemin="0" aria-valuemax={maxCollection} aria-valuenow={Number(row.amount || 0)}><span style={{ width: `${Math.max(2, Number(row.amount) / maxCollection * 100)}%` }} /></div><strong>{formatMoney(row.amount)}</strong></div>)}
                        </div>
                    )}
                </section>
            </div>
        </AdminLayout>
    );
}
