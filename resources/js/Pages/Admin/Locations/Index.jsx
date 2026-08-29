import { useState } from 'react';
import { Head, router, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

const emptyLocation = {
    code: '',
    name: '',
    type: 'warehouse',
    address: '',
    phone: '',
    timezone: 'Asia/Yangon',
    is_active: true,
    is_default_fulfillment: false,
    staff_ids: [],
};

export default function LocationsIndex({ locations, staff, canManage }) {
    const { app_base, flash } = usePage().props;
    const t = usePhraseTranslation();
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const form = useForm({ ...emptyLocation });

    const openCreate = () => {
        setEditing(null);
        form.setData({ ...emptyLocation });
        form.clearErrors();
        setOpen(true);
    };

    const openEdit = (location) => {
        setEditing(location);
        form.setData({
            code: location.code,
            name: location.name,
            type: location.type,
            address: location.address || '',
            phone: location.phone || '',
            timezone: location.timezone || 'Asia/Yangon',
            is_active: Boolean(location.is_active),
            is_default_fulfillment: Boolean(location.is_default_fulfillment),
            staff_ids: location.staff_ids || [],
        });
        form.clearErrors();
        setOpen(true);
    };

    const closeModal = () => {
        if (form.processing) return;
        setOpen(false);
        setEditing(null);
        form.reset();
    };

    const submit = (event) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: closeModal };

        if (editing) {
            form.patch(routeWithBase(`/admin/locations/${editing.id}`, app_base), options);
            return;
        }

        form.post(routeWithBase('/admin/locations', app_base), options);
    };

    const removeLocation = (location) => {
        if (location.is_system || !confirm(`${t('Delete')} ${location.name}?`)) return;
        router.delete(routeWithBase(`/admin/locations/${location.id}`, app_base), { preserveScroll: true });
    };

    const toggleStaff = (staffId) => {
        const selected = form.data.staff_ids || [];
        form.setData(
            'staff_ids',
            selected.includes(staffId) ? selected.filter((id) => id !== staffId) : [...selected, staffId],
        );
    };

    return (
        <AdminLayout
            title={t('Warehouses')}
            eyebrow={t('Inventory')}
            action={
                canManage ? (
                    <button type="button" className="btn primary" onClick={openCreate}>
                        <Icon name="plus" size={14} />
                        {t('Add warehouse')}
                    </button>
                ) : null
            }
        >
            <Head title={t('Warehouses')} />
            <AdminFlash flash={flash} errors={form.errors} />

            <section className="panel glass">
                <PanelHeading eyebrow={t('Warehouse management')} title={t('Stock warehouses')} />
                <div className="table-wrap">
                    <table className="data-table location-table">
                        <thead>
                            <tr>
                                <th>{t('Warehouse')}</th>
                                <th>{t('Inventory')}</th>
                                <th>{t('Assigned staff')}</th>
                                <th>{t('Status')}</th>
                                {canManage && <th aria-label={t('Actions')} />}
                            </tr>
                        </thead>
                        <tbody>
                            {locations.map((location) => (
                                <tr key={location.id}>
                                    <td>
                                        <div className="location-name-cell">
                                            <span className="location-icon">
                                                <Icon name="box" size={17} />
                                            </span>
                                            <div>
                                                <strong>{location.name}</strong>
                                                <small>
                                                    {location.code}
                                                    {location.is_default_fulfillment ? ` / ${t('Default fulfillment')}` : ''}
                                                </small>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <strong>{location.on_hand_total.toLocaleString()}</strong>
                                        <small className="table-subline">{location.balances_count} {t('SKUs')}</small>
                                    </td>
                                    <td>
                                        <div className="location-staff-stack">
                                            {location.staff.slice(0, 3).map((member) => (
                                                <span key={member.id} title={`${member.name} / ${member.role_label}`}>
                                                    {member.name.slice(0, 2).toUpperCase()}
                                                </span>
                                            ))}
                                            {location.staff.length > 3 && <small>+{location.staff.length - 3}</small>}
                                            {location.staff.length === 0 && <small className="muted">{t('Unassigned')}</small>}
                                        </div>
                                    </td>
                                    <td>
                                        <StatusBadge
                                            status={location.is_active ? 'success' : 'inactive'}
                                            label={location.is_active ? t('Active') : t('Inactive')}
                                        />
                                    </td>
                                    {canManage && (
                                        <td>
                                            <div className="inline-actions">
                                                <button type="button" className="icon-btn small" onClick={() => openEdit(location)} aria-label={`${t('Edit')} ${location.name}`}>
                                                    <Icon name="edit" size={13} />
                                                </button>
                                                {!location.is_system && (
                                                    <button type="button" className="icon-btn small danger" onClick={() => removeLocation(location)} aria-label={`${t('Delete')} ${location.name}`}>
                                                        <Icon name="trash" size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {open && (
                <div className="modal-backdrop" onClick={closeModal}>
                    <form className="operation-modal glass location-modal admin-form-modal admin-form-modal-wide" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
                        <div className="drawer-header admin-form-modal-header">
                            <div className="admin-form-modal-title">
                                <span className="admin-form-title-icon"><Icon name="box" size={16} /></span>
                                <div>
                                    <h2>{editing ? t('Edit warehouse') : t('New warehouse')}</h2>
                                </div>
                            </div>
                            <button type="button" className="icon-btn small" onClick={closeModal} aria-label={t('Close')}>
                                <Icon name="close" size={14} />
                            </button>
                        </div>

                        <div className="admin-form-modal-body">
                            <div className="location-form-section admin-form-section">
                                <div className="admin-form-section-heading">
                                    <span className="payment-section-icon"><Icon name="mapPin" size={14} /></span>
                                    <div>
                                        <strong>{t('Warehouse details')}</strong>
                                        <small>{t('Identity, contact, and fulfillment address.')}</small>
                                    </div>
                                </div>
                                <div className="crud-grid admin-form-grid">
                                <label className="form-field">
                                    <span>{t('Name')}</span>
                                    <input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} required />
                                </label>
                                <label className="form-field">
                                    <span>{t('Code')}</span>
                                    <input
                                        value={form.data.code}
                                        onChange={(event) => form.setData('code', event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                                        disabled={Boolean(editing?.is_system)}
                                        required
                                    />
                                </label>
                                <label className="form-field">
                                    <span>{t('Phone')}</span>
                                    <input value={form.data.phone} onChange={(event) => form.setData('phone', event.target.value)} />
                                </label>
                                <label className="form-field">
                                    <span>{t('Timezone')}</span>
                                    <input value={form.data.timezone} onChange={(event) => form.setData('timezone', event.target.value)} required />
                                </label>
                                <label className="form-field span-2">
                                    <span>{t('Address')}</span>
                                    <textarea rows="2" value={form.data.address} onChange={(event) => form.setData('address', event.target.value)} />
                                </label>
                                </div>
                                <div className="location-switches">
                                    <label><input type="checkbox" checked={form.data.is_active} onChange={(event) => form.setData('is_active', event.target.checked)} /> {t('Active')}</label>
                                    <label><input type="checkbox" checked={form.data.is_default_fulfillment} onChange={(event) => form.setData('is_default_fulfillment', event.target.checked)} /> {t('Default fulfillment warehouse')}</label>
                                </div>
                            </div>

                            <div className="location-form-section admin-form-section">
                                <div className="location-section-heading admin-form-section-heading">
                                    <span className="payment-section-icon"><Icon name="users" size={14} /></span>
                                    <div>
                                        <strong>{t('Assigned staff')}</strong>
                                        <small>{form.data.staff_ids.length} {t('selected')}</small>
                                    </div>
                                </div>
                                <div className="location-staff-options">
                                    {staff.map((member) => (
                                        <label key={member.id}>
                                            <input type="checkbox" checked={form.data.staff_ids.includes(member.id)} onChange={() => toggleStaff(member.id)} />
                                            <span>
                                                <strong>{member.name}</strong>
                                                <small>{member.role_label} / {member.email}</small>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button type="button" className="btn secondary" onClick={closeModal}>{t('Cancel')}</button>
                            <button type="submit" className="btn primary" disabled={form.processing}>
                                <Icon name="check" size={14} />
                                {editing ? t('Save warehouse') : t('Create warehouse')}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </AdminLayout>
    );
}
