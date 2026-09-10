import { Head, Link, useForm } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function Import({ categories, app_base }) {
    const t = usePhraseTranslation();
    const { data, setData, post, processing, errors } = useForm({ file: null, create_missing_categories: true });

    const submit = (event) => {
        event.preventDefault();
        post(routeWithBase('/admin/products/import', app_base), { forceFormData: true });
    };

    return (
        <AdminLayout title={t('Import products')} eyebrow={t('Catalog management')}>
            <Head title={t('Import products')} />
            <AdminFlash />
            <section className="panel glass" style={{ maxWidth: 820 }}>
                <PanelHeading eyebrow={t('CSV bulk import')} title={t('Import base-unit products')} />
                <p className="muted">
                    Download the template, open it in Excel, keep the column names unchanged, then save it as CSV UTF-8.
                    Each product receives one base/default selling unit with conversion factor 1 and a retail price.
                </p>
                <div className="inline-actions" style={{ margin: '16px 0' }}>
                    <a className="btn secondary" href={routeWithBase('/admin/products/import/template', app_base)}>
                        <Icon name="download" size={14} /> {t('Download CSV template')}
                    </a>
                </div>
                <p><strong>{t('Existing categories')}:</strong> {categories.map((category) => category.name).join(', ') || t('None')}</p>
                <p className="muted">
                    Parent category is optional; leave it blank for a top-level category. Category is required. SKU and barcode may be blank,
                    and the system will generate a barcode. Status may be active, inactive, or draft. Existing products are never updated by this import.
                </p>

                <form onSubmit={submit} style={{ marginTop: 20 }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={data.create_missing_categories}
                            onChange={(event) => setData('create_missing_categories', event.target.checked)}
                            style={{ marginTop: 3 }}
                        />
                        <span>
                            <strong>{t('Create missing categories as inactive')}</strong>
                            <small className="muted" style={{ display: 'block' }}>
                                Review and activate them from Categories before customers can see them on the storefront.
                            </small>
                        </span>
                    </label>
                    <label className="field">
                        <span>{t('CSV file')}</span>
                        <input type="file" accept=".csv,text/csv" onChange={(event) => setData('file', event.target.files?.[0] || null)} />
                    </label>
                    {errors.file && (
                        <div
                            role="alert"
                            style={{
                                marginTop: 12,
                                padding: '12px 14px',
                                border: '1px solid #ef4444',
                                borderRadius: 8,
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#dc2626',
                                fontWeight: 600,
                                whiteSpace: 'pre-line',
                            }}
                        >
                            <div style={{ marginBottom: 6 }}>{t('Import validation failed')}</div>
                            {Array.isArray(errors.file)
                                ? errors.file.map((error) => <div key={error}>• {error}</div>)
                                : <div>{errors.file}</div>}
                        </div>
                    )}
                    <div className="inline-actions" style={{ marginTop: 20 }}>
                        <button className="btn primary" type="submit" disabled={processing || !data.file}>
                            <Icon name="upload" size={14} /> {processing ? t('Importing...') : t('Import products')}
                        </button>
                        <Link className="btn secondary" href={routeWithBase('/admin/products', app_base)}>{t('Cancel')}</Link>
                    </div>
                </form>
            </section>
        </AdminLayout>
    );
}
