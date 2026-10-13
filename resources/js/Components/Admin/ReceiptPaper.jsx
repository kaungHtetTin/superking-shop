import { usePhraseTranslation } from '@/Utils/i18n';

const formatMoney = (value) => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} MMK`;

export const receiptDefaults = {
    shop_name: '', address: '', phone: '', footer: 'Thank you for shopping with us!',
    paper_size: 'A5', show_logo: true, show_customer: true, show_cashier: true,
    show_foc: true, auto_print: false,
};

export default function ReceiptPaper({ order, settings = {} }) {
    const t = usePhraseTranslation();
    const receipt = { ...receiptDefaults, ...settings.receipt };
    const isSheet = ['A4', 'A5'].includes(receipt.paper_size);
    const isA5 = receipt.paper_size === 'A5';
    const is80mm = receipt.paper_size === '80mm';
    const isOrderPaper = isA5 || is80mm;
    const tender = order.pos_tender_summary?.tender_type || order.payment_method;
    const cashPayment = order.payments?.find((payment) => payment.tender_type === 'cash');
    const payment = order.payments?.[0];
    const changeDue = Number(order.pos_tender_summary?.change_due ?? cashPayment?.change_due ?? 0);
    const amountTendered = Number(order.pos_tender_summary?.amount_tendered ?? payment?.amount_tendered ?? order.final_amount ?? 0);
    const paymentReference = payment?.payment_details?.reference;
    const flashDiscount = order.items.reduce((sum, item) => sum + Number(item.promotion_snapshot?.discount_amount || 0), 0);
    const subtotalBeforeFlash = Number(order.total_amount || 0) + flashDiscount;
    const shopName = receipt.shop_name || settings.app_name || 'LaLaPick';
    const locationName = [order.location?.name, order.register?.code].filter(Boolean).join(' / ') || t('Warehouse sale');
    const receiptDate = new Date(order.created_at).toLocaleString();
    return <section className="pos-receipt-paper" data-paper={receipt.paper_size}>
        <header>
            {isOrderPaper ? <>
                <div className="receipt-a5-brand">
                    <div className="receipt-a5-identity">
                        {receipt.show_logo && settings.logo_url && <img className="receipt-logo" src={settings.logo_url} alt="" />}
                        <h2 className="receipt-shop-name">{shopName}</h2>
                    </div>
                    <div className="receipt-a5-contacts">
                        {receipt.address && <p className="receipt-multiline">{receipt.address}</p>}
                        {receipt.phone && <p>{receipt.phone}</p>}
                    </div>
                </div>
                <div className="receipt-a5-details">
                    <div>
                        <strong>{t('Customer')}</strong>
                        {receipt.show_customer && <span>{order.user?.name || t('Walk-in customer')}</span>}
                        <span>{locationName}</span>
                    </div>
                    <div>
                        <strong>{t('Sales receipt')}</strong>
                        <span>{order.receipt_number}</span>
                        <span>{receiptDate}</span>
                    </div>
                </div>
                <div className="receipt-order-payment"><strong>{t('Tender')}:</strong> <span>{tender === 'mmqr' ? 'MMQR (Pay)' : t(tender || 'cash')}</span></div>
            </> : <>
                {isSheet && <p className="receipt-document-title">{t('Sales receipt')}</p>}
                {receipt.show_logo && settings.logo_url && <img className="receipt-logo" src={settings.logo_url} alt="" />}
                <h2>{shopName}</h2>
                {receipt.address && <p className="receipt-multiline">{receipt.address}</p>}
                {receipt.phone && <p>{receipt.phone}</p>}
                <p>{locationName}</p>
                <div className="receipt-meta-line"><strong>{order.receipt_number}</strong><span>{receiptDate}</span></div>
                {receipt.show_customer && <span>{t('Customer')}: {order.user?.name || t('Walk-in customer')}</span>}
            </>}
        </header>
        {isOrderPaper || isSheet ? <div className="receipt-line-items" role="region" aria-label={t('Receipt line items')}>
            <table className="receipt-a4-items">
                <colgroup><col style={{ width: is80mm ? '39%' : isA5 ? '40%' : '43%' }} /><col style={{ width: is80mm ? '10%' : isA5 ? '9%' : '11%' }} /><col style={{ width: is80mm ? '24%' : isA5 ? '24%' : '22%' }} /><col style={{ width: is80mm ? '27%' : isA5 ? '27%' : '24%' }} /></colgroup>
                <thead><tr>{['Item description', 'Qty', 'Unit price', 'Amount'].map((label) => <th scope="col" key={label}>{t(label)}</th>)}</tr></thead>
                <tbody>{order.items.map((item, index) => <tr key={item.id}>
                    <td><strong>{index + 1}. {item.product?.name || t('Product')}</strong>
                        <span>{[item.product?.code, item.unit_name || item.unit?.name || t('unit'), t(String(item.price_type || 'retail').replaceAll('_', ' '))].filter(Boolean).join(' · ')}</span>
                        {item.promotion_snapshot?.type === 'flash_sale' && <span className="receipt-flash-sale">
                            {t('Flash sale')}{item.promotion_snapshot.name ? `: ${item.promotion_snapshot.name}` : ''} · {formatMoney(item.promotion_snapshot.regular_unit_price)} → {formatMoney(item.promotion_snapshot.sale_unit_price)} · {t('Saved')} {formatMoney(item.promotion_snapshot.discount_amount)}
                        </span>}
                        {receipt.show_foc && Number(item.foc_quantity || 0) > 0 && <span>{t('FOC')}: {item.foc_quantity} {item.foc_unit?.name || t('unit')} ({t('Free of charge')})</span>}
                    </td>
                    <td data-label={t('Qty')}>{Number(item.quantity)}</td>
                    <td data-label={t('Unit price')}>{formatMoney(item.unit_price ?? (Number(item.quantity) > 0 ? Number(item.total_price) / Number(item.quantity) : 0))}</td>
                    <td data-label={t('Amount')}>{formatMoney(item.total_price)}</td>
                </tr>)}</tbody>
            </table>
        </div> : <div className="receipt-thermal-items">{order.items.map((item) => {
            const promotion = item.promotion_snapshot;
            const unitPrice = Number(item.unit_price ?? (Number(item.quantity) > 0 ? Number(item.total_price) / Number(item.quantity) : 0));
            return <article className="receipt-thermal-item" key={item.id}>
                <div className="receipt-item-heading">
                    <strong>{item.product?.name || t('Product')}</strong>
                    <strong>{formatMoney(item.total_price)}</strong>
                </div>
                <div className="receipt-item-meta">
                    <span>{Number(item.quantity)} × {formatMoney(unitPrice)}</span>
                    <span>{item.unit_name || item.unit?.name || t('unit')} · {t(String(item.price_type || 'retail').replaceAll('_', ' '))}</span>
                </div>
                {promotion?.type === 'flash_sale' && <div className="receipt-flash-detail">
                    <strong>{t('Flash sale')}{promotion.name ? ` · ${promotion.name}` : ''}</strong>
                    <span>{t('Original price')} {formatMoney(promotion.regular_unit_price)}</span>
                    <span>{t('Saved')} {formatMoney(promotion.discount_amount)}</span>
                </div>}
                {receipt.show_foc && Number(item.foc_quantity || 0) > 0 && <div className="receipt-foc-detail">
                    {t('FOC')}: {Number(item.foc_quantity)} {item.foc_unit?.name || t('unit')}
                </div>}
            </article>;
        })}</div>}
        <div className="receipt-totals">
            <span>{t('Subtotal')}</span><strong>{formatMoney(subtotalBeforeFlash)}</strong>
            {flashDiscount > 0 && <><span>{t('Flash sale discount')}</span><strong>-{formatMoney(flashDiscount)}</strong></>}
            <span>{t('Discount')}</span><strong>-{formatMoney(order.discount_amount || 0)}</strong>
            <span className="receipt-grand-total">{t('Total')}</span><strong className="receipt-grand-total">{formatMoney(order.final_amount)}</strong>
            <span>{t('Tender')}</span><strong>{tender === 'mmqr' ? 'MMQR (Pay)' : t(tender || 'cash')}</strong>
            {tender === 'cash' && <><span>{t('Cash received')}</span><strong>{formatMoney(amountTendered)}</strong></>}
            {tender === 'cash' && <><span>{t('Change')}</span><strong>{formatMoney(changeDue)}</strong></>}
            {paymentReference && <><span>{t('Transaction reference')}</span><strong>{paymentReference}</strong></>}
            {Number(order.credit_amount || 0) > 0 && <>
                <span>{t('Paid now')}</span><strong>{formatMoney(order.paid_amount || 0)}</strong>
                <span>{t('Credit balance')}</span><strong>{formatMoney(Math.max(0, Number(order.final_amount) - Number(order.paid_amount || 0)))}</strong>
                <span>{t('Due date')}</span><strong>{order.credit_due_date || '-'}</strong>
            </>}
        </div>
        {(order.order_notes || (!isA5 && receipt.footer)) && <footer>
            {order.order_notes && <p className="receipt-multiline">{t('Note')}: {order.order_notes}</p>}
            {!isA5 && receipt.footer && <p className="receipt-multiline">{receipt.footer}</p>}
        </footer>}
    </section>;
}
