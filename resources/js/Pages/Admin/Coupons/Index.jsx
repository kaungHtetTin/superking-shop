import { useEffect, useRef, useState } from 'react';
import { Head, router, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';
import { formatErrorMessage } from '@/Utils/formatErrorMessage';

const emptyCoupon = {
    code: '',
    type: 'percentage',
    value: '',
    min_order_amount: 0,
    starts_at: '',
    expires_at: '',
    usage_limit: '',
    is_active: true,
};

const statusTone = {
    active: 'success',
    scheduled: 'info',
    expired: 'neutral',
    exhausted: 'warning',
    inactive: 'danger',
};

const statusLabel = {
    active: 'Active',
    scheduled: 'Scheduled',
    expired: 'Expired',
    exhausted: 'Usage limit reached',
    inactive: 'Inactive',
};

const toLocalDateInput = (value) => {
    if (!value) return '';
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const localDateBoundaryToIso = (value, endOfDay = false) => {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = endOfDay
        ? new Date(year, month - 1, day, 23, 59, 59, 999)
        : new Date(year, month - 1, day, 0, 0, 0, 0);
    return date.toISOString();
};

function FieldError({ message, id }) {
    if (!message) return null;
    return <small id={id} className="flash-sale-conflict-message" role="alert">{formatErrorMessage(message)}</small>;
}

export default function CouponsIndex({ coupons, filters }) {
    const { app_base, flash } = usePage().props;
    const t = usePhraseTranslation();
    const [search, setSearch] = useState(filters.q ?? '');
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const form = useForm({ ...emptyCoupon });
    const codeInputRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;

        const handleEscape = (event) => {
            if (event.key === 'Escape' && !form.processing) closeModal();
        };
        window.addEventListener('keydown', handleEscape);
        window.requestAnimationFrame(() => {
            const firstInvalid = document.querySelector('.admin-form-modal [aria-invalid="true"]');
            (firstInvalid || codeInputRef.current)?.focus();
        });

        return () => window.removeEventListener('keydown', handleEscape);
    }, [open, form.errors, form.processing]);

    const applyFilters = (patch) => {
        router.get(routeWithBase('/admin/coupons', app_base), { ...filters, ...patch }, { preserveState: true, replace: true });
    };

    const handleSearch = (e) => {
        e.preventDefault();
        applyFilters({ q: search.trim() || undefined });
    };

    const openModal = (coupon = null) => {
        setEditing(coupon);
        form.clearErrors();
        form.setData(
            coupon
                ? {
                      code: coupon.code,
                      type: coupon.type,
                      value: coupon.value,
                      min_order_amount: coupon.min_order_amount,
                      starts_at: toLocalDateInput(coupon.starts_at),
                      expires_at: toLocalDateInput(coupon.expires_at),
                      usage_limit: coupon.usage_limit ?? '',
                      is_active: !!coupon.is_active,
                  }
                : { ...emptyCoupon },
        );
        setOpen(true);
    };

    const closeModal = () => {
        setOpen(false);
        setEditing(null);
        form.reset();
        form.clearErrors();
    };

    const setField = (field, value) => {
        form.setData(field, value);
        form.clearErrors(field);
    };

    const submit = (e) => {
        e.preventDefault();
        form.transform((data) => ({
            ...data,
            starts_at: localDateBoundaryToIso(data.starts_at),
            expires_at: localDateBoundaryToIso(data.expires_at, true),
        }));
        const options = { preserveScroll: true, onSuccess: closeModal };
        if (editing) form.patch(routeWithBase(`/admin/coupons/${editing.id}`, app_base), options);
        else form.post(routeWithBase('/admin/coupons', app_base), options);
    };

    const remove = (coupon) => {
        const action = Number(coupon.used_count || 0) > 0 ? t('Deactivate') : t('Delete');
        if (!confirm(`${action} ${coupon.code}?`)) return;
        router.delete(routeWithBase(`/admin/coupons/${coupon.id}`, app_base), { preserveScroll: true });
    };

    return (
        <AdminLayout
            title={t('Coupons')}
            eyebrow={t('Promotions')}
            action={
                <button type="button" className="btn primary" onClick={() => openModal()}>
                    <Icon name="plus" size={14} />
                    {t('Add coupon')}
                </button>
            }
        >
            <Head title={t('Coupons')} />
            <AdminFlash flash={flash} errors={open ? {} : form.errors} />

            <section className="panel glass">
                <PanelHeading eyebrow={t('Checkout discounts')} title={t('Promo codes')} />
                <form className="filter-toolbar compact flash-sales-filter" onSubmit={handleSearch}>
                    <div className="search-box">
                        <Icon name="search" size={16} />
                        <input
                            placeholder={t('Search coupon code...')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select value={filters.status || ''} onChange={(e) => applyFilters({ status: e.target.value || undefined })}>
                        <option value="">{t('All statuses')}</option>
                        <option value="active">{t('Active')}</option>
                        <option value="scheduled">{t('Scheduled')}</option>
                        <option value="expired">{t('Expired')}</option>
                        <option value="exhausted">{t('Usage limit reached')}</option>
                        <option value="inactive">{t('Inactive')}</option>
                    </select>
                    <button type="submit" className="btn primary">{t('Search')}</button>
                </form>

                {(filters.q || filters.status) && (
                    <button
                        type="button"
                        className="text-btn"
                        style={{ marginBottom: 10 }}
                        onClick={() => router.get(routeWithBase('/admin/coupons', app_base))}
                    >
                        {t('Reset filters')}
                    </button>
                )}

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('Code')}</th>
                                <th>{t('Discount')}</th>
                                <th>{t('Minimum')}</th>
                                <th>{t('Usage')}</th>
                                <th>{t('Status')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {coupons.data.length === 0 ? (
                                <tr><td colSpan={6}><span className="muted">{t('No coupons found.')}</span></td></tr>
                            ) : coupons.data.map((coupon) => (
                                <tr key={coupon.id}>
                                    <td><strong>{coupon.code}</strong></td>
                                    <td>{coupon.type === 'percentage' ? `${Number(coupon.value).toFixed(0)}%` : formatMoney(coupon.value)}</td>
                                    <td>{formatMoney(coupon.min_order_amount)}</td>
                                    <td>{coupon.used_count}{coupon.usage_limit ? ` / ${coupon.usage_limit}` : ''}</td>
                                    <td>
                                        <StatusBadge
                                            status={statusTone[coupon.status] || 'neutral'}
                                            label={t(statusLabel[coupon.status] || coupon.status)}
                                        />
                                    </td>
                                    <td>
                                        <div className="inline-actions">
                                            <button type="button" className="icon-btn small" onClick={() => openModal(coupon)} aria-label={t('Edit coupon')}>
                                                <Icon name="edit" size={13} />
                                            </button>
                                            <button type="button" className="icon-btn small danger" onClick={() => remove(coupon)} aria-label={t('Delete coupon')}>
                                                <Icon name="trash" size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={coupons} label={t('coupons')} />
            </section>

            {open && (
                <div className="modal-backdrop" onClick={() => !form.processing && closeModal()}>
                    <form
                        className="operation-modal compact glass admin-form-modal"
                        onSubmit={submit}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="coupon-modal-title"
                    >
                        <div className="drawer-header admin-form-modal-header">
                            <div className="admin-form-modal-title">
                                <span className="admin-form-title-icon"><Icon name="tag" size={16} /></span>
                                <div>
                                    <h2 id="coupon-modal-title">{editing ? t('Edit coupon') : t('New coupon')}</h2>
                                </div>
                            </div>
                            <button type="button" className="icon-btn small" onClick={closeModal} aria-label={t('Close')}><Icon name="close" size={14} /></button>
                        </div>
                        <div className="crud-grid admin-form-grid">
                            {Object.keys(form.errors).length > 0 && (
                                <div className="admin-form-notice span-2" role="alert">
                                    {formatErrorMessage(Object.values(form.errors)[0])}
                                </div>
                            )}
                            <label className="form-field">
                                <span>{t('Code')}</span>
                                <input
                                    ref={codeInputRef}
                                    name="code"
                                    value={form.data.code}
                                    onChange={(e) => setField('code', e.target.value.toUpperCase())}
                                    aria-invalid={Boolean(form.errors.code)}
                                    aria-describedby={form.errors.code ? 'coupon-code-error' : undefined}
                                    required
                                />
                                <FieldError id="coupon-code-error" message={form.errors.code} />
                            </label>
                            <label className="form-field">
                                <span>{t('Type')}</span>
                                <select name="type" value={form.data.type} onChange={(e) => setField('type', e.target.value)}>
                                    <option value="percentage">{t('Percentage')}</option>
                                    <option value="fixed">{t('Fixed amount')}</option>
                                </select>
                            </label>
                            <label className="form-field">
                                <span>{t('Value')}</span>
                                <input
                                    name="value"
                                    type="number"
                                    min="0.01"
                                    max={form.data.type === 'percentage' ? '100' : undefined}
                                    step="0.01"
                                    value={form.data.value}
                                    onChange={(e) => setField('value', e.target.value)}
                                    aria-invalid={Boolean(form.errors.value)}
                                    aria-describedby={form.errors.value ? 'coupon-value-error' : undefined}
                                    required
                                />
                                <FieldError id="coupon-value-error" message={form.errors.value} />
                            </label>
                            <label className="form-field">
                                <span>{t('Minimum order')}</span>
                                <input name="min_order_amount" type="number" min="0" step="0.01" value={form.data.min_order_amount} onChange={(e) => setField('min_order_amount', e.target.value)} aria-invalid={Boolean(form.errors.min_order_amount)} />
                                <FieldError id="coupon-minimum-error" message={form.errors.min_order_amount} />
                            </label>
                            <label className="form-field">
                                <span>{t('Starts')}</span>
                                <input name="starts_at" type="date" value={form.data.starts_at} onChange={(e) => setField('starts_at', e.target.value)} aria-invalid={Boolean(form.errors.starts_at)} />
                                <FieldError id="coupon-start-error" message={form.errors.starts_at} />
                            </label>
                            <label className="form-field">
                                <span>{t('Expires')}</span>
                                <input name="expires_at" type="date" min={form.data.starts_at || undefined} value={form.data.expires_at} onChange={(e) => setField('expires_at', e.target.value)} aria-invalid={Boolean(form.errors.expires_at)} />
                                <FieldError id="coupon-expiry-error" message={form.errors.expires_at} />
                            </label>
                            <label className="form-field">
                                <span>{t('Usage limit')}</span>
                                <input name="usage_limit" type="number" min="1" step="1" value={form.data.usage_limit} onChange={(e) => setField('usage_limit', e.target.value)} aria-invalid={Boolean(form.errors.usage_limit)} />
                                <FieldError id="coupon-usage-error" message={form.errors.usage_limit} />
                            </label>
                            <label className="payment-active-setting admin-form-toggle span-2">
                                <span className="payment-active-icon"><Icon name="check" size={14} /></span>
                                <span className="payment-active-copy">
                                    <strong>{t('Active')}</strong>
                                    <small>{t('Allow customers to use this coupon.')}</small>
                                </span>
                                <input name="is_active" type="checkbox" checked={form.data.is_active} onChange={(e) => setField('is_active', e.target.checked)} />
                                <span className="payment-toggle" aria-hidden="true"><i /></span>
                            </label>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn secondary" onClick={closeModal}>{t('Cancel')}</button>
                            <button type="submit" className="btn primary" disabled={form.processing}>{editing ? t('Save changes') : t('Create coupon')}</button>
                        </div>
                    </form>
                </div>
            )}
        </AdminLayout>
    );
}
