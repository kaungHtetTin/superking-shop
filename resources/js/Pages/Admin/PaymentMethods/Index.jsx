import { useRef, useState } from 'react';
import { Head, router, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

const emptyMethod = {
    banking_service: '',
    account_name: '',
    account_no: '',
    icon: null,
    remove_icon: false,
    sort_order: 0,
    is_active: true,
};

export default function PaymentMethodsIndex({ methods, filters }) {
    const { app_base, flash } = usePage().props;
    const t = usePhraseTranslation();
    const [search, setSearch] = useState(filters.q ?? '');
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [iconPreview, setIconPreview] = useState(null);
    const iconInputRef = useRef(null);
    const form = useForm({ ...emptyMethod });

    const applyFilters = (patch) => {
        router.get(routeWithBase('/admin/payment-methods', app_base), { ...filters, ...patch }, { preserveState: true, replace: true });
    };

    const handleSearch = (e) => {
        e.preventDefault();
        applyFilters({ q: search.trim() || undefined });
    };

    const resetIconPreview = () => {
        if (iconPreview?.startsWith('blob:')) {
            URL.revokeObjectURL(iconPreview);
        }
        if (iconInputRef.current) {
            iconInputRef.current.value = '';
        }
        setIconPreview(null);
    };

    const openModal = (method = null) => {
        resetIconPreview();
        setEditing(method);
        form.clearErrors();
        form.setData(
            method
                ? {
                      banking_service: method.banking_service || '',
                      account_name: method.account_name || '',
                      account_no: method.account_no || '',
                      icon: null,
                      remove_icon: false,
                      sort_order: method.sort_order ?? 0,
                      is_active: !!method.is_active,
                  }
                : { ...emptyMethod },
        );
        setIconPreview(method?.icon_url || null);
        setOpen(true);
    };

    const closeModal = () => {
        setOpen(false);
        setEditing(null);
        resetIconPreview();
        form.reset();
    };

    const handleIconChange = (e) => {
        const file = e.target.files?.[0] || null;
        if (iconPreview?.startsWith('blob:')) {
            URL.revokeObjectURL(iconPreview);
        }
        form.setData({ ...form.data, icon: file, remove_icon: false });
        setIconPreview(file ? URL.createObjectURL(file) : editing?.icon_url || null);
    };

    const submit = (e) => {
        e.preventDefault();
        const options = {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: closeModal,
        };

        if (editing) {
            form.post(routeWithBase(`/admin/payment-methods/${editing.id}`, app_base), options);
        } else {
            form.post(routeWithBase('/admin/payment-methods', app_base), options);
        }
    };

    const remove = (method) => {
        if (!confirm(`${t('Delete or deactivate')} ${method.banking_service}?`)) return;
        router.delete(routeWithBase(`/admin/payment-methods/${method.id}`, app_base), { preserveScroll: true });
    };

    return (
        <AdminLayout
            title={t('Payment methods')}
            eyebrow={t('Checkout settings')}
            action={
                <button type="button" className="btn primary" onClick={() => openModal()}>
                    <Icon name="plus" size={14} />
                    {t('Add method')}
                </button>
            }
        >
            <Head title={t('Payment Methods')} />
            <AdminFlash flash={flash} errors={form.errors} />

            <section className="panel glass">
                <PanelHeading eyebrow={t('Manual transfer accounts')} title={t('Payment methods')} />
                <form className="filter-toolbar payment-method-filter" onSubmit={handleSearch}>
                    <div className="search-box">
                        <Icon name="search" size={16} />
                        <input
                            placeholder={t('Search service, account name or number...')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select value={filters.status || ''} onChange={(e) => applyFilters({ status: e.target.value || undefined })}>
                        <option value="">{t('All statuses')}</option>
                        <option value="active">{t('Active')}</option>
                        <option value="inactive">{t('Inactive')}</option>
                    </select>
                    <button type="submit" className="btn primary">{t('Search')}</button>
                </form>

                {(filters.q || filters.status) && (
                    <button
                        type="button"
                        className="text-btn"
                        style={{ marginBottom: 10 }}
                        onClick={() => router.get(routeWithBase('/admin/payment-methods', app_base))}
                    >
                        {t('Reset filters')}
                    </button>
                )}

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('Service')}</th>
                                <th>{t('Account name')}</th>
                                <th>{t('Account no.')}</th>
                                <th>{t('Sort')}</th>
                                <th>{t('Status')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {methods.data.length === 0 ? (
                                <tr><td colSpan={6}><span className="muted">{t('No payment methods found.')}</span></td></tr>
                            ) : methods.data.map((method) => (
                                <tr key={method.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            {method.icon_url ? (
                                                <img
                                                    src={method.icon_url}
                                                    alt=""
                                                    style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--color-border)' }}
                                                />
                                            ) : (
                                                <span className="icon-btn small" style={{ pointerEvents: 'none' }}>
                                                    <Icon name="wallet" size={14} />
                                                </span>
                                            )}
                                            <strong>{method.banking_service}</strong>
                                        </div>
                                    </td>
                                    <td>{method.account_name}</td>
                                    <td><code>{method.account_no}</code></td>
                                    <td>{method.sort_order ?? 0}</td>
                                    <td>
                                        <StatusBadge
                                            status={method.is_active ? 'success' : 'neutral'}
                                            label={method.is_active ? t('Active') : t('Inactive')}
                                        />
                                    </td>
                                    <td>
                                        <div className="inline-actions">
                                            <button type="button" className="icon-btn small" onClick={() => openModal(method)} aria-label={t('Edit payment method')}>
                                                <Icon name="edit" size={13} />
                                            </button>
                                            <button type="button" className="icon-btn small danger" onClick={() => remove(method)} aria-label={t('Delete payment method')}>
                                                <Icon name="trash" size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={methods} label={t('payment methods')} />
            </section>

            {open && (
                <div className="modal-backdrop" onClick={closeModal}>
                    <form
                        className="operation-modal compact glass payment-method-modal"
                        onSubmit={submit}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="payment-method-dialog-title"
                    >
                        <div className="drawer-header payment-method-modal-header">
                            <div className="payment-method-modal-title">
                                <span className="payment-method-title-icon" aria-hidden="true">
                                    <Icon name="wallet" size={17} />
                                </span>
                                <div>
                                    <h2 id="payment-method-dialog-title">{editing ? t('Edit method') : t('New method')}</h2>
                                </div>
                            </div>
                            <button type="button" className="icon-btn small" onClick={closeModal} aria-label={t('Close dialog')}>
                                <Icon name="close" size={14} />
                            </button>
                        </div>

                        <div className="payment-method-modal-body">
                            <section className="payment-method-brand-panel" aria-labelledby="payment-logo-heading">
                                <h3 id="payment-logo-heading" className="payment-logo-label">{t('Brand logo')}</h3>

                                <input
                                    ref={iconInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                                    onChange={handleIconChange}
                                    className="payment-logo-input"
                                />

                                <button
                                    type="button"
                                    className={`payment-logo-uploader ${iconPreview ? 'has-logo' : ''}`}
                                    onClick={() => iconInputRef.current?.click()}
                                    aria-label={iconPreview ? t('Change payment method logo') : t('Choose payment method logo')}
                                >
                                    <span className="payment-logo-preview">
                                        {iconPreview ? (
                                            <img src={iconPreview} alt="" />
                                        ) : (
                                            <span className="payment-logo-placeholder">
                                                <Icon name="image" size={24} />
                                            </span>
                                        )}
                                    </span>
                                </button>
                                {form.errors.icon && <small className="field-error">{form.errors.icon}</small>}
                            </section>

                            <section className="payment-method-account-panel" aria-labelledby="payment-account-heading">
                                <div className="payment-method-section-heading">
                                    <span className="payment-section-icon" aria-hidden="true"><Icon name="card" size={14} /></span>
                                    <div>
                                        <h3 id="payment-account-heading">{t('Account details')}</h3>
                                        <p>{t('Enter the receiving account exactly as customers should see it.')}</p>
                                    </div>
                                </div>

                                <div className="payment-account-grid">
                                    <label className="form-field payment-service-field">
                                        <span>{t('Banking service')}</span>
                                        <input
                                            value={form.data.banking_service}
                                            onChange={(e) => form.setData('banking_service', e.target.value)}
                                            placeholder={t('KBZ Pay, AYA Bank, WavePay...')}
                                            required
                                        />
                                        {form.errors.banking_service && <small className="field-error">{form.errors.banking_service}</small>}
                                    </label>
                                    <label className="form-field payment-account-name-field">
                                        <span>{t('Account name')}</span>
                                        <input
                                            value={form.data.account_name}
                                            onChange={(e) => form.setData('account_name', e.target.value)}
                                            placeholder={t('Account holder name')}
                                            required
                                        />
                                        {form.errors.account_name && <small className="field-error">{form.errors.account_name}</small>}
                                    </label>
                                    <label className="form-field payment-sort-field">
                                        <span>{t('Sort order')}</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={form.data.sort_order}
                                            onChange={(e) => form.setData('sort_order', e.target.value)}
                                        />
                                        {form.errors.sort_order && <small className="field-error">{form.errors.sort_order}</small>}
                                    </label>
                                    <label className="form-field payment-account-number-field">
                                        <span>{t('Account no.')}</span>
                                        <input
                                            value={form.data.account_no}
                                            onChange={(e) => form.setData('account_no', e.target.value)}
                                            placeholder={t('Phone number or bank account number')}
                                            required
                                        />
                                        {form.errors.account_no && <small className="field-error">{form.errors.account_no}</small>}
                                    </label>
                                </div>

                                <label className="payment-active-setting">
                                    <span className="payment-active-icon" aria-hidden="true"><Icon name="check" size={14} /></span>
                                    <span className="payment-active-copy">
                                        <strong>{t('Active on checkout')}</strong>
                                        <small>{t('Customers can select this account when placing an order.')}</small>
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={form.data.is_active}
                                        onChange={(e) => form.setData('is_active', e.target.checked)}
                                    />
                                    <span className="payment-toggle" aria-hidden="true"><i /></span>
                                </label>
                            </section>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn secondary" onClick={closeModal}>{t('Cancel')}</button>
                            <button type="submit" className="btn primary" disabled={form.processing}>
                                {editing ? t('Save changes') : t('Create method')}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </AdminLayout>
    );
}
