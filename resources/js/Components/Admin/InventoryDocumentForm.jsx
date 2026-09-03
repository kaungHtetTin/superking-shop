import { useMemo, useState } from 'react';
import { useForm, usePage } from '@/spa/router';
import Icon from '@/Components/Admin/icons';
import { PanelHeading } from '@/Components/Admin/shared';
import WizardProductUnitCatalog from '@/Components/Admin/WizardProductUnitCatalog';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';
import { formatUnitWithConversion } from '@/Utils/unitLabel';

const steps = [
    { key: 'basic', label: 'Basic' },
    { key: 'products', label: 'Products' },
    { key: 'details', label: 'Quantities' },
    { key: 'review', label: 'Review' },
];

function Stat({ label, value }) {
    const t = usePhraseTranslation();
    return <div className="metric-card" style={{ padding: 12 }}><span>{t(label)}</span><strong>{value}</strong></div>;
}

function UnitIdentity({ unit }) {
    return (
        <div className="line-product-identity">
            <span className="receipt-product-thumb" aria-hidden="true"><Icon name="box" size={16} /></span>
            <span><strong>{unit?.product_name || unit?.product?.name}</strong><small>{unit?.product_code} · {unit?.unit_name || unit?.name} ({unit?.unit_code || unit?.code})</small></span>
        </div>
    );
}

