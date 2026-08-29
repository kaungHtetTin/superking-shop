import { Head } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function AdjustmentsIndex({ adjustments }) {
    const t = usePhraseTranslation();
    const rows = adjustments.data.flatMap((adjustment) =>
        adjustment.items.map((item) => ({
            adjustment,
            item,
        }))
    );

    return (
        <AdminLayout title={t('Adjustments')} eyebrow={t('Inventory')}>
            <Head title={t('Stock Adjustments')} />
            <section className="panel glass">
                <PanelHeading eyebrow={t('Counts & corrections')} title={t('Stock adjustment records')} />
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('Adjustment')}</th>
                                <th>{t('Warehouse')}</th>
                                <th>{t('Product / unit')}</th>
                                <th>{t('Before')}</th>
                                <th>{t('After')}</th>
                                <th>{t('Variance')}</th>
                                <th>{t('Reason')}</th>
                                <th>{t('Status')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="empty-table-cell">{t('No adjustments yet.')}</td>
                                </tr>
                            ) : rows.map(({ adjustment, item }) => (
                                <tr key={`${adjustment.id}-${item.id}`}>
                                    <td>
                                        <strong>{adjustment.adjustment_number}</strong>
                                        <small className="table-subline">{new Date(adjustment.created_at).toLocaleString()}</small>
                                    </td>
                                    <td>{adjustment.location.name}</td>
                                    <td>
                                        <strong>{item.product.name}</strong>
                                        <small className="table-subline">{item.product.product_code} · {item.unit?.name} ({item.unit?.code})</small>
                                    </td>
                                    <td>{item.system_quantity}</td>
                                    <td>{item.counted_quantity}</td>
                                    <td className={item.quantity_delta < 0 ? 'quantity-negative' : item.quantity_delta > 0 ? 'quantity-positive' : ''}>
                                        {item.quantity_delta > 0 ? '+' : ''}{item.quantity_delta}
                                    </td>
                                    <td>{adjustment.reason_code.replaceAll('_', ' ')}</td>
                                    <td><StatusBadge status="success" label={t('posted')} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={adjustments} label={t('adjustments')} />
            </section>
        </AdminLayout>
    );
}
