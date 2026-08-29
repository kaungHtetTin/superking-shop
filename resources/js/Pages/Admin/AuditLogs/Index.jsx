import { useState } from 'react';
import { Head, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function AuditLogsIndex({ logs, filters }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const [search, setSearch] = useState(filters.q ?? '');
    const applyFilters = (patch) => router.get(routeWithBase('/admin/audit-logs', app_base), { ...filters, ...patch }, { preserveState: true, replace: true });

    return (
        <AdminLayout title={t('Audit logs')} eyebrow={t('Security')}>
            <Head title={t('Audit Logs')} />
            <section className="panel glass">
                <PanelHeading eyebrow={t('Staff activity')} title={t('Recent actions')} />
                <form className="filter-toolbar compact" onSubmit={(e) => { e.preventDefault(); applyFilters({ q: search || undefined }); }}>
                    <div className="search-box">
                        <Icon name="search" size={16} />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search action or staff...')} />
                    </div>
                    <button type="submit" className="btn primary">{t('Search')}</button>
                </form>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr><th>{t('Action')}</th><th>{t('Staff')}</th><th>{t('Subject')}</th><th>{t('Details')}</th><th>{t('When')}</th></tr>
                        </thead>
                        <tbody>
                            {logs.data.length === 0 ? (
                                <tr><td colSpan={5}><span className="muted">{t('No audit logs found.')}</span></td></tr>
                            ) : logs.data.map((log) => (
                                <tr key={log.id}>
                                    <td><strong>{log.action}</strong></td>
                                    <td><small>{log.user?.name || t('System')}<br />{log.user?.email}</small></td>
                                    <td><small>{log.subject_type ? `${log.subject_type.split('\\').pop()} #${log.subject_id}` : '-'}</small></td>
                                    <td><small>{log.properties ? JSON.stringify(log.properties) : '-'}</small></td>
                                    <td><small>{log.created_at}</small></td>
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
