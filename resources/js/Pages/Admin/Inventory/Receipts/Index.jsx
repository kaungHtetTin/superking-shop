import { useEffect, useRef, useState } from 'react';
import { Head, Link, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import AdminPagination from '@/Components/Admin/AdminPagination';
import Icon from '@/Components/Admin/icons';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function ReceiptsIndex({ receipts }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const [visibleReceipts, setVisibleReceipts] = useState(receipts);
    const [deletingId, setDeletingId] = useState(null);
    const deletedReceiptIds = useRef(new Set());

    const withoutReceipt = (paginator, receiptId) => {
        const data = paginator.data.filter((item) => Number(item.id) !== Number(receiptId));
        const removedCount = paginator.data.length - data.length;

        return {
            ...paginator,
            data,
            total: Math.max(0, Number(paginator.total || 0) - removedCount),
            from: data.length > 0 ? paginator.from : null,
            to: data.length > 0 ? Number(paginator.from || 1) + data.length - 1 : null,
        };
    };

    const withoutDeletedReceipts = (paginator) => (
        Array.from(deletedReceiptIds.current).reduce(
            (current, receiptId) => withoutReceipt(current, receiptId),
            paginator,
        )
    );

    useEffect(() => {
        setVisibleReceipts(withoutDeletedReceipts(receipts));
    }, [receipts]);

    const destroy = (receipt) => {
        if (!confirm(t('Delete :number? This will reduce stock quantities and delete the financial ledger entry.', { number: receipt.receipt_number }))) return;

        const previousReceipts = visibleReceipts;
        deletedReceiptIds.current.add(Number(receipt.id));
        setDeletingId(receipt.id);
        setVisibleReceipts((current) => withoutReceipt(current, receipt.id));

        router.delete(
            routeWithBase(`/admin/inventory/receipts/${receipt.id}`, app_base),
            {},
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    if (page?.props?.receipts) {
                        setVisibleReceipts(withoutDeletedReceipts(page.props.receipts));
                    }
                },
                onError: () => {
                    deletedReceiptIds.current.delete(Number(receipt.id));
                    setVisibleReceipts(previousReceipts);
                },
                onFinish: () => setDeletingId(null),
            },
        );
    };

    return (
        <AdminLayout
            title={t('Receiving')}
            eyebrow={t('Inventory')}
            action={<Link className="btn primary" href={routeWithBase('/admin/inventory/receipts/create', app_base)}><Icon name="plus" size={14} /> {t('New receipt')}</Link>}
        >
            <Head title={t('Stock Receipts')} />
            <section className="panel glass">
                <PanelHeading eyebrow={t('Inbound stock')} title={t('Stock receipts')} />
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('Receipt')}</th>
                                <th>{t('Warehouse')}</th>
                                <th>{t('Reference')}</th>
                                <th>{t('Lines')}</th>
                                <th>{t('Units')}</th>
                                <th>{t('Status')}</th>
                                <th>{t('Date')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {visibleReceipts.data.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="empty-table-cell">{t('No receipts yet.')}</td>
                                </tr>
                            ) : visibleReceipts.data.map((receipt) => (
                                <tr key={receipt.id}>
                                    <td>
                                        <Link className="table-primary-link" href={routeWithBase(`/admin/inventory/receipts/${receipt.id}`, app_base)}>
                                            {receipt.receipt_number}
                                        </Link>
                                    </td>
                                    <td>{receipt.location.name}<small className="table-subline">{receipt.location.code}</small></td>
                                    <td>{receipt.supplier_reference || '-'}</td>
                                    <td>{receipt.items.length}</td>
                                    <td>{receipt.items.reduce((sum, item) => sum + item.received_quantity, 0)}</td>
                                    <td><StatusBadge status={receipt.status === 'posted' ? 'success' : 'warning'} label={t(receipt.status)} /></td>
                                    <td>{new Date(receipt.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <div className="inline-actions">
                                            <Link
                                                className="icon-btn small"
                                                href={routeWithBase(`/admin/inventory/receipts/${receipt.id}`, app_base)}
                                                aria-label={t('View receipt')}
                                            >
                                                <Icon name="eye" size={13} />
                                            </Link>
                                            {receipt.status === 'draft' && (
                                                <Link className="icon-btn small" href={routeWithBase(`/admin/inventory/receipts/${receipt.id}/edit`, app_base)} aria-label={t('Edit receipt')}>
                                                    <Icon name="edit" size={13} />
                                                </Link>
                                            )}
                                            <button
                                                type="button"
                                                className="icon-btn small danger"
                                                onClick={() => destroy(receipt)}
                                                aria-label={t('Delete receipt')}
                                                disabled={deletingId !== null}
                                            >
                                                <Icon name="trash" size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={visibleReceipts} label={t('receipts')} />
            </section>
        </AdminLayout>
    );
}
