import { Head, Link, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

const statusTone = {
    live: 'success',
    scheduled: 'info',
    ended: 'neutral',
    inactive: 'danger',
};

const statusLabel = {
    live: 'Live',
    scheduled: 'Scheduled',
    ended: 'Ended',
    inactive: 'Inactive',
};

const formatDateTime = (value) => value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '-';

export default function FlashSaleShow({ flashSale }) {
    const { app_base, flash } = usePage().props;
    const t = usePhraseTranslation();
    const lineCount = flashSale.items.length;
    const soldUnits = flashSale.items.reduce((sum, item) => sum + Number(item.sold_count || 0), 0);
    const limitedItems = flashSale.items.filter((item) => item.quantity_limit !== null).length;

    const discountLabel = (item) => item.discount_type === 'percentage'
        ? `${Number(item.discount_value)}% ${t('off')}`
        : t('Fixed price');

    return (
        <AdminLayout
            title={flashSale.name}
            eyebrow={t('Flash sale')}
            contentClassName="record-detail-page"
            action={(
                <div className="inline-actions">
                    <Link className="btn secondary" href={routeWithBase(`/admin/flash-sales/${flashSale.id}/edit`, app_base)}>
                        <Icon name="edit" size={14} /> {t('Edit')}
                    </Link>
                    <Link className="btn secondary" href={routeWithBase('/admin/flash-sales', app_base)}>
                        <Icon name="arrowLeft" size={14} /> {t('Back to list')}
                    </Link>
                </div>
            )}
        >
            <Head title={flashSale.name} />
            <AdminFlash flash={flash} />

            <section className="panel glass record-detail-card">
                <header className="record-detail-header">
                    <div className="record-detail-title">
                        <span className="record-detail-icon" aria-hidden="true"><Icon name="bolt" size={19} /></span>
                        <div>
                            <p className="eyebrow">{t('Campaign summary')}</p>
                            <h2>{flashSale.name}</h2>
                            <p>{formatDateTime(flashSale.starts_at)} <span aria-hidden="true">→</span> {formatDateTime(flashSale.ends_at)}</p>
                        </div>
                    </div>
                    <StatusBadge status={statusTone[flashSale.status] || 'neutral'} label={t(statusLabel[flashSale.status] || flashSale.status)} />
                </header>

                <div className="record-detail-facts">
                    <div><small>{t('Selling units')}</small><strong>{lineCount.toLocaleString()}</strong></div>
                    <div><small>{t('Units sold')}</small><strong>{soldUnits.toLocaleString()}</strong></div>
                    <div><small>{t('Limited units')}</small><strong>{limitedItems.toLocaleString()}</strong></div>
                    <div><small>{t('Last updated')}</small><strong>{formatDateTime(flashSale.updated_at)}</strong></div>
                </div>

                <div className="record-detail-lines-heading">
                    <div><p className="eyebrow">{t('Campaign items')}</p><h3>{t(':count selling units', { count: lineCount })}</h3></div>
                    <small>{t('Discount, sales, and remaining limits for each product unit.')}</small>
                </div>

                <div className="table-wrap record-detail-lines">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th className="record-line-number">#</th>
                                <th>{t('Product / unit')}</th>
                                <th className="numeric-cell">{t('Original')}</th>
                                <th>{t('Discount')}</th>
                                <th className="numeric-cell">{t('Sale price')}</th>
                                <th className="numeric-cell">{t('Sold')}</th>
                                <th className="numeric-cell">{t('Limit')}</th>
                                <th className="numeric-cell">{t('Remaining')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {flashSale.items.map((item, index) => (
                                <tr key={item.id}>
                                    <td className="record-line-number">{String(index + 1).padStart(2, '0')}</td>
                                    <td>
                                        <div className="record-detail-product">
                                            <span aria-hidden="true"><Icon name="box" size={14} /></span>
                                            <div>
                                                <strong>{item.unit.product.name}</strong>
                                                <small className="table-subline">{item.unit.name} · {item.unit.code}</small>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="numeric-cell">{formatMoney(item.original_price)}</td>
                                    <td>{discountLabel(item)}</td>
                                    <td className="numeric-cell"><strong>{formatMoney(item.sale_price)}</strong></td>
                                    <td className="numeric-cell">{Number(item.sold_count).toLocaleString()}</td>
                                    <td className="numeric-cell">{item.quantity_limit ?? t('No limit')}</td>
                                    <td className="numeric-cell">{item.remaining_quantity ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </AdminLayout>
    );
}
