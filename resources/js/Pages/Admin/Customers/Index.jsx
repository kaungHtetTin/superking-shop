import { useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

export default function CustomersIndex({ customers, filters, tiers, creditStats = {} }) {
    const { app_base, flash } = usePage().props;
    const t = usePhraseTranslation();
    const [search, setSearch] = useState(filters.q ?? '');
    const [createOpen, setCreateOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const createForm = useForm({ name: '', email: '', phone: '', status: 'active', password: '', password_confirmation: '' });
    const applyFilters = (patch) => router.get(routeWithBase('/admin/customers', app_base), { ...filters, ...patch }, { preserveState: true, replace: true });
    const hasActiveFilters = Boolean(filters.q || filters.tier || filters.credit_status || filters.credit);
    const dateOnly = (value) => value ? String(value).split('T')[0] : '';
    const handleSearch = (e) => {
        e.preventDefault();
        applyFilters({ q: search.trim() || undefined });
    };
    const openCreate = () => {
        setEditingCustomer(null);
        createForm.setData({ name: '', email: '', phone: '', status: 'active', password: '', password_confirmation: '' });
        createForm.clearErrors();
        setCreateOpen(true);
    };
    const openEdit = (customer) => {
        setEditingCustomer(customer);
        createForm.setData({ name: customer.name, email: customer.email || '', phone: customer.phone || '', status: customer.status || 'active', password: '', password_confirmation: '' });
        createForm.clearErrors();
        setCreateOpen(true);
    };
    const submitCustomer = (event) => {
        event.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setCreateOpen(false);
                setEditingCustomer(null);
                createForm.reset();
            },
        };
        if (editingCustomer) createForm.patch(routeWithBase(`/admin/customers/${editingCustomer.id}`, app_base), options);
        else createForm.post(routeWithBase('/admin/customers', app_base), options);
    };
    const deleteCustomer = (customer) => {
        if (!window.confirm(t('Delete this customer account? Sales history will be retained.'))) return;
        router.delete(routeWithBase(`/admin/customers/${customer.id}`, app_base), {}, { preserveScroll: true });
    };

    return (
        <AdminLayout title={t('Customers')} eyebrow={t('Shopper management')} action={<button type="button" className="btn primary" onClick={openCreate}><Icon name="plus" size={14} /> {t('Add customer')}</button>}>
            <Head title={t('Customers')} />
            <AdminFlash flash={flash} errors={createForm.errors} />
            <div className="metrics-grid four">
                <article className="metric-card glass"><small>{t('Credit outstanding')}</small><strong>{formatMoney(creditStats.outstanding)}</strong><p>{t('Total receivables')}</p></article>
                <article className="metric-card glass"><small>{t('Overdue credit')}</small><strong>{formatMoney(creditStats.overdue)}</strong><p>{t('Past due balance')}</p></article>
                <article className="metric-card glass"><small>{t('Active credit accounts')}</small><strong>{creditStats.active_accounts || 0}</strong><p>{t('Approved customers')}</p></article>
                <article className="metric-card glass"><small>{t('Suspended accounts')}</small><strong>{creditStats.suspended_accounts || 0}</strong><p>{t('Credit blocked')}</p></article>
            </div>
            <section className="panel glass">
                <PanelHeading eyebrow={t('Customer base')} title={t('Registered shoppers')} />
                <form className="filter-toolbar customer-filter" onSubmit={handleSearch}>
                    <div className="search-box">
                        <Icon name="search" size={16} />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search name, email, or phone...')} />
                    </div>
                    <select value={filters.tier || ''} onChange={(e) => applyFilters({ tier: e.target.value || undefined })}>
                        <option value="">{t('All tiers')}</option>
                        {tiers.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
                    </select>
                    <select value={filters.credit || ''} onChange={(e) => applyFilters({ credit: e.target.value || undefined })}>
                        <option value="">{t('All balances')}</option>
                        <option value="outstanding">{t('Outstanding credit')}</option>
                        <option value="overdue">{t('Overdue credit')}</option>
                    </select>
                    <select value={filters.credit_status || ''} onChange={(e) => applyFilters({ credit_status: e.target.value || undefined })}>
                        <option value="">{t('All credit statuses')}</option>
                        <option value="active">{t('Active')}</option>
                        <option value="suspended">{t('Suspended')}</option>
                        <option value="disabled">{t('Disabled')}</option>
                    </select>
                    <button type="submit" className="btn primary">
                        {t('Search')}
                    </button>
                    {hasActiveFilters && (
                        <button
                            type="button"
                            className="btn secondary customer-filter-reset"
                            onClick={() => {
                                setSearch('');
                                router.get(routeWithBase('/admin/customers', app_base));
                            }}
                        >
                            {t('Reset')}
                        </button>
                    )}
                </form>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('Customer')}</th>
                                <th>{t('Tier')}</th>
                                <th>{t('Points')}</th>
                                <th>{t('Orders')}</th>
                                <th>{t('Paid revenue')}</th>
                                <th>{t('Credit balance')}</th>
                                <th>{t('Joined')}</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.data.length === 0 ? (
                                <tr><td colSpan={8}><span className="muted">{t('No customers found.')}</span></td></tr>
                            ) : customers.data.map((customer) => (
                                <tr key={customer.id}>
                                    <td>
                                        <div className="rider-cell">
                                            <span>{customer.name.slice(0, 2).toUpperCase()}</span>
                                            <div>
                                                <strong>{customer.name}</strong>
                                                <small>{customer.email}{customer.phone ? ` - ${customer.phone}` : ''}</small>
                                            </div>
                                        </div>
                                    </td>
                                    <td><StatusBadge status="info" label={customer.tier || t('Bronze')} /></td>
                                    <td>{customer.loyalty_points}</td>
                                    <td>{customer.orders_count}</td>
                                    <td>{formatMoney(customer.paid_revenue)}</td>
                                    <td>
                                        <strong>{formatMoney(customer.credit_balance)}</strong>
                                        <small>{t(customer.credit_status || 'disabled')} · {t('Limit')} {formatMoney(customer.credit_limit)}</small>
                                    </td>
                                    <td><small>{dateOnly(customer.created_at)}</small></td>
                                    <td>
                                        <div className="inline-actions customer-row-actions">
                                            <button type="button" className="icon-btn small" onClick={() => openEdit(customer)} aria-label={t('Edit customer')}><Icon name="edit" size={13} /></button>
                                            <Link href={routeWithBase(`/admin/customers/${customer.id}`, app_base)} className="icon-btn small" aria-label={t('View customer')}><Icon name="external" size={13} /></Link>
                                            <button type="button" className="icon-btn small danger" onClick={() => deleteCustomer(customer)} aria-label={t('Delete customer')}><Icon name="trash" size={13} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={customers} label={t('customers')} />
            </section>

            {createOpen && (
                <div className="modal-backdrop customer-create-backdrop" onMouseDown={() => !createForm.processing && setCreateOpen(false)}>
                    <form className="drawer glass customer-create-drawer" onSubmit={submitCustomer} onMouseDown={(event) => event.stopPropagation()}>
                        <div className="drawer-header">
                            <div>
                                <small className="eyebrow">{editingCustomer ? t('Edit account') : t('Customer account')}</small>
                                <h2>{editingCustomer ? editingCustomer.name : t('New customer')}</h2>
                            </div>
                            <button type="button" className="icon-btn" onClick={() => setCreateOpen(false)} disabled={createForm.processing} aria-label={t('Close')}><Icon name="close" size={16} /></button>
                        </div>
                        <div className="customer-create-drawer-body">
                            <p className="muted">{editingCustomer ? t('Update the customer login and account information.') : t('Create a retail customer account with an email and password.')}</p>
                            <label className="form-field">
                                <span>{t('Customer name')}</span>
                                <input autoFocus required value={createForm.data.name} onChange={(event) => createForm.setData('name', event.target.value)} placeholder={t('Full name')} />
                                {createForm.errors.name && <small className="field-error">{createForm.errors.name}</small>}
                            </label>
                            <label className="form-field">
                                <span>{t('Email address')}</span>
                                <input required type="email" value={createForm.data.email} onChange={(event) => createForm.setData('email', event.target.value)} placeholder="customer@example.com" />
                                {createForm.errors.email && <small className="field-error">{createForm.errors.email}</small>}
                            </label>
                            <label className="form-field">
                                <span>{t('Phone number')} <small>({t('Optional')})</small></span>
                                <input value={createForm.data.phone} onChange={(event) => createForm.setData('phone', event.target.value)} placeholder={t('Phone number')} />
                                {createForm.errors.phone && <small className="field-error">{createForm.errors.phone}</small>}
                            </label>
                            {editingCustomer && <label className="form-field">
                                <span>{t('Account status')}</span>
                                <select value={createForm.data.status} onChange={(event) => createForm.setData('status', event.target.value)}>
                                    <option value="active">{t('Active')}</option>
                                    <option value="suspended">{t('Suspended')}</option>
                                </select>
                                {createForm.errors.status && <small className="field-error">{createForm.errors.status}</small>}
                            </label>}
                            <label className="form-field">
                                <span>{editingCustomer ? t('New password (optional)') : t('Password')}</span>
                                <input required={!editingCustomer} type="password" autoComplete="new-password" value={createForm.data.password} onChange={(event) => createForm.setData('password', event.target.value)} />
                                {createForm.errors.password && <small className="field-error">{createForm.errors.password}</small>}
                            </label>
                            <label className="form-field">
                                <span>{t('Confirm password')}</span>
                                <input required={!editingCustomer || Boolean(createForm.data.password)} type="password" autoComplete="new-password" value={createForm.data.password_confirmation} onChange={(event) => createForm.setData('password_confirmation', event.target.value)} />
                            </label>
                            <div className="customer-create-policy">
                                <Icon name="lock" size={16} />
                                <span>{editingCustomer ? t('Leave password blank to keep the current password.') : t('The account starts active with credit disabled. Credit can be enabled from the customer details page.')}</span>
                            </div>
                        </div>
                        <div className="drawer-actions">
                            <button type="button" className="btn secondary" onClick={() => setCreateOpen(false)} disabled={createForm.processing}>{t('Cancel')}</button>
                            <button type="submit" className="btn primary" disabled={createForm.processing || !createForm.data.name.trim() || !createForm.data.email.trim() || (!editingCustomer && !createForm.data.password)}><Icon name="check" size={14} /> {createForm.processing ? t('Saving...') : editingCustomer ? t('Save changes') : t('Create customer')}</button>
                        </div>
                    </form>
                </div>
            )}
        </AdminLayout>
    );
}
