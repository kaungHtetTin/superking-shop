import { Head, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function PointConfiguration({ settings = {} }) {
    const { app_base, flash } = usePage().props;
    const t = usePhraseTranslation();
    const form = useForm({
        is_enabled: settings.is_enabled ?? true,
        earn_points_per_currency: settings.earn_points_per_currency ?? 1,
        redeem_currency_per_point: settings.redeem_currency_per_point ?? 0.01,
        minimum_redeem_points: settings.minimum_redeem_points ?? 100,
    });

    const submit = (event) => {
        event.preventDefault();
        form.post(routeWithBase('/admin/marketing/point-configuration', app_base), {
            preserveScroll: true,
        });
    };

    return (
        <AdminLayout title={t('Point Configuration')} eyebrow={t('Marketing')}>
            <Head title={t('Point Configuration')} />
            <AdminFlash flash={flash} errors={form.errors} />

            <form onSubmit={submit} className="stack-sm">
                <section className="panel glass">
                    <PanelHeading eyebrow={t('Super admin')} title={t('Loyalty points settings')} />
                    <div className="crud-grid">
                        <label className="form-field checkbox-row span-2">
                            <input
                                type="checkbox"
                                checked={Boolean(form.data.is_enabled)}
                                onChange={(e) => form.setData('is_enabled', e.target.checked)}
                            />
                            <span>
                                <strong>{t('Enable point system')}</strong>
                                <small className="muted">
                                    {form.data.is_enabled
                                        ? t('Customers can earn and redeem points.')
                                        : t('Customers cannot earn or redeem points while disabled.')}
                                </small>
                            </span>
                            {form.errors.is_enabled && <small className="field-error">{form.errors.is_enabled}</small>}
                        </label>

                        <label className="form-field">
                            <span>{t('Earn points per final amount')}</span>
                            <input
                                type="number"
                                min="0"
                                step="0.0001"
                                value={form.data.earn_points_per_currency}
                                onChange={(e) => form.setData('earn_points_per_currency', e.target.value)}
                            />
                            <small className="muted">{t('Example: 1 means a 1000 final amount earns 1000 points. Use 0.001 for 1 point per 1000.')}</small>
                            {form.errors.earn_points_per_currency && <small className="field-error">{form.errors.earn_points_per_currency}</small>}
                        </label>

                        <label className="form-field">
                            <span>{t('Currency value per point')}</span>
                            <input
                                type="number"
                                min="0"
                                step="0.0001"
                                value={form.data.redeem_currency_per_point}
                                onChange={(e) => form.setData('redeem_currency_per_point', e.target.value)}
                            />
                            <small className="muted">{t('Example: 1 means 1 point discounts 1 currency at checkout.')}</small>
                            {form.errors.redeem_currency_per_point && <small className="field-error">{form.errors.redeem_currency_per_point}</small>}
                        </label>

                        <label className="form-field">
                            <span>{t('Minimum redeem points')}</span>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={form.data.minimum_redeem_points}
                                onChange={(e) => form.setData('minimum_redeem_points', e.target.value)}
                            />
                            <small className="muted">{t('Customers must redeem at least this many points, unless they redeem zero.')}</small>
                            {form.errors.minimum_redeem_points && <small className="field-error">{form.errors.minimum_redeem_points}</small>}
                        </label>
                    </div>
                </section>

                <div className="stack-row" style={{ justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn primary" disabled={form.processing}>
                        <Icon name="check" size={14} />
                        {form.processing ? t('Saving...') : t('Save configuration')}
                    </button>
                </div>
            </form>
        </AdminLayout>
    );
}
