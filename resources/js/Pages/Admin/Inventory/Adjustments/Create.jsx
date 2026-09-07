import { useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase, storageUrl } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

function toDisplayUnitQuantity(baseQuantity, conversionFactor) {
    return Number((Number(baseQuantity || 0) / Math.max(Number(conversionFactor || 1), 0.000001)).toFixed(4));
}

export default function AdjustmentCreate({ locations, reasons, selectedUnit, selectedLocationId }) {
    const { app_base, app_url } = usePage().props;
    const t = usePhraseTranslation();
    const [processing, setProcessing] = useState(false);
    const form = useForm({
        location_id: selectedLocationId || locations[0]?.id || '',
        reason_code: reasons[0]?.value || 'physical_count',
        counted_quantity: toDisplayUnitQuantity(selectedUnit?.balances?.[selectedLocationId], selectedUnit?.conversion_factor),
        notes: '',
    });
    const systemBaseQuantity = Number(selectedUnit?.balances?.[form.data.location_id] ?? 0);
    const systemQuantity = systemBaseQuantity / Math.max(Number(selectedUnit?.conversion_factor || 1), 0.000001);
    const countedQuantity = Number(form.data.counted_quantity || 0);
    const conversionFactor = Number(selectedUnit?.conversion_factor || 1);
    const rawVariance = (countedQuantity * conversionFactor) - systemBaseQuantity;
    const displayPrecisionTolerance = (0.00005 * conversionFactor) + 0.0000001;
    const variance = Math.abs(rawVariance) < displayPrecisionTolerance ? 0 : rawVariance;
    const imagePath = selectedUnit?.image_path;
    const quantity = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
    const varianceTone = variance < 0 ? 'negative' : variance > 0 ? 'positive' : 'neutral';
    const varianceLabel = variance < 0 ? 'Stock decrease' : variance > 0 ? 'Stock increase' : 'No change';

    const setLocation = (locationId) => {
        const nextSystemQuantity = toDisplayUnitQuantity(selectedUnit?.balances?.[locationId], selectedUnit?.conversion_factor);
        form.setData({
            ...form.data,
            location_id: locationId,
            counted_quantity: nextSystemQuantity,
            notes: '',
        });
    };

    const submit = (event) => {
        event.preventDefault();
        form.clearErrors();
        router.post(routeWithBase('/admin/inventory/adjustments', app_base), {
            location_id: form.data.location_id,
            reason_code: form.data.reason_code,
            notes: form.data.notes,
            items: [{
                product_unit_id: selectedUnit.id,
                counted_quantity: form.data.counted_quantity,
                notes: form.data.notes,
            }],
        }, {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onError: (errors) => form.setError(errors),
        });
    };

    return (
        <AdminLayout
            title={t('Adjust stock')}
            eyebrow={t('Inventory')}
            contentClassName="adjustment-create-page"
            action={<Link className="btn secondary" href={routeWithBase('/admin/inventory', app_base)}><Icon name="arrowLeft" size={14} /> {t('Back to stock')}</Link>}
        >
            <Head title={t('Adjust Stock')} />

            <form onSubmit={submit} className="panel glass adjustment-simple-form">
                <PanelHeading eyebrow={t('Stock correction')} title={t('Update counted quantity')} action={<small className="muted">{t('Enter the quantity physically available.')}</small>} />

                {Object.keys(form.errors).length > 0 && (
                    <div className="flash error">
                        {Object.values(form.errors).map((error) => <div key={error}>{error}</div>)}
                    </div>
                )}

                <div className="adjustment-product-card">
                    <span className="receipt-product-thumb" aria-hidden="true">
                        {imagePath ? <img src={storageUrl(imagePath, app_url)} alt="" /> : <Icon name="box" size={16} />}
                    </span>
                    <div>
                        <strong>{selectedUnit.product_name}</strong>
                        <small>{selectedUnit.product_code} · {selectedUnit.unit_name} ({selectedUnit.unit_code}){selectedUnit.barcode ? ` · ${selectedUnit.barcode}` : ''}</small>
                    </div>
                </div>

                <div className="adjustment-form-fields">
                    <div className="adjustment-primary-fields">
                        <label className="form-field">
                            <span>{t('Warehouse')}</span>
                            <select value={form.data.location_id} onChange={(event) => setLocation(event.target.value)} required>
                                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                            </select>
                        </label>
                        <label className="form-field">
                            <span>{t('Reason')}</span>
                            <select value={form.data.reason_code} onChange={(event) => form.setData('reason_code', event.target.value)} required>
                                {reasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                            </select>
                        </label>
                    </div>

                    <div className="adjustment-count-fields">
                        <div className="adjustment-quantity-card">
                            <span>{t('System quantity')}</span>
                            <strong>{quantity(systemQuantity)} <small>{selectedUnit.unit_code}</small></strong>
                            <small>{t('Current recorded stock')}</small>
                        </div>
                        <label className="form-field adjustment-counted-field">
                            <span>{t('Counted quantity')}</span>
                            <input
                                type="number"
                                min="0"
                                step="0.0001"
                                inputMode="decimal"
                                value={form.data.counted_quantity}
                                onChange={(event) => form.setData('counted_quantity', event.target.value)}
                                required
                            />
                            <small>{selectedUnit.unit_name} ({selectedUnit.unit_code})</small>
                        </label>
                        <div className={`adjustment-quantity-card ${varianceTone}`}>
                            <span>{t('Variance')}</span>
                            <strong>{variance > 0 ? '+' : ''}{quantity(variance)} <small>{t('base')}</small></strong>
                            <small>{t(varianceLabel)}</small>
                        </div>
                    </div>

                    <label className="form-field adjustment-note-field">
                        <span>{t(variance < 0 ? 'Loss note' : 'Adjustment note')}</span>
                        <input
                            value={form.data.notes}
                            onChange={(event) => form.setData('notes', event.target.value)}
                            placeholder={t(variance < 0 ? 'Required for stock loss' : 'Optional note')}
                            required={variance < 0}
                        />
                        <small>{variance < 0 ? t('Explain why recorded stock is being reduced.') : t('Add context for this adjustment if needed.')}</small>
                    </label>
                </div>

                <div className="adjustment-form-actions">
                    <Link className="btn secondary" href={routeWithBase('/admin/inventory', app_base)}>{t('Cancel')}</Link>
                    <button className="btn primary" type="submit" disabled={processing || variance === 0}>
                        <Icon name="check" size={14} /> {processing ? t('Saving...') : t('Create adjustment')}
                    </button>
                </div>
            </form>
        </AdminLayout>
    );
}
