import { Head } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { usePhraseTranslation } from '@/Utils/i18n';

const metrics = [
    { label: 'Active users', value: '2,431', hint: '+8.3% this week', icon: 'user' },
    { label: 'Total orders', value: '1,240', hint: '+2.1% this week', icon: 'receipt' },
    { label: 'Server status', value: 'Healthy', hint: '100% uptime', icon: 'check' },
    { label: 'Revenue', value: '12,480', hint: '+5.7% this week', icon: 'wallet' },
];

export default function UiShowcase() {
    const t = usePhraseTranslation();

    return (
        <AdminLayout title={t('UI Showcase')} eyebrow={t('Design system reference')}>
            <Head title={t('Admin UI Showcase')} />

            <div className="metrics-grid four compact-kpi-strip">
                {metrics.map((m) => (
                    <article key={m.label} className="metric-card glass">
                        <span className="icon-well">
                            <Icon name={m.icon} size={15} />
                        </span>
                        <small>{t(m.label)}</small>
                        <strong>{m.value}</strong>
                        <p>{t(m.hint)}</p>
                    </article>
                ))}
            </div>

            <section className="panel glass" style={{ marginTop: 10 }}>
                <PanelHeading eyebrow={t('Density')} title={t('Compact console scale')} />
                <div className="filter-toolbar compact showcase-density-toolbar">
                    <div className="search-box">
                        <Icon name="search" size={15} />
                        <input placeholder={t('34 px compact search control')} />
                    </div>
                    <select defaultValue="compact" aria-label={t('Control density example')}>
                        <option value="compact">{t('Compact')}</option>
                        <option value="comfortable">{t('Comfortable')}</option>
                    </select>
                    <button type="button" className="btn primary">
                        {t('Primary action')}
                    </button>
                </div>
            </section>

            <div className="admin-grid">
                <section className="panel glass">
                    <PanelHeading eyebrow={t('Forms')} title={t('Form elements')} />
                    <div className="crud-grid" style={{ padding: 0 }}>
                        <label className="form-field">
                            <span>{t('Project name')}</span>
                            <input defaultValue={t('LaLaPick Admin')} />
                        </label>
                        <label className="form-field">
                            <span>{t('Admin email')}</span>
                            <input defaultValue="admin@lalapick.com" />
                        </label>
                        <label className="form-field span-2">
                            <span>{t('Notes')}</span>
                            <textarea defaultValue={t('Compact operational forms with focus rings.')} />
                        </label>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button type="button" className="btn primary grow">
                            {t('Save changes')}
                        </button>
                        <button type="button" className="btn secondary grow">
                            {t('Cancel')}
                        </button>
                    </div>
                </section>

                <section className="panel glass">
                    <PanelHeading eyebrow={t('Status')} title={t('Semantic badges')} />
                    <div className="stack-sm">
                        <StatusBadge status="success" label={t('Completed')} />
                        <StatusBadge status="warning" label={t('Pending approval')} />
                        <StatusBadge status="danger" label={t('Rejected')} />
                        <StatusBadge status="info" label={t('In progress')} />
                        <StatusBadge status="neutral" label={t('Inactive')} />
                    </div>
                    <div className="alert-list" style={{ marginTop: 14 }}>
                        <div>
                            <span className="alert-icon warning">
                                <Icon name="bell" size={15} />
                            </span>
                            <p>
                                <strong>{t('Storage at 92%')}</strong>
                                <small>{t('Review media uploads - 1m ago')}</small>
                            </p>
                        </div>
                        <div>
                            <span className="alert-icon info">
                                <Icon name="check" size={15} />
                            </span>
                            <p>
                                <strong>{t('API gateway stable')}</strong>
                                <small>{t('All services healthy - 1m ago')}</small>
                            </p>
                        </div>
                    </div>
                </section>
            </div>

            <section className="panel glass" style={{ marginTop: 10 }}>
                <PanelHeading eyebrow={t('Tables')} title={t('Recent activity')} />
                <div className="filter-toolbar compact">
                    <div className="search-box">
                        <Icon name="search" size={16} />
                        <input placeholder={t('Search activity...')} />
                    </div>
                    <select defaultValue="">
                        <option value="">{t('All types')}</option>
                        <option value="order">{t('Orders')}</option>
                        <option value="product">{t('Products')}</option>
                    </select>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('User')}</th>
                                <th>{t('Action')}</th>
                                <th>{t('Date')}</th>
                            <th className="table-actions-column" aria-label={t('Actions')} />
                            </tr>
                        </thead>
                        <tbody>
                            {[1, 2, 3].map((i) => (
                                <tr key={i}>
                                    <td>
                                        <div className="rider-cell">
                                            <span>U{i}</span>
                                            <div>
                                                <strong>{t('User :value', { value: i })}</strong>
                                                <small>{t('Admin session')}</small>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <strong>{t('Updated product pricing')}</strong>
                                        <small>{t('Catalog change')}</small>
                                    </td>
                                    <td>
                                        <small>{t('Jun 9, 2026')}</small>
                                    </td>
                                    <td className="table-actions-column">
                                        <div className="inline-actions">
                                            <button type="button" className="icon-btn small" aria-label={t('More actions')} title={t('More actions')}>
                                                <Icon name="edit" size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </AdminLayout>
    );
}
