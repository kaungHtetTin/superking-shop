import ReceiptPaper, { receiptDefaults } from '@/Components/Admin/ReceiptPaper';
import { PanelHeading } from '@/Components/Admin/shared';
import { usePhraseTranslation } from '@/Utils/i18n';
import '@/styles/receipt.css';

const sampleOrder = {
    receipt_number: 'RCT-PREVIEW', created_at: '2026-01-01T12:00:00',
    location: { name: 'Main Store' }, user: { name: 'Sample customer' }, server: { name: 'Cashier' },
    items: [
        { id: 1, product: { name: 'Sample product', code: 'PRD-001' }, unit_name: 'Piece', quantity: 2, unit_price: 3000, total_price: 6000, foc_quantity: 1, foc_unit: { name: 'Piece' } },
        { id: 2, product: { name: 'Sample accessory', code: 'PRD-002' }, unit_name: 'Box', quantity: 1, unit_price: 4000, total_price: 4000 },
    ],
    total_amount: 10000, discount_amount: 0, final_amount: 10000, payment_method: 'cash',
};

export default function ReceiptSettings({ form, settings, logoUrl }) {
    const t = usePhraseTranslation();
    const receipt = { ...receiptDefaults, ...form.data.receipt };
    const set = (key, value) => form.setData('receipt', { ...receipt, [key]: value });
    return <div className="settings-section-content">
        <PanelHeading eyebrow={t('Receipts')} title={t('POS receipt settings')} />
        <p className="settings-section-description">{t('Customize POS receipts. Order vouchers are not affected. The logo comes from Branding.')}</p>
        <div className="receipt-settings-layout">
            <div className="stack-sm">
                <div className="settings-compact-grid">
                    {['shop_name', 'phone'].map((key) => <label className="form-field" key={key}>
                        <span>{t(key === 'shop_name' ? 'Shop name' : 'Phone')}</span>
                        <input maxLength={80} value={receipt[key]} placeholder={key === 'shop_name' ? form.data.app_name : ''} onChange={(e) => set(key, e.target.value)} />
                        {key === 'shop_name' && <small>{t('Leave blank to use the application name.')}</small>}
                        {form.errors[`receipt.${key}`] && <small className="field-error">{form.errors[`receipt.${key}`]}</small>}
                    </label>)}
                </div>
                {['address', 'footer'].map((key) => <label className="form-field" key={key}>
                    <span>{t(key === 'address' ? 'Shop address' : 'Footer message')}</span>
                    <textarea rows={3} maxLength={300} value={receipt[key]} onChange={(e) => set(key, e.target.value)} />
                    {form.errors[`receipt.${key}`] && <small className="field-error">{form.errors[`receipt.${key}`]}</small>}
                </label>)}
                <label className="form-field"><span>{t('Paper size')}</span>
                    <select value={receipt.paper_size} onChange={(e) => set('paper_size', e.target.value)}>
                        <option value="58mm">58 mm</option><option value="80mm">80 mm</option><option value="A4">A4</option><option value="A5">A5</option>
                    </select>
                    <small>{t('Select the matching paper in your printer dialog. Thermal printing uses the printer’s paper length.')}</small>
                    {form.errors['receipt.paper_size'] && <small className="field-error">{form.errors['receipt.paper_size']}</small>}
                </label>
                <fieldset className="receipt-options"><legend>{t('Receipt options')}</legend>
                    {Object.entries({ show_logo: 'Show brand logo', show_customer: 'Show customer', show_cashier: 'Show cashier', show_foc: 'Show FOC details', auto_print: 'Print automatically after completing a sale' }).map(([key, label]) =>
                        <div key={key}><label><input type="checkbox" checked={receipt[key]} onChange={(e) => set(key, e.target.checked)} />{t(label)}</label>
                            {form.errors[`receipt.${key}`] && <small className="field-error">{form.errors[`receipt.${key}`]}</small>}
                        </div>)}
                </fieldset>
                <small>{t('Automatic printing opens the browser print dialog; it does not silently send to a printer.')}</small>
            </div>
            <aside className="receipt-settings-preview" aria-label={t('Receipt preview')}>
                <p className="eyebrow">{t('Live preview')} · {receipt.paper_size}</p>
                <small>{t('Sample data only. Save settings to apply changes.')}</small>
                <ReceiptPaper order={sampleOrder} settings={{ ...settings, app_name: form.data.app_name, logo_url: logoUrl, receipt }} />
            </aside>
        </div>
    </div>;
}
