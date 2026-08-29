import { useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase, storageUrl } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function AdjustmentCreate({ locations, reasons, selectedUnit, selectedLocationId }) {
    const { app_base, app_url } = usePage().props;
    const t = usePhraseTranslation();
    const [processing, setProcessing] = useState(false);
    const form = useForm({
        location_id: selectedLocationId || locations[0]?.id || '',
        reason_code: reasons[0]?.value || 'physical_count',
        counted_quantity: Number(selectedUnit?.balances?.[selectedLocationId] ?? 0) / Math.max(Number(selectedUnit?.conversion_factor || 1), 0.000001),
        notes: '',
    });
    const systemBaseQuantity = Number(selectedUnit?.balances?.[form.data.location_id] ?? 0);
    const systemQuantity = systemBaseQuantity / Math.max(Number(selectedUnit?.conversion_factor || 1), 0.000001);
    const countedQuantity = Number(form.data.counted_quantity || 0);
    const variance = (countedQuantity * Number(selectedUnit?.conversion_factor || 1)) - systemBaseQuantity;
    const imagePath = selectedUnit?.image_path;

    const setLocation = (locationId) => {
        const nextSystemQuantity = Number(selectedUnit?.balances?.[locationId] ?? 0) / Math.max(Number(selectedUnit?.conversion_factor || 1), 0.000001);
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
        <AdminLayout title={t('Adjust stock')} eyebrow={t('Inventory')}>
            <Head title={t('Adjust Stock')} />
            <div className="sticky-toolbar">
                <Link className="back-link" href={routeWithBase('/admin/inventory', app_base)}>
                    <Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} /> {t('Back to stock overview')}
                </Link>
            </div>

            <form onSubmit={submit} className="panel glass adjustment-simple-form">
                <PanelHeading eyebrow={t('Stock correction')} title={t('Update counted quantity')} action={<small className="muted">{t('Product is selected from stock overview.')}</small>} />

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
                        <small>{selectedUnit.product_code} · {selectedUnit.unit_name} ({selectedUnit.unit_code}){selectedUnit.barcode ? ` / ${selectedUnit.barcode}` : ''}</small>
                    </div>
                </div>

                <div className="adjustment-simple-grid">
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
                    <div className="adjustment-quantity-card">
                        <div className="adjustment-quantity-card-inner">
                            <span>{t('System')}</span>
                            <strong>{systemQuantity.toFixed(4)} {selectedUnit.unit_code}</strong>
                        </div>
                    </div>
                    <label className="form-field">
                        <span>{t('Counted')}</span>
                        <input
                            type="number"
                            min="0"
                            value={form.data.counted_quantity}
                            onChange={(event) => form.setData('counted_quantity', event.target.value)}
                            required
                        />
                    </label>
                    <div className={variance < 0 ? 'adjustment-quantity-card negative' : variance > 0 ? 'adjustment-quantity-card positive' : 'adjustment-quantity-card'}>
                        <div className="adjustment-quantity-card-inner">
                            <span>{t('Variance')}</span>
                            <strong>{variance > 0 ? '+' : ''}{variance.toFixed(4)} {t('base')}</strong>
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
                    </label>
                </div>

                <div className="receipt-wizard-actions">
                    <Link className="btn secondary" href={routeWithBase('/admin/inventory', app_base)}>{t('Cancel')}</Link>
                    <button className="btn primary" type="submit" disabled={processing}>
                        <Icon name="check" size={14} /> {t('Create adjustment')}
                    </button>
                </div>
            </form>
        </AdminLayout>
    );
}
