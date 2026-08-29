import { useMemo, useState } from 'react';
import { useForm, usePage } from '@/spa/router';
import Icon from '@/Components/Admin/icons';
import { PanelHeading } from '@/Components/Admin/shared';
import WizardProductUnitCatalog from '@/Components/Admin/WizardProductUnitCatalog';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

const steps = [{ key: 'route', label: 'Route' }, { key: 'products', label: 'Products' }, { key: 'details', label: 'Quantities' }, { key: 'review', label: 'Review' }];

function Stat({ label, value }) { const t = usePhraseTranslation(); return <div className="metric-card" style={{ padding: 12 }}><span>{t(label)}</span><strong>{value}</strong></div>; }
function UnitIdentity({ unit }) { return <div className="line-product-identity"><span className="receipt-product-thumb" aria-hidden="true"><Icon name="box" size={16} /></span><span><strong>{unit.product_name}</strong><small>{unit.product_code} · {unit.unit_name} ({unit.unit_code})</small></span></div>; }

export default function TransferDocumentForm({ locations, categories = [] }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const firstSource = locations[0]?.id || '';
    const [step, setStep] = useState(0);
    const form = useForm({ source_location_id: firstSource, destination_location_id: locations.find((location) => String(location.id) !== String(firstSource))?.id || '', items: [] });
    const destinations = locations.filter((location) => String(location.id) !== String(form.data.source_location_id));
    const sourceLocation = locations.find((location) => String(location.id) === String(form.data.source_location_id));
    const destinationLocation = locations.find((location) => String(location.id) === String(form.data.destination_location_id));

    const addUnit = (unit) => {
        if (form.data.items.some((item) => Number(item.product_id) === Number(unit.product_id))) return;
        form.clearErrors('items');
        form.setData('items', [...form.data.items, { product_id: unit.product_id, product_unit_id: unit.id, unit, requested_quantity: 1 }]);
    };
    const patchItem = (index, patch) => form.setData('items', form.data.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
    const removeItem = (productId) => form.setData('items', form.data.items.filter((item) => Number(item.product_id) !== Number(productId)));
    const selectedProductIds = useMemo(() => new Set(form.data.items.map((item) => Number(item.product_id))), [form.data.items]);
    const setSource = (sourceId) => {
        form.setData({ ...form.data, source_location_id: sourceId, destination_location_id: locations.find((location) => String(location.id) !== String(sourceId))?.id || '', items: [] });
    };
    const totalSelectedQuantity = useMemo(() => form.data.items.reduce((sum, item) => sum + Number(item.requested_quantity || 0), 0), [form.data.items]);
    const totalBaseQuantity = useMemo(() => form.data.items.reduce((sum, item) => sum + Number(item.requested_quantity || 0) * Number(item.unit?.conversion_factor || 1), 0), [form.data.items]);
    const routeComplete = Boolean(form.data.source_location_id && form.data.destination_location_id && String(form.data.source_location_id) !== String(form.data.destination_location_id));
    const productsComplete = routeComplete && form.data.items.length > 0;
    const detailsComplete = productsComplete && form.data.items.every((item) => { const quantity = Number(item.requested_quantity); return Number.isFinite(quantity) && quantity > 0 && quantity <= Number(item.unit?.available_qty || 0); });
    const canAccess = (index) => index === 0 || (index === 1 && routeComplete) || (index === 2 && productsComplete) || (index === 3 && detailsComplete);
    const canContinue = step === 0 ? routeComplete : step === 1 ? productsComplete : detailsComplete;
    const updateQuantity = (index, value) => {
        if (value === '') return patchItem(index, { requested_quantity: '' });
        const quantity = Number(value);
        if (Number.isFinite(quantity)) patchItem(index, { requested_quantity: Math.max(0, quantity) });
    };
    const toggleUnit = (unit, selected) => selected ? addUnit(unit) : removeItem(unit.product_id);
    const submit = () => {
        if (!detailsComplete || form.processing) return;
        form.transform((data) => ({ ...data, items: data.items.map(({ unit, ...item }) => item) }));
        form.post(routeWithBase('/admin/inventory/transfers', app_base), { preserveScroll: true, onError: (errors) => { const first = Object.keys(errors)[0] || ''; setStep(first.startsWith('items.') ? 2 : first === 'items' ? 1 : 0); } });
    };
    const next = () => canContinue && setStep((value) => Math.min(3, value + 1));

    return <form onSubmit={(event) => { event.preventDefault(); step < 3 ? next() : submit(); }} className="admin-wizard transfer-wizard" noValidate>
        {Object.keys(form.errors).length > 0 && <div className="flash error">{Object.values(form.errors).map((error, index) => <div key={`${index}-${error}`}>{error}</div>)}</div>}
        <section className="panel glass">
            <div className="wizard-toolbar"><div className="tab-bar wizard-stepper" role="tablist" aria-label={t('Transfer form steps')}>{steps.map((item, index) => <button key={item.key} type="button" className={step === index ? 'active' : index < step ? 'is-complete' : ''} disabled={!canAccess(index)} onClick={() => canAccess(index) && setStep(index)} aria-current={step === index ? 'step' : undefined}><span className="wizard-step-number">{index < step ? <Icon name="check" size={13} /> : index + 1}</span><span className="wizard-step-label">{t(item.label)}</span></button>)}</div><div className="wizard-toolbar-actions"><button type="button" className="btn secondary" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>{t('Previous')}</button>{step < 3 ? <button type="button" className="btn primary" disabled={!canContinue} onClick={next}>{t('Next')}</button> : <button type="button" className="btn primary" disabled={form.processing || !detailsComplete} onClick={submit}><Icon name="check" size={14} />{form.processing ? t('Transferring...') : t('Transfer stock')}</button>}</div></div>

            {step === 0 && <><PanelHeading eyebrow={t('Step 1')} title={t('Choose the warehouses')} /><div className="receipt-basic-grid transfer-route-grid"><label className="form-field"><span>{t('Source warehouse')}</span><select name="source_location_id" value={form.data.source_location_id} onChange={(event) => setSource(event.target.value)} required>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><div className="transfer-route-direction" aria-hidden="true"><span><Icon name="truck" size={16} /></span><i /><Icon name="navigation" size={13} /></div><label className="form-field"><span>{t('Destination warehouse')}</span><select name="destination_location_id" value={form.data.destination_location_id} onChange={(event) => form.setData('destination_location_id', event.target.value)} required>{destinations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label></div></>}

            {step === 1 && <><PanelHeading eyebrow={t('Step 2')} title={t('Select product units')} action={<small className="muted">{form.data.items.length} {t('selected')}</small>} /><WizardProductUnitCatalog locationId={form.data.source_location_id} categories={categories} selectedUnitIds={form.data.items.map((item) => item.product_unit_id)} onToggle={toggleUnit} isDisabled={(unit, selected) => Number(unit.available_qty) <= 0 || (!selected && selectedProductIds.has(Number(unit.product_id)))} emptyLabel="No available product units match these filters." /></>}

            {step === 2 && <><PanelHeading eyebrow={t('Step 3')} title={t('Transfer quantities')} action={<small className="muted">{t('Quantity cannot exceed source availability.')}</small>} /><div className="wizard-qty-table" style={{ '--wizard-qty-fields': 3, '--wizard-qty-unit': '120px' }}><div className="wizard-qty-list-head" aria-hidden="true"><span>{t('Product / Unit')}</span><span>{t('Available')}</span><span>{t('Requested')}</span><span>{t('Base units')}</span><span>{t('Action')}</span></div><div className="receipt-price-lines wizard-console-lines">{form.data.items.map((item, index) => { const baseQuantity = Number(item.requested_quantity || 0) * Number(item.unit.conversion_factor || 1); return <div className="receipt-price-line has-remove wizard-console-line" key={item.product_id}><UnitIdentity unit={item.unit} /><label className="form-field"><span>{t('Available')}</span><input value={item.unit.available_qty} readOnly tabIndex={-1} /></label><label className="form-field"><span>{t('Requested')}</span><input name={`items.${index}.requested_quantity`} type="number" min="0.0001" max={item.unit.available_qty} step="0.0001" inputMode="decimal" value={item.requested_quantity} onChange={(event) => updateQuantity(index, event.target.value)} onBlur={() => item.requested_quantity === '' && updateQuantity(index, '1')} required /></label><div className="wizard-qty-value"><span>{t('Base units')}</span><strong>{baseQuantity.toFixed(4)}</strong></div><button type="button" className="icon-btn small danger wizard-qty-remove" onClick={() => removeItem(item.product_id)} aria-label={t('Remove item')}><Icon name="trash" size={13} /></button></div>; })}</div></div></>}

            {step === 3 && <><PanelHeading eyebrow={t('Step 4')} title={t('Review and submit')} /><div className="metrics-grid compact" style={{ marginBottom: 14 }}><Stat label="Source warehouse" value={sourceLocation?.name || '-'} /><Stat label="Destination warehouse" value={destinationLocation?.name || '-'} /><Stat label="Lines" value={form.data.items.length} /><Stat label="Selected units" value={totalSelectedQuantity.toFixed(4)} /><Stat label="Base units" value={totalBaseQuantity.toFixed(4)} /></div><div className="table-wrap"><table><thead><tr><th>{t('Product / Unit')}</th><th className="numeric-cell">{t('Available')}</th><th className="numeric-cell">{t('Requested')}</th><th className="numeric-cell">{t('Base units')}</th><th /></tr></thead><tbody>{form.data.items.map((item) => <tr key={item.product_id}><td><strong>{item.unit.product_name}</strong><small className="muted" style={{ display: 'block' }}>{item.unit.unit_name} ({item.unit.unit_code})</small></td><td className="numeric-cell">{item.unit.available_qty}</td><td className="numeric-cell">{item.requested_quantity}</td><td className="numeric-cell">{(Number(item.requested_quantity || 0) * Number(item.unit.conversion_factor || 1)).toFixed(4)}</td><td><button type="button" className="icon-btn small danger" onClick={() => removeItem(item.product_id)} aria-label={t('Remove item')}><Icon name="trash" size={13} /></button></td></tr>)}</tbody></table></div></>}
        </section>
    </form>;
}