export default function InventoryDocumentForm({ locations, categories = [], initialData = null, submitUrl = null, submitMethod = 'post', submitLabel = 'Post receipt' }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const [step, setStep] = useState(0);
    const form = useForm({
        location_id: initialData?.location_id || locations[0]?.id || '',
        supplier_reference: initialData?.supplier_reference || '',
        notes: initialData?.notes || '',
        items: initialData?.items || [],
    });

    const addUnit = (unit) => {
        if (form.data.items.some((item) => Number(item.product_id) === Number(unit.product_id))) return;
        form.clearErrors('items');
        form.setData('items', [...form.data.items, {
            product_id: unit.product_id,
            product_unit_id: unit.id,
            unit,
            received_quantity: 1,
            unit_cost: Number(unit.original_price || 0) * Number(unit.conversion_factor || 1),
            notes: '',
        }]);
    };
    const patchItem = (index, patch) => form.setData('items', form.data.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
    const removeItem = (productId) => form.setData('items', form.data.items.filter((item) => Number(item.product_id) !== Number(productId)));
    const toggleUnit = (unit, selected) => selected ? addUnit(unit) : removeItem(unit.product_id);
    const changeItemUnit = (index, unitId) => {
        const item = form.data.items[index];
        const unit = (item.unit?.unit_options || []).find((option) => Number(option.id) === Number(unitId));
        if (!unit) return;
        patchItem(index, {
            product_unit_id: unit.id,
            unit: { ...unit, unit_options: item.unit.unit_options },
            unit_cost: Number(unit.original_price || 0) * Number(unit.conversion_factor || 1),
        });
    };
    const selectedIds = useMemo(() => new Set(form.data.items.map((item) => Number(item.product_unit_id))), [form.data.items]);
    const selectedLocation = locations.find((location) => String(location.id) === String(form.data.location_id));
    const totalSelectedQuantity = useMemo(() => form.data.items.reduce((sum, item) => sum + Number(item.received_quantity || 0), 0), [form.data.items]);
    const totalBaseQuantity = useMemo(() => form.data.items.reduce((sum, item) => sum + Number(item.received_quantity || 0) * Number(item.unit?.conversion_factor || 1), 0), [form.data.items]);
    const totalCost = useMemo(() => form.data.items.reduce((sum, item) => sum + Number(item.received_quantity || 0) * Number(item.unit_cost || 0), 0), [form.data.items]);
    const basicComplete = Boolean(form.data.location_id);
    const productsComplete = basicComplete && form.data.items.length > 0;
    const detailsComplete = productsComplete && form.data.items.every((item) => Number(item.received_quantity) > 0 && Number(item.unit_cost || 0) >= 0);
    const canAccess = (index) => index === 0 || (index === 1 && basicComplete) || (index === 2 && productsComplete) || (index === 3 && detailsComplete);
    const canContinue = step === 0 ? basicComplete : step === 1 ? productsComplete : detailsComplete;

    const submit = () => {
        if (!detailsComplete || form.processing) return;
        form.transform((data) => ({ ...data, items: data.items.map(({ unit, ...item }) => item) }));
        const url = submitUrl || routeWithBase('/admin/inventory/receipts', app_base);
        const options = { preserveScroll: true, onError: (errors) => {
            const first = Object.keys(errors)[0] || '';
            setStep(first.startsWith('items.') ? 2 : first === 'items' ? 1 : 0);
        } };
        submitMethod.toLowerCase() === 'put' ? form.put(url, options) : form.post(url, options);
    };
    const next = () => canContinue && setStep((value) => Math.min(3, value + 1));

    return (
        <form onSubmit={(event) => { event.preventDefault(); step < 3 ? next() : submit(); }} className="admin-wizard receipt-wizard" noValidate>
            {Object.keys(form.errors).length > 0 && <div className="flash error">{Object.values(form.errors).map((error, index) => <div key={`${index}-${error}`}>{error}</div>)}</div>}
            <section className="panel glass">
                <div className="wizard-toolbar">
                    <div className="tab-bar wizard-stepper" role="tablist" aria-label={t('Receipt form steps')}>
                        {steps.map((item, index) => <button key={item.key} type="button" className={step === index ? 'active' : index < step ? 'is-complete' : ''} disabled={!canAccess(index)} onClick={() => canAccess(index) && setStep(index)} aria-current={step === index ? 'step' : undefined}><span className="wizard-step-number">{index < step ? <Icon name="check" size={13} /> : index + 1}</span><span className="wizard-step-label">{t(item.label)}</span></button>)}
                    </div>
                    <div className="wizard-toolbar-actions"><button type="button" className="btn secondary" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>{t('Previous')}</button>{step < 3 ? <button type="button" className="btn primary" disabled={!canContinue} onClick={next}>{t('Next')}</button> : <button type="button" className="btn primary" disabled={form.processing || !detailsComplete} onClick={submit}><Icon name="check" size={14} />{form.processing ? t('Posting...') : t(submitLabel)}</button>}</div>
                </div>

                {step === 0 && <><PanelHeading eyebrow={t('Step 1')} title={t('Receipt details')} /><div className="receipt-basic-grid">
                    <label className="form-field"><span>{t('Warehouse')}</span><select name="location_id" value={form.data.location_id} onChange={(event) => form.setData({ ...form.data, location_id: event.target.value, items: [] })} required>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
                    <label className="form-field"><span>{t('Supplier / reference')}</span><input name="supplier_reference" value={form.data.supplier_reference} onChange={(event) => form.setData('supplier_reference', event.target.value)} placeholder={t('Invoice, PO, or supplier name')} /></label>
                    <label className="form-field receipt-wide-field"><span>{t('Document note')}</span><textarea name="notes" rows="5" value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} placeholder={t('Delivery condition or internal notes')} /></label>
                </div></>}

                {step === 1 && <><PanelHeading eyebrow={t('Step 2')} title={t('Select products')} action={<small className="muted">{form.data.items.length} {t('selected')}</small>} /><WizardProductUnitCatalog locationId={form.data.location_id} categories={categories} selectedUnitIds={[...selectedIds]} selectedProductIds={form.data.items.map((item) => item.product_id)} onToggle={toggleUnit} /></>}

                {step === 2 && <><PanelHeading eyebrow={t('Step 3')} title={t('Quantities and cost')} action={<small className="muted">{t('Inventory is stored in base units.')}</small>} />
                    <div className="wizard-qty-table" style={{ '--wizard-qty-fields': 4, '--wizard-qty-unit': '140px' }}><div className="wizard-qty-list-head" aria-hidden="true"><span>{t('Product')}</span><span>{t('Unit')}</span><span>{t('Received')}</span><span>{t('Unit cost')}</span><span>{t('Line note')}</span><span>{t('Action')}</span></div><div className="receipt-price-lines wizard-console-lines">{form.data.items.map((item, index) => { const unit = item.unit; const options = unit?.unit_options || [unit]; const baseQuantity = Number(item.received_quantity || 0) * Number(unit?.conversion_factor || 1); return <div className="receipt-price-line has-remove wizard-console-line" key={item.product_id}><UnitIdentity unit={unit} /><label className="form-field"><span>{t('Unit')}</span><select value={item.product_unit_id} onChange={(event) => changeItemUnit(index, event.target.value)}>{options.map((option) => <option key={option.id} value={option.id}>{formatUnitWithConversion(option, options)}</option>)}</select></label><label className="form-field"><span>{t('Received')}</span><input name={`items.${index}.received_quantity`} type="number" min="0.0001" step="0.0001" value={item.received_quantity} onChange={(event) => patchItem(index, { received_quantity: event.target.value })} required /><small className="wizard-qty-hint">{baseQuantity.toFixed(4)} {t('base')}</small></label><label className="form-field"><span>{t('Cost per unit')}</span><input name={`items.${index}.unit_cost`} type="number" min="0" step="0.01" value={item.unit_cost} onChange={(event) => patchItem(index, { unit_cost: event.target.value })} /></label><label className="form-field"><span>{t('Line note')}</span><input name={`items.${index}.notes`} value={item.notes || ''} onChange={(event) => patchItem(index, { notes: event.target.value })} /></label><button type="button" className="icon-btn small danger wizard-qty-remove" onClick={() => removeItem(item.product_id)} aria-label={t('Remove item')}><Icon name="trash" size={13} /></button></div>; })}</div></div>
                </>}

            {step === 3 && <><PanelHeading eyebrow={t('Step 4')} title={t('Review and submit')} /><div className="metrics-grid compact" style={{ marginBottom: 14 }}><Stat label="Warehouse" value={selectedLocation?.name || '-'} /><Stat label="Lines" value={form.data.items.length} /><Stat label="Selected units" value={totalSelectedQuantity.toFixed(4)} /><Stat label="Base units" value={totalBaseQuantity.toFixed(4)} /><Stat label="Estimated cost" value={formatMoney(totalCost)} /></div><div className="table-wrap"><table><thead><tr><th>{t('Product / Unit')}</th><th className="numeric-cell">{t('Received')}</th><th className="numeric-cell">{t('Base units')}</th><th className="numeric-cell">{t('Unit cost')}</th><th className="numeric-cell">{t('Line total')}</th><th /></tr></thead><tbody>{form.data.items.map((item) => <tr key={item.product_unit_id}><td><strong>{item.unit?.product_name}</strong><small className="muted" style={{ display: 'block' }}>{item.unit?.unit_name} ({item.unit?.unit_code})</small></td><td className="numeric-cell">{item.received_quantity}</td><td className="numeric-cell">{(Number(item.received_quantity || 0) * Number(item.unit?.conversion_factor || 1)).toFixed(4)}</td><td className="numeric-cell">{formatMoney(item.unit_cost || 0)}</td><td className="numeric-cell">{formatMoney(Number(item.received_quantity || 0) * Number(item.unit_cost || 0))}</td><td><button type="button" className="icon-btn small danger" onClick={() => removeItem(item.product_id)} aria-label={t('Remove item')}><Icon name="trash" size={13} /></button></td></tr>)}</tbody></table></div></>}
            </section>
        </form>
    );
}
