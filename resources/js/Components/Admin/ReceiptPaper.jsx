import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

export const receiptDefaults = {
    shop_name: '', address: '', phone: '', footer: 'Thank you for shopping with us!',
    paper_size: '80mm', show_logo: true, show_customer: true, show_cashier: true,
    show_foc: true, auto_print: false,
};

export default function ReceiptPaper({ order, settings = {} }) {
    const t = usePhraseTranslation();
    const receipt = { ...receiptDefaults, ...settings.receipt };
    const isSheet = ['A4', 'A5'].includes(receipt.paper_size);
    return <section className="pos-receipt-paper" data-paper={receipt.paper_size}>
        <header>
            {isSheet && <p className="receipt-document-title">{t('Sales receipt')}</p>}
            {receipt.show_logo && settings.logo_url && <img className="receipt-logo" src={settings.logo_url} alt="" />}
            <h2>{receipt.shop_name || settings.app_name || 'LaLaPick'}</h2>
            {receipt.address && <p className="receipt-multiline">{receipt.address}</p>}
            {receipt.phone && <p>{receipt.phone}</p>}
            <p>{[order.location?.name, order.register?.code].filter(Boolean).join(' / ') || t('Warehouse sale')}</p>
            <strong>{order.receipt_number}</strong>
            <span>{new Date(order.created_at).toLocaleString()}</span>
            {receipt.show_customer && <span>{t('Customer')}: {order.user?.name || t('Walk-in customer')}</span>}
        </header>
        {isSheet ? <div className="receipt-line-items" role="region" aria-label={t('Receipt line items')}>
            <table className="receipt-a4-items">
                <colgroup><col style={{ width: '5%' }} /><col style={{ width: '29%' }} /><col style={{ width: '12%' }} /><col style={{ width: '10%' }} /><col style={{ width: '22%' }} /><col style={{ width: '22%' }} /></colgroup>
                <thead><tr>{['#', 'Item description', 'Unit', 'Qty', 'Unit price', 'Amount'].map((label) => <th scope="col" key={label}>{t(label)}</th>)}</tr></thead>
                <tbody>{order.items.map((item, index) => <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td><strong>{item.product?.name || t('Product')}</strong>
                        {item.product?.code && <span>{item.product.code}</span>}
                        <span>{t(String(item.price_type || 'retail').replaceAll('_', ' '))}</span>
                        {receipt.show_foc && Number(item.foc_quantity || 0) > 0 && <span>{t('FOC')}: {item.foc_quantity} {item.foc_unit?.name || t('unit')} ({t('Free of charge')})</span>}
                    </td>
                    <td>{item.unit_name || item.unit?.name || '-'}</td>
                    <td>{Number(item.quantity)}</td>
                    <td>{formatMoney(item.unit_price ?? (Number(item.quantity) > 0 ? Number(item.total_price) / Number(item.quantity) : 0))}</td>
                    <td>{formatMoney(item.total_price)}</td>
                </tr>)}</tbody>
            </table>
        </div> : <table><tbody>{order.items.map((item) => <tr key={item.id}>
            <td><strong>{item.product?.name || t('Product')}</strong>
                <span>{item.unit_name || item.unit?.name} × {item.quantity} · {t(String(item.price_type || 'retail').replaceAll('_', ' '))}</span>
                {receipt.show_foc && Number(item.foc_quantity || 0) > 0 && <span>{t('FOC')}: {item.foc_quantity} {item.foc_unit?.name || t('unit')}</span>}
            </td>
            <td>{formatMoney(item.total_price)}</td>
        </tr>)}</tbody></table>}
        <div className="receipt-totals">
            <span>{t('Subtotal')}</span><strong>{formatMoney(order.total_amount)}</strong>
            <span>{t('Discount')}</span><strong>-{formatMoney(order.discount_amount || 0)}</strong>
            <span>{t('Total')}</span><strong>{formatMoney(order.final_amount)}</strong>
            <span>{t('Tender')}</span><strong>{(order.pos_tender_summary?.tender_type || order.payment_method) === 'mmqr' ? 'MMQR (Pay)' : t(order.pos_tender_summary?.tender_type || order.payment_method || 'cash')}</strong>
            {Number(order.credit_amount || 0) > 0 && <>
                <span>{t('Paid now')}</span><strong>{formatMoney(order.paid_amount || 0)}</strong>
                <span>{t('Credit balance')}</span><strong>{formatMoney(Math.max(0, Number(order.final_amount) - Number(order.paid_amount || 0)))}</strong>
                <span>{t('Due date')}</span><strong>{order.credit_due_date || '-'}</strong>
            </>}
        </div>
        <footer>
            {receipt.show_cashier && <span>{t('Served by')} {order.server?.name || t('Staff')}</span>}
            {receipt.footer && <p className="receipt-multiline">{receipt.footer}</p>}
        </footer>
    </section>;
}
