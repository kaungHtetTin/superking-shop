import { Head, Link, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import InventoryDocumentForm from '@/Components/Admin/InventoryDocumentForm';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function ReceiptEdit({ receipt, locations, categories = [] }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();

    return (
        <AdminLayout title={`${t('Edit')} ${receipt.receipt_number}`} eyebrow={t('Draft receipt')}>
            <Head title={`${t('Edit')} ${receipt.receipt_number}`} />
            <div className="sticky-toolbar">
                <Link className="back-link" href={routeWithBase('/admin/inventory/receipts', app_base)}>
                    <Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} /> {t('Back to receipts')}
                </Link>
            </div>
            <InventoryDocumentForm
                type="receipt"
                locations={locations}
                categories={categories}
                initialData={receipt}
                submitUrl={routeWithBase(`/admin/inventory/receipts/${receipt.id}`, app_base)}
                submitMethod="put"
                submitLabel="Post receipt"
            />
        </AdminLayout>
    );
}
