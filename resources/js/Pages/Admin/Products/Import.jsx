import { Head, Link, useForm } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

function ImportProgress({ processing, progress, t }) {
    if (!processing) return null;

    const percentage = progress?.percentage ?? 0;
    const uploaded = percentage >= 100;

    return (
        <div className="csv-import-progress" aria-live="polite">
            <div className="csv-import-progress__status">
                <span>{uploaded ? t('Upload complete. Processing rows...') : t('Uploading CSV...')}</span>
                <strong>{percentage}%</strong>
            </div>
            <div
                className="csv-import-progress__track"
                role="progressbar"
                aria-label={t('CSV import progress')}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={percentage}
            >
                <span className="csv-import-progress__bar" style={{ width: `${percentage}%` }} />
            </div>
        </div>
    );
}

export default function Import({ categories, app_base }) {
    const t = usePhraseTranslation();
    const { data, setData, post, processing, progress, errors } = useForm({ file: null, create_missing_categories: true });
    const unitPriceForm = useForm({ unit_price_file: null });

    const submit = (event) => {
        event.preventDefault();
        post(routeWithBase('/admin/products/import', app_base), { forceFormData: true });
    };
    const submitUnitPrices = (event) => {
        event.preventDefault();
        unitPriceForm.post(routeWithBase('/admin/products/import/unit-prices', app_base), { forceFormData: true });
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
                    Parent category is optional; leave it blank for a top-level category. A blank category uses the system default
                    “Non-categorized” category. SKU and barcode may be blank, and the system will generate a barcode. Status may be active,
                    inactive, or draft. Existing products are never updated by this import.
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
                            <strong>{t('Create missing categories as active')}</strong>
                            <small className="muted" style={{ display: 'block' }}>
                                New parent and child categories from this import will be immediately available in the catalog.
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
                    <ImportProgress processing={processing} progress={progress} t={t} />
                    <div className="inline-actions" style={{ marginTop: 20 }}>
                        <button className="btn primary" type="submit" disabled={processing || !data.file}>
                            <Icon name="upload" size={14} /> {processing ? t('Importing...') : t('Import products')}
                        </button>
                        <Link className="btn secondary" href={routeWithBase('/admin/products', app_base)}>{t('Cancel')}</Link>
                    </div>
                </form>
            </section>
            <section className="panel glass" style={{ maxWidth: 820, marginTop: 16 }}>
                <PanelHeading eyebrow={t('Existing catalog')} title={t('Import units and selling prices')} />
                <p className="muted">
                    Download the current catalog first. Each row represents one product, unit, and price-type combination.
                    Keep product codes unchanged. Existing units are matched automatically when both unit name and unit code match;
                    a new name-and-code pair creates a new unit.
                </p>
                <div className="inline-actions" style={{ margin: '16px 0' }}>
                    <a className="btn secondary" href={routeWithBase('/admin/products/import/unit-prices/template', app_base)}>
                        <Icon name="download" size={14} /> {t('Export unit and price template')}
                    </a>
                </div>
                <p className="muted">
                    Include the complete unit × price-type matrix for every product in the file. Import updates or adds records; it never deletes units or prices.
                    Every imported price is saved as a manual selling price.
                </p>
                <form onSubmit={submitUnitPrices} style={{ marginTop: 20 }}>
                    <label className="field">
                        <span>{t('Unit and price CSV file')}</span>
                        <input type="file" accept=".csv,text/csv" onChange={(event) => unitPriceForm.setData('unit_price_file', event.target.files?.[0] || null)} />
                    </label>
                    {unitPriceForm.errors.unit_price_file && <div className="flash error" role="alert" style={{ whiteSpace: 'pre-line', marginTop: 12 }}>{unitPriceForm.errors.unit_price_file}</div>}
                    <ImportProgress processing={unitPriceForm.processing} progress={unitPriceForm.progress} t={t} />
                    <div className="inline-actions" style={{ marginTop: 20 }}>
                        <button className="btn primary" type="submit" disabled={unitPriceForm.processing || !unitPriceForm.data.unit_price_file}>
                            <Icon name="upload" size={14} /> {unitPriceForm.processing ? t('Importing...') : t('Import units and prices')}
                        </button>
                    </div>
                </form>
            </section>
        </AdminLayout>
    );
}
