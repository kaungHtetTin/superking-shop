import { useState } from 'react';
import { Head, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
};

const detailText = (properties) => {
    if (!properties) return '—';
    if (typeof properties === 'string') return properties;

    return Object.entries(properties)
        .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
        .join(' · ');
};

export default function AuditLogsIndex({ logs, filters }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const [search, setSearch] = useState(filters.q ?? '');
    const [date, setDate] = useState(filters.date ?? '');
    const applyFilters = (patch) => router.get(routeWithBase('/admin/audit-logs', app_base), { ...filters, ...patch }, { preserveState: true, replace: true });

    const clearFilters = () => {
        setSearch('');
        setDate('');
        applyFilters({ q: undefined, date: undefined, page: undefined });
    };

    return (
        <AdminLayout title={t('Audit logs')} eyebrow={t('Security')}>
            <Head title={t('Audit Logs')} />
            <section className="panel glass">
                <PanelHeading eyebrow={t('Staff activity')} title={t('Recent actions')} />
                <form className="audit-log-filters" onSubmit={(e) => { e.preventDefault(); applyFilters({ q: search || undefined, date: date || undefined, page: undefined }); }}>
                    <label className="form-field">
                        <span>{t('Search')}</span>
                        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search any log field...')} />
                    </label>
                    <label className="form-field">
                        <span>{t('Date')}</span>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </label>
                    <div className="inline-actions" style={{ flexWrap: 'nowrap' }}>
                        <button type="submit" className="btn primary"><Icon name="search" size={14} /> {t('Search')}</button>
                        {(search || date) && <button type="button" className="btn secondary" onClick={clearFilters}>{t('Clear')}</button>}
                    </div>
                </form>
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr><th>{t('Action')}</th><th>{t('Staff')}</th><th>{t('Subject')}</th><th>{t('Details')}</th><th>{t('When')}</th></tr>
                        </thead>
                        <tbody>
                            {logs.data.length === 0 ? (
                                <tr><td colSpan={5}><span className="muted">{t('No audit logs found.')}</span></td></tr>
                            ) : logs.data.map((log) => (
                                <tr key={log.id}>
                                    <td><strong>{log.action}</strong><small className="table-subline">Log #{log.id}</small></td>
                                    <td><small>{log.user?.name || t('System')}<br />{log.user?.email}</small></td>
                                    <td><small>{log.subject_type ? `${log.subject_type.split('\\').pop()} #${log.subject_id}` : '-'}</small></td>
                                    <td><small title={detailText(log.properties)} style={{ display: 'block', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detailText(log.properties)}</small></td>
                                    <td><small title={log.created_at} style={{ whiteSpace: 'nowrap' }}>{formatDateTime(log.created_at)}</small></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={logs} label={t('logs')} />
            </section>
        </AdminLayout>
    );
}
