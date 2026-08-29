import { useState } from 'react';
import { Head, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

const blank = { location_id: '', code: '', name: '', is_active: true };

export default function RegistersIndex({ registers, locations }) {
    const { app_base, flash } = usePage().props;
    const t = usePhraseTranslation();
    const [editing, setEditing] = useState(null);
    const form = useForm({ ...blank, location_id: locations[0]?.id || '' });

    const open = (register = null) => {
        setEditing(register);
        form.clearErrors();
        form.setData(register ? {
            location_id: register.location_id,
            code: register.code,
            name: register.name,
            is_active: Boolean(register.is_active),
        } : { ...blank, location_id: locations[0]?.id || '' });
    };

    const submit = (event) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => setEditing(null) };
        if (editing) {
            form.patch(routeWithBase(`/admin/registers/${editing.id}`, app_base), options);
        } else {
            form.post(routeWithBase('/admin/registers', app_base), options);
        }
    };

    return (
        <AdminLayout title={t('Registers')} eyebrow={t('POS')} action={<button className="btn primary" type="button" onClick={() => open()}><Icon name="plus" size={14} /> {t('Add register')}</button>}>
            <Head title={t('POS Registers')} />
            <AdminFlash flash={flash} errors={form.errors} />

            <section className="panel glass register-form-panel">
                <PanelHeading eyebrow={editing ? t('Editing register') : t('New register')} title={editing?.code || t('Register setup')} />
                <form className="register-form" onSubmit={submit}>
                    <label className="form-field">
                        <span>{t('Warehouse')}</span>
                        <select value={form.data.location_id} onChange={(event) => form.setData('location_id', event.target.value)} required>
                            {locations.map((location) => <option key={location.id} value={location.id}>{location.name} / {location.code}</option>)}
                        </select>
                    </label>
                    <label className="form-field">
                        <span>{t('Code')}</span>
                        <input value={form.data.code} onChange={(event) => form.setData('code', event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} required />
                    </label>
                    <label className="form-field">
                        <span>{t('Name')}</span>
                        <input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} required />
                    </label>
                    <label className="switch-row"><input type="checkbox" checked={form.data.is_active} onChange={(event) => form.setData('is_active', event.target.checked)} /> {t('Active')}</label>
                    <div className="inline-actions">
                        {editing && <button className="btn secondary" type="button" onClick={() => open()}>{t('New')}</button>}
                        <button className="btn primary" type="submit" disabled={form.processing}><Icon name="check" size={14} /> {t('Save')}</button>
                    </div>
                </form>
            </section>

            <section className="panel glass">
                <PanelHeading eyebrow={t('Checkout stations')} title={t('POS registers')} />
                <div className="table-wrap">
                    <table className="data-table">
                        <thead><tr><th>{t('Register')}</th><th>{t('Warehouse')}</th><th>{t('Shifts')}</th><th>{t('Status')}</th><th /></tr></thead>
                        <tbody>
                            {registers.length === 0 ? <tr><td colSpan="5" className="empty-table-cell">{t('No registers yet.')}</td></tr> : registers.map((register) => (
                                <tr key={register.id}>
                                    <td><strong>{register.name}</strong><small className="table-subline">{register.code}</small></td>
                                    <td>{register.location.name}<small className="table-subline">{register.location.code}</small></td>
                                    <td>{register.shifts_count}<small className="table-subline">{register.open_shifts_count} {t('open')}</small></td>
                                    <td><StatusBadge status={register.is_active ? 'success' : 'inactive'} label={register.is_active ? t('Active') : t('Inactive')} /></td>
                                    <td><button className="icon-btn small" type="button" onClick={() => open(register)} aria-label={t('Edit register')}><Icon name="edit" size={13} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </AdminLayout>
    );
}
