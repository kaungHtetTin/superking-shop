import { useEffect } from 'react';
import { Head, Link, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import ReceiptPaper, { receiptDefaults } from '@/Components/Admin/ReceiptPaper';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import '@/styles/receipt.css';

export default function PosReceipt({ order }) {
    const { app_base, app_settings = {} } = usePage().props;
    const t = usePhraseTranslation();
    const paper = app_settings.receipt?.paper_size || receiptDefaults.paper_size;
    const isSheet = ['A4', 'A5'].includes(paper);
    const regularFont = routeWithBase('/fonts/Padauk-Regular.ttf', app_base);
    const boldFont = routeWithBase('/fonts/Padauk-Bold.ttf', app_base);

    const waitForPrintAssets = () => Promise.all([
        document.fonts?.load('400 12px "Receipt Padauk"', 'မြန်မာစာ').catch(() => {}),
        document.fonts?.load('700 12px "Receipt Padauk"', 'မြန်မာစာ').catch(() => {}),
        document.fonts?.ready,
        ...Array.from(document.querySelectorAll('.pos-receipt-paper img')).map((img) => img.decode?.().catch(() => {})),
    ].filter(Boolean));

    const printReceipt = async () => {
        await waitForPrintAssets();
        window.print();
    };

    useEffect(() => {
        document.body.classList.add('pos-receipt-print-mode');
        let cancelled = false;
        if (new URLSearchParams(window.location.search).get('print') === '1') {
            waitForPrintAssets().then(() => { if (!cancelled) window.print(); });
        }
        return () => { cancelled = true; document.body.classList.remove('pos-receipt-print-mode'); };
    }, []);

    return <AdminLayout title={order.receipt_number} eyebrow={t('POS receipt')} contentClassName="pos-receipt-page"
        action={<button className="btn primary no-print" type="button" onClick={printReceipt}><Icon name="receipt" size={14} /> {t('Print')}</button>}>
        <Head title={order.receipt_number} />
        <style>{`@font-face { font-family: 'Receipt Padauk'; src: url(${JSON.stringify(regularFont)}) format('truetype'); font-style: normal; font-weight: 400; font-display: block; }
            @font-face { font-family: 'Receipt Padauk'; src: url(${JSON.stringify(boldFont)}) format('truetype'); font-style: normal; font-weight: 700; font-display: block; }
            @media print { @page { size: ${isSheet ? paper : 'auto'}; margin: ${isSheet ? '10mm' : '0'}; } }`}</style>
        <div className="sticky-toolbar no-print"><Link className="back-link" href={routeWithBase('/admin/pos', app_base)}>{t('Back to POS')}</Link></div>
        <ReceiptPaper order={order} settings={app_settings} />
    </AdminLayout>;
}
