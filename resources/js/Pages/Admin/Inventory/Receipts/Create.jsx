import { Head, Link, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import InventoryDocumentForm from '@/Components/Admin/InventoryDocumentForm';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function ReceiptCreate({ locations, categories = [] }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();

    return (
        <AdminLayout title={t('Receive stock')} eyebrow={t('Inventory')}>
            <Head title={t('Receive Stock')} />
            <div className="sticky-toolbar">
                <Link className="back-link" href={routeWithBase('/admin/inventory/receipts', app_base)}>
                    <Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} /> {t('Back to receipts')}
                </Link>
            </div>
            <InventoryDocumentForm
                type="receipt"
                locations={locations}
                categories={categories}
                submitLabel="Post receipt"
            />
        </AdminLayout>
    );
}
