import { Head, Link, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import TransferDocumentForm from '@/Components/Admin/TransferDocumentForm';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function TransferCreate({ locations, categories = [] }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();

    return (
        <AdminLayout
            title={t('New transfer')}
            eyebrow={t('Inventory')}
            contentClassName="transfer-create-page"
            action={
                <Link className="btn secondary" href={routeWithBase('/admin/inventory/transfers', app_base)}>
                    <Icon name="arrowLeft" size={14} /> {t('Back to transfers')}
                </Link>
            }
        >
            <Head title={t('New Transfer')} />
            <TransferDocumentForm locations={locations} categories={categories} />
        </AdminLayout>
    );
}
