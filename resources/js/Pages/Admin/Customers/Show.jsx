import { Head, Link, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

const money = formatMoney;
const formatPoints = (value) => {
    const points = Number(value || 0);
    return `${points > 0 ? '+' : ''}${points}`;
};

function StatCard({ label, value, hint }) {
    return (
        <article className="metric-card glass">
            <small>{label}</small>
            <strong>{value}</strong>
            {hint && <p>{hint}</p>}
        </article>
    );
}

export default function CustomerShow({ customer, stats, recentOrders, topCategories, reviews, rewardHistories = [], canAdjustLoyalty = false, canManageCredit = false, creditSummary = {}, creditTransactions = [], creditOrders = [] }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const loyaltyForm = useForm({
        action: 'add',
        points: '',
        description: '',
    });
    const creditSettingsForm = useForm({
        credit_status: customer.credit_status || 'disabled',
        credit_limit: customer.credit_limit || 0,
        credit_terms_days: customer.credit_terms_days || 30,
    });
    const creditPaymentForm = useForm({
        order_id: '',
        amount: '',
        tender_type: 'cash',
        reference: '',
        notes: '',
    });

    const submitLoyaltyAdjustment = (event) => {
        event.preventDefault();
        loyaltyForm.post(routeWithBase(`/admin/customers/${customer.id}/loyalty-adjustments`, app_base), {
            preserveScroll: true,
            onSuccess: () => loyaltyForm.reset(),
        });
    };
    const submitCreditSettings = (event) => {
        event.preventDefault();
        creditSettingsForm.patch(routeWithBase(`/admin/customers/${customer.id}/credit-settings`, app_base), { preserveScroll: true });
    };
    const submitCreditPayment = (event) => {
        event.preventDefault();
        creditPaymentForm.post(routeWithBase(`/admin/customers/${customer.id}/credit-payments`, app_base), {
            preserveScroll: true,
            onSuccess: () => creditPaymentForm.reset('amount', 'reference', 'notes'),
        });
    };

    return (
        <AdminLayout title={customer.name} eyebrow={t('Customer profile')}>
            <Head title={t('Customer :value', { value: customer.name })} />

            <Link href={routeWithBase('/admin/customers', app_base)} className="back-link">
                <Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} />
                {t('Back to customers')}
            </Link>

            <section className="panel glass" style={{ marginBottom: 14 }}>
                <div className="stack-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div className="rider-cell">
                        <span>{customer.name.slice(0, 2).toUpperCase()}</span>
                        <div>
                            <p className="eyebrow">{t('Customer')}</p>
                            <h2 style={{ fontSize: 20, fontWeight: 900 }}>{customer.name}</h2>
                            <small>{customer.email || t('No email')}{customer.phone ? ` - ${customer.phone}` : ''}</small>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <StatusBadge status="info" label={customer.tier || t('Bronze')} />
                        <StatusBadge status={customer.status || 'active'} label={t(customer.status || 'active')} />
                    </div>
                </div>
                <div className="metrics-grid four" style={{ marginTop: 16 }}>
                    <StatCard label={t('Total spent')} value={money(stats.total_spent)} hint={t(':count paid orders', { count: stats.paid_orders })} />
                    <StatCard label={t('Average order')} value={money(stats.average_order_value)} hint={t('Paid orders only')} />
                    <StatCard label={t('Loyalty points')} value={customer.loyalty_points || 0} hint={customer.tier || t('Bronze')} />
                    <StatCard label={t('Reviews')} value={stats.reviews} hint={t('Product feedback')} />
                </div>
            </section>

            <section className="panel glass" style={{ marginBottom: 14 }}>
                <PanelHeading eyebrow={t('Accounts receivable')} title={t('Customer credit')} />
                {canManageCredit && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}><a className="btn secondary" href={routeWithBase(`/admin/customers/${customer.id}/credit-statement`, app_base)}><Icon name="download" size={14} />{t('Statement PDF')}</a></div>}
                <div className="metrics-grid four">
                    <StatCard label={t('Outstanding balance')} value={money(creditSummary.balance)} hint={t(creditSummary.status || 'disabled')} />
                    <StatCard label={t('Credit limit')} value={money(creditSummary.limit)} hint={t(':count day terms', { count: creditSummary.terms_days || 30 })} />
                    <StatCard label={t('Available credit')} value={money(creditSummary.available)} hint={t('Remaining borrowing capacity')} />
                    <StatCard label={t('Overdue')} value={money(creditSummary.overdue)} hint={t('Past due balance')} />
                </div>

                {canManageCredit && (
                    <div className="report-analysis-grid" style={{ marginTop: 14 }}>
                        <form className="crud-grid" onSubmit={submitCreditSettings}>
                            <label className="form-field">
                                <span>{t('Credit status')}</span>
                                <select value={creditSettingsForm.data.credit_status} onChange={(e) => creditSettingsForm.setData('credit_status', e.target.value)}>
                                    <option value="disabled">{t('Disabled')}</option>
                                    <option value="active">{t('Active')}</option>
                                    <option value="suspended">{t('Suspended')}</option>
                                </select>
                                {creditSettingsForm.errors.credit_status && <small className="field-error">{creditSettingsForm.errors.credit_status}</small>}
                            </label>
                            <label className="form-field">
                                <span>{t('Credit limit')}</span>
                                <input type="number" min="0" step="100" value={creditSettingsForm.data.credit_limit} onChange={(e) => creditSettingsForm.setData('credit_limit', e.target.value)} />
                                {creditSettingsForm.errors.credit_limit && <small className="field-error">{creditSettingsForm.errors.credit_limit}</small>}
                            </label>
                            <label className="form-field">
                                <span>{t('Payment terms (days)')}</span>
                                <input type="number" min="1" max="365" value={creditSettingsForm.data.credit_terms_days} onChange={(e) => creditSettingsForm.setData('credit_terms_days', e.target.value)} />
                                {creditSettingsForm.errors.credit_terms_days && <small className="field-error">{creditSettingsForm.errors.credit_terms_days}</small>}
                            </label>
                            <div className="span-2" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end' }}>
                                <button type="submit" className="btn primary" style={{ width: 200, maxWidth: '100%' }} disabled={creditSettingsForm.processing}>{t('Save credit settings')}</button>
                            </div>
                        </form>

                        <form className="crud-grid" onSubmit={submitCreditPayment}>
                            <label className="form-field span-2">
                                <span>{t('Credit order')}</span>
                                <select value={creditPaymentForm.data.order_id} onChange={(e) => creditPaymentForm.setData('order_id', e.target.value)} disabled={!creditOrders.length}>
                                    {!creditOrders.length && <option value="">{t('No outstanding credit orders')}</option>}
                                    {!!creditOrders.length && <option value="">{t('Automatic allocation (oldest due first)')}</option>}
                                    {creditOrders.map((order) => (
                                        <option key={order.id} value={order.id}>{order.receipt_number || order.order_number} · {money(Number(order.final_amount) - Number(order.paid_amount || 0))} · {order.credit_due_date}</option>
                                    ))}
                                </select>
                                {creditPaymentForm.errors.order_id && <small className="field-error">{creditPaymentForm.errors.order_id}</small>}
                            </label>
                            <label className="form-field">
                                <span>{t('Payment amount')}</span>
                                <input type="number" min="0.01" step="0.01" value={creditPaymentForm.data.amount} onChange={(e) => creditPaymentForm.setData('amount', e.target.value)} />
                                {creditPaymentForm.errors.amount && <small className="field-error">{creditPaymentForm.errors.amount}</small>}
                            </label>
                            <label className="form-field">
                                <span>{t('Payment method')}</span>
                                <select value={creditPaymentForm.data.tender_type} onChange={(e) => creditPaymentForm.setData('tender_type', e.target.value)}>
                                    <option value="cash">{t('Cash')}</option>
                                    <option value="card">{t('Card')}</option>
                                    <option value="mobile">{t('Mobile')}</option>
                                    <option value="bank_transfer">{t('Bank transfer')}</option>
                                </select>
                            </label>
                            <label className="form-field">
                                <span>{t('Reference')}</span>
                                <input value={creditPaymentForm.data.reference} onChange={(e) => creditPaymentForm.setData('reference', e.target.value)} />
                            </label>
                            <label className="form-field">
                                <span>{t('Notes')}</span>
                                <input value={creditPaymentForm.data.notes} onChange={(e) => creditPaymentForm.setData('notes', e.target.value)} />
                            </label>
                            <div className="span-2" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="submit" className="btn primary" disabled={creditPaymentForm.processing || !creditOrders.length}>{t('Record credit payment')}</button>
                            </div>
                        </form>
                    </div>
                )}
            </section>

            <section className="panel glass" style={{ marginBottom: 14 }}>
                <PanelHeading eyebrow={t('Audit ledger')} title={t('Credit transaction history')} />
                <div className="table-wrap">
                    <table>
                        <thead><tr><th>{t('Date')}</th><th>{t('Transaction')}</th><th>{t('Order')}</th><th>{t('Type')}</th><th>{t('Amount')}</th><th>{t('Balance')}</th><th>{t('Due date')}</th><th>{t('Staff')}</th></tr></thead>
                        <tbody>
                            {!creditTransactions.length ? <tr><td colSpan={8}><span className="muted">{t('No credit transactions yet.')}</span></td></tr> : creditTransactions.map((entry) => (
                                <tr key={entry.id}>
                                    <td><small>{entry.created_at}</small></td>
                                    <td><strong>{entry.transaction_number}</strong><small>{entry.reference || '-'}</small></td>
                                    <td>{entry.order?.order_number || '-'}</td>
                                    <td><StatusBadge status={Number(entry.amount) > 0 ? 'warning' : 'success'} label={t(entry.type)} /></td>
                                    <td><strong>{Number(entry.amount) > 0 ? '+' : ''}{money(entry.amount)}</strong></td>
                                    <td>{money(entry.balance_after)}</td>
                                    <td>{entry.due_date || '-'}</td>
                                    <td>{entry.creator?.name || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="report-analysis-grid">
                {canAdjustLoyalty && (
                    <section className="panel glass">
                        <PanelHeading eyebrow={t('Super admin')} title={t('Adjust loyalty points')} />
                        <form className="crud-grid" onSubmit={submitLoyaltyAdjustment}>
                            <label className="form-field">
                                <span>{t('Action')}</span>
                                <select value={loyaltyForm.data.action} onChange={(e) => loyaltyForm.setData('action', e.target.value)}>
                                    <option value="add">{t('Add points')}</option>
                                    <option value="subtract">{t('Subtract points')}</option>
                                </select>
                                {loyaltyForm.errors.action && <small className="field-error">{loyaltyForm.errors.action}</small>}
                            </label>
                            <label className="form-field">
                                <span>{t('Points')}</span>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={loyaltyForm.data.points}
                                    onChange={(e) => loyaltyForm.setData('points', e.target.value)}
                                />
                                {loyaltyForm.errors.points && <small className="field-error">{loyaltyForm.errors.points}</small>}
                            </label>
                            <label className="form-field span-2">
                                <span>{t('Reason')}</span>
                                <textarea
                                    value={loyaltyForm.data.description}
                                    onChange={(e) => loyaltyForm.setData('description', e.target.value)}
                                    rows={3}
                                    placeholder={t('Required for audit history')}
                                />
                                {loyaltyForm.errors.description && <small className="field-error">{loyaltyForm.errors.description}</small>}
                            </label>
                            <div className="span-2" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="submit" className="btn primary" disabled={loyaltyForm.processing}>
                                    <Icon name="check" size={14} />
                                    {loyaltyForm.processing ? t('Saving...') : t('Save adjustment')}
                                </button>
                            </div>
                        </form>
                    </section>
                )}

                <section className="panel glass">
                    <PanelHeading eyebrow={t('Rewards')} title={t('Loyalty history')} />
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>{t('Date')}</th>
                                    <th>{t('Type')}</th>
                                    <th>{t('Points')}</th>
                                    <th>{t('Order')}</th>
                                    <th>{t('Description')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rewardHistories.length === 0 ? (
                                    <tr><td colSpan={5}><span className="muted">{t('No loyalty history yet.')}</span></td></tr>
                                ) : rewardHistories.map((history) => (
                                    <tr key={history.id}>
                                        <td><small>{history.created_at}</small></td>
                                        <td><StatusBadge status={history.points >= 0 ? 'success' : 'warning'} label={t(history.type)} /></td>
                                        <td><strong>{formatPoints(history.points)}</strong></td>
                                        <td>{history.order ? <small>{history.order.order_number}</small> : '-'}</td>
                                        <td><small>{history.description || '-'}</small></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            <div className="report-analysis-grid">
                <section className="panel glass">
                    <PanelHeading eyebrow={t('Order history')} title={t('Recent orders')} />
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>{t('Order')}</th>
                                    <th>{t('Items')}</th>
                                    <th>{t('Status')}</th>
                                    <th>{t('Total')}</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.length === 0 ? (
                                    <tr><td colSpan={5}><span className="muted">{t('No orders yet.')}</span></td></tr>
                                ) : recentOrders.map((order) => (
                                    <tr key={order.id}>
                                        <td>
                                            <strong>{order.order_number}</strong>
                                            <small>{order.created_at}</small>
                                        </td>
                                        <td>{order.items_count}</td>
                                        <td>
                                            <StatusBadge status={order.status} label={t(order.status)} />
                                            <small>{t(order.payment_status)}</small>
                                        </td>
                                        <td><strong>{money(order.final_amount)}</strong></td>
                                        <td>
                                            <Link href={routeWithBase(`/admin/orders/${order.id}`, app_base)} className="icon-btn small">
                                                <Icon name="external" size={13} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="panel glass">
                    <PanelHeading eyebrow={t('Preference signals')} title={t('Top categories')} />
                    <div className="report-stack">
                        {topCategories.length === 0 ? (
                            <p className="muted">{t('No paid category history yet.')}</p>
                        ) : topCategories.map((category) => (
                            <article key={category.id} className="report-segment">
                                <div>
                                    <strong>{category.name}</strong>
                                    <small>{t(':count units purchased', { count: category.units })}</small>
                                </div>
                                <span>{money(category.revenue)}</span>
                            </article>
                        ))}
                    </div>
                </section>
            </div>

            <section className="panel glass" style={{ marginTop: 14 }}>
                <PanelHeading eyebrow={t('Feedback')} title={t('Recent reviews')} />
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('Product')}</th>
                                <th>{t('Rating')}</th>
                                <th>{t('Comment')}</th>
                                <th>{t('Status')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reviews.length === 0 ? (
                                <tr><td colSpan={4}><span className="muted">{t('No reviews yet.')}</span></td></tr>
                            ) : reviews.map((review) => (
                                <tr key={review.id}>
                                    <td><strong>{review.product?.name || t('Product')}</strong></td>
                                    <td>{review.rating}/5</td>
                                    <td><small>{review.comment || '-'}</small></td>
                                    <td><StatusBadge status={review.is_approved ? 'approved' : 'pending'} label={review.is_approved ? t('approved') : t('pending')} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </AdminLayout>
    );
}
