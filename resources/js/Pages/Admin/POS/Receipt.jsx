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

    useEffect(() => {
        document.body.classList.add('pos-receipt-print-mode');
        let cancelled = false;
        if (new URLSearchParams(window.location.search).get('print') === '1') {
            Promise.all([
                document.fonts?.ready,
                ...Array.from(document.querySelectorAll('.pos-receipt-paper img')).map((img) => img.decode?.().catch(() => {})),
            ]).then(() => { if (!cancelled) window.print(); });
        }
        return () => { cancelled = true; document.body.classList.remove('pos-receipt-print-mode'); };
    }, []);

    return <AdminLayout title={order.receipt_number} eyebrow={t('POS receipt')} contentClassName="pos-receipt-page"
        action={<button className="btn primary no-print" type="button" onClick={() => window.print()}><Icon name="receipt" size={14} /> {t('Print')}</button>}>
        <Head title={order.receipt_number} />
        <style>{`@media print { @page { size: ${isSheet ? paper : 'auto'}; margin: ${isSheet ? '10mm' : '0'}; } }`}</style>
        <div className="sticky-toolbar no-print"><Link className="back-link" href={routeWithBase('/admin/pos', app_base)}>{t('Back to POS')}</Link></div>
        <ReceiptPaper order={order} settings={app_settings} />
    </AdminLayout>;
}
