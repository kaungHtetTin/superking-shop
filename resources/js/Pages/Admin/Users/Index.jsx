import { useState } from 'react';
import { Head, router, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

const emptyForm = {
    name: '',
    email: '',
    phone: '',
    password: '',
    password_confirmation: '',
    role: 'staff',
    status: 'active',
};

export default function UsersIndex({ users, filters, roles }) {
    const { app_base, auth, flash } = usePage().props;
    const t = usePhraseTranslation();
    const currentUserId = auth?.user?.id;
    const [search, setSearch] = useState(filters.q ?? '');
    const [open, setOpen] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [deleteUser, setDeleteUser] = useState(null);

    const form = useForm({ ...emptyForm });

    const applyFilters = (patch) => {
        router.get(
            routeWithBase('/admin/users', app_base),
            { ...filters, ...patch },
            { preserveState: true, replace: true },
        );
    };

    const handleSearch = (e) => {
        e.preventDefault();
        applyFilters({ q: search.trim() || undefined });
    };

    const openCreate = () => {
        setEditUser(null);
        form.clearErrors();
        form.setData({ ...emptyForm });
        setOpen(true);
    };

    const openEdit = (user) => {
        setEditUser(user);
        form.clearErrors();
        form.setData({
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            password: '',
            password_confirmation: '',
            role: user.role,
            status: user.status,
        });
        setOpen(true);
    };

    const closeModal = () => {
        setOpen(false);
        setEditUser(null);
        form.reset();
        form.clearErrors();
    };

    const submit = (e) => {
        e.preventDefault();
        if (editUser) {
            form.patch(routeWithBase(`/admin/users/${editUser.id}`, app_base), {
                preserveScroll: true,
                onSuccess: () => closeModal(),
            });
        } else {
            form.post(routeWithBase('/admin/users', app_base), {
                preserveScroll: true,
                onSuccess: () => closeModal(),
            });
        }
    };

    const toggleStatus = (user) => {
        if (!confirm(`${t(user.status === 'active' ? 'Suspend' : 'Activate')} ${user.name}?`)) return;
        router.patch(routeWithBase(`/admin/users/${user.id}/toggle-status`, app_base), {}, { preserveScroll: true });
    };

    const confirmDelete = () => {
        if (!deleteUser) return;
        router.delete(routeWithBase(`/admin/users/${deleteUser.id}`, app_base), {
            preserveScroll: true,
            onSuccess: () => setDeleteUser(null),
        });
    };

    return (
        <AdminLayout
            title={t('Team management')}
            eyebrow={t('Staff accounts')}
            action={
                <button type="button" className="btn primary" onClick={openCreate}>
                    <Icon name="plus" size={14} />
                    {t('Add staff')}
                </button>
            }
        >
            <Head title={t('Admin Users')} />

            <AdminFlash flash={flash} errors={form.errors} />

            <section className="panel glass">
                <PanelHeading eyebrow={t('Access control')} title={t('Admin staff')} />

                <form className="filter-toolbar staff-filter" onSubmit={handleSearch}>
                    <div className="search-box">
                        <Icon name="search" size={16} />
                        <input
                            placeholder={t('Search name or email...')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        value={filters.role || ''}
                        onChange={(e) => applyFilters({ role: e.target.value || undefined })}
                    >
                        <option value="">{t('All roles')}</option>
                        {roles.map((r) => (
                            <option key={r.value} value={r.value}>
                                {r.label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filters.status || ''}
                        onChange={(e) => applyFilters({ status: e.target.value || undefined })}
                    >
                        <option value="">{t('All statuses')}</option>
                        <option value="active">{t('Active')}</option>
                        <option value="suspended">{t('Suspended')}</option>
                    </select>
                    <button type="submit" className="btn primary">
                        {t('Search')}
                    </button>
                </form>

                {(filters.q || filters.role || filters.status) && (
                    <button
                        type="button"
                        className="text-btn"
                        style={{ marginBottom: 10 }}
                        onClick={() => {
                            setSearch('');
                            router.get(routeWithBase('/admin/users', app_base));
                        }}
                    >
                        {t('Reset filters')}
                    </button>
                )}

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('Staff')}</th>
                                <th>{t('Role')}</th>
                                <th>{t('Status')}</th>
                                <th>{t('Updated')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan={5}>
                                        <span className="muted">{t('No staff accounts match your filters.')}</span>
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => {
                                    const isSelf = user.id === currentUserId;

                                    return (
                                        <tr key={user.id}>
                                            <td>
                                                <div className="rider-cell">
                                                    <span>{user.name.slice(0, 2).toUpperCase()}</span>
                                                    <div>
                                                        <strong>{user.name}</strong>
                                                        <small>
                                                            {user.email}
                                                            {user.phone ? ` - ${user.phone}` : ''}
                                                        </small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <StatusBadge
                                                    status={user.role}
                                                    label={user.role_label || user.role}
                                                />
                                            </td>
                                            <td>
                                                <StatusBadge
                                                    status={user.status === 'active' ? 'success' : 'danger'}
                                                    label={user.status === 'active' ? t('Active') : t('Suspended')}
                                                />
                                            </td>
                                            <td>
                                                <small>{user.updated_at}</small>
                                            </td>
                                            <td>
                                                <div className="inline-actions">
                                                    <button
                                                        type="button"
                                                        className="icon-btn small"
                                                        aria-label={t('Edit staff')}
                                                        onClick={() => openEdit(user)}
                                                    >
                                                        <Icon name="edit" size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="icon-btn small"
                                                        aria-label={t(user.status === 'active' ? 'Suspend' : 'Activate')}
                                                        disabled={isSelf}
                                                        title={isSelf ? t('Cannot change your own status') : undefined}
                                                        onClick={() => toggleStatus(user)}
                                                    >
                                                        <Icon name={user.status === 'active' ? 'lock' : 'check'} size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="icon-btn small danger"
                                                        aria-label={t('Delete staff')}
                                                        disabled={isSelf}
                                                        title={isSelf ? t('Cannot delete your own account') : undefined}
                                                        onClick={() => setDeleteUser(user)}
                                                    >
                                                        <Icon name="trash" size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {open && (
                <div className="modal-backdrop" onClick={closeModal}>
                    <form className="operation-modal compact glass admin-form-modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header admin-form-modal-header">
                            <div className="admin-form-modal-title">
                                <span className="admin-form-title-icon"><Icon name="users" size={16} /></span>
                                <div>
                                    <h2>{editUser ? t('Edit staff member') : t('New staff member')}</h2>
                                </div>
                            </div>
                            <button type="button" className="icon-btn small" onClick={closeModal} aria-label={t('Close')}>
                                <Icon name="close" size={14} />
                            </button>
                        </div>
                        <div className="crud-grid admin-form-grid">
                            <label className="form-field span-2">
                                <span>{t('Full name')}</span>
                                <input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} required />
                                {form.errors.name && <small style={{ color: '#ce4444' }}>{form.errors.name}</small>}
                            </label>
                            <label className="form-field">
                                <span>{t('Email')}</span>
                                <input
                                    type="email"
                                    value={form.data.email}
                                    onChange={(e) => form.setData('email', e.target.value)}
                                    required
                                />
                                {form.errors.email && <small style={{ color: '#ce4444' }}>{form.errors.email}</small>}
                            </label>
                            <label className="form-field">
                                <span>{t('Phone')}</span>
                                <input value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)} />
                                {form.errors.phone && <small style={{ color: '#ce4444' }}>{form.errors.phone}</small>}
                            </label>
                            <label className="form-field">
                                <span>{t('Role')}</span>
                                <select
                                    value={form.data.role}
                                    onChange={(e) => form.setData('role', e.target.value)}
                                    disabled={editUser?.id === currentUserId}
                                >
                                    {roles.map((r) => (
                                        <option key={r.value} value={r.value}>
                                            {r.label}
                                        </option>
                                    ))}
                                </select>
                                {form.errors.role && <small style={{ color: '#ce4444' }}>{form.errors.role}</small>}
                            </label>
                            <label className="form-field">
                                <span>{t('Status')}</span>
                                <select
                                    value={form.data.status}
                                    onChange={(e) => form.setData('status', e.target.value)}
                                    disabled={editUser?.id === currentUserId}
                                >
                                    <option value="active">{t('Active')}</option>
                                    <option value="suspended">{t('Suspended')}</option>
                                </select>
                                {form.errors.status && <small style={{ color: '#ce4444' }}>{form.errors.status}</small>}
                            </label>
                            <label className="form-field span-2">
                                <span>{editUser ? t('New password (optional)') : t('Password')}</span>
                                <input
                                    type="password"
                                    value={form.data.password}
                                    onChange={(e) => form.setData('password', e.target.value)}
                                    required={!editUser}
                                    autoComplete="new-password"
                                />
                                {form.errors.password && <small style={{ color: '#ce4444' }}>{form.errors.password}</small>}
                            </label>
                            <label className="form-field span-2">
                                <span>{t('Confirm password')}</span>
                                <input
                                    type="password"
                                    value={form.data.password_confirmation}
                                    onChange={(e) => form.setData('password_confirmation', e.target.value)}
                                    required={!editUser && !!form.data.password}
                                    autoComplete="new-password"
                                />
                            </label>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn secondary" onClick={closeModal}>
                                {t('Cancel')}
                            </button>
                            <button type="submit" className="btn primary" disabled={form.processing}>
                                {editUser ? t('Save changes') : t('Create staff')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {deleteUser && (
                <div className="modal-backdrop" onClick={() => setDeleteUser(null)}>
                    <div className="operation-modal compact glass" onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header">
                            <div>
                                <p className="eyebrow">{t('Confirm')}</p>
                                <h2 style={{ fontSize: 16, fontWeight: 800 }}>{t('Remove staff account')}</h2>
                            </div>
                            <button type="button" className="icon-btn small" onClick={() => setDeleteUser(null)}>
                                <Icon name="close" size={14} />
                            </button>
                        </div>
                        <div style={{ padding: '0 16px 16px' }}>
                            <p>
                                {t('Remove')} <strong>{deleteUser.name}</strong> ({deleteUser.email})? {t('This soft-deletes the account and revokes admin access.')}
                            </p>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn secondary" onClick={() => setDeleteUser(null)}>
                                {t('Cancel')}
                            </button>
                            <button type="button" className="btn danger" onClick={confirmDelete}>
                                {t('Delete account')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
