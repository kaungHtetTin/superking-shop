import { Head, useForm, usePage } from '@/spa/router';
import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

const contactMeta = {
    email: { label: 'Email', type: 'email', placeholder: 'support@example.com' },
    phone: { label: 'Phone', type: 'text', placeholder: '+95 9 123 456 789' },
    facebook: { label: 'Facebook', type: 'text', placeholder: 'https://facebook.com/your-page' },
    tiktok: { label: 'TikTok', type: 'text', placeholder: 'https://tiktok.com/@your-shop' },
};

const ensureContacts = (contacts = {}) => ({
    email: contacts.email?.length ? contacts.email : [''],
    phone: contacts.phone?.length ? contacts.phone : [''],
    facebook: contacts.facebook?.length ? contacts.facebook : [''],
    tiktok: contacts.tiktok?.length ? contacts.tiktok : [''],
});

const validHex = (value) => /^#[0-9A-Fa-f]{6}$/.test(value || '');

const serializeEditorData = (value) => JSON.stringify(value, (_key, nextValue) => {
    if (typeof File !== 'undefined' && nextValue instanceof File) {
        return {
            name: nextValue.name,
            size: nextValue.size,
            lastModified: nextValue.lastModified,
        };
    }

    return nextValue;
});

function useObjectUrl(file) {
    const [url, setUrl] = useState(null);

    useEffect(() => {
        if (!file) {
            setUrl(null);
            return undefined;
        }

        const nextUrl = URL.createObjectURL(file);
        setUrl(nextUrl);

        return () => URL.revokeObjectURL(nextUrl);
    }, [file]);

    return url;
}

function AssetControl({ id, label, previewUrl, icon, fileName, error, accept, onUpload, onRemove, canRemove, t }) {
    const translatedLabel = t(label);

    return (
        <div className="settings-asset-row">
            <div className="settings-asset-thumb">
                {previewUrl ? <img src={previewUrl} alt="" /> : <Icon name={icon} size={17} />}
            </div>
            <div className="settings-asset-meta">
                <span>{translatedLabel}</span>
                <small>{fileName}</small>
                {error && <small className="field-error">{error}</small>}
            </div>
            <div className="settings-asset-actions">
                <input
                    id={id}
                    type="file"
                    className="sr-only-file"
                    accept={accept}
                    onChange={(e) => {
                        onUpload(e.target.files?.[0] || null);
                        e.target.value = '';
                    }}
                />
                <label className="icon-btn small" htmlFor={id} title={`${t('Upload')} ${translatedLabel}`} aria-label={`${t('Upload')} ${translatedLabel}`}>
                    <Icon name="image" size={13} />
                </label>
                {canRemove && (
                    <button type="button" className="icon-btn small danger" title={`${t('Remove')} ${translatedLabel}`} aria-label={`${t('Remove')} ${translatedLabel}`} onClick={onRemove}>
                        <Icon name="trash" size={13} />
                    </button>
                )}
            </div>
        </div>
    );
}

function ContactRows({ type, values, errors, onChange, onAdd, onRemove, t }) {
    const meta = contactMeta[type];
    const label = t(meta.label);

    return (
        <div className="stack-sm settings-contact-group">
            <div className="stack-row" style={{ alignItems: 'center', marginBottom: 2 }}>
                <div>
                    <p className="eyebrow">{label}</p>
                </div>
                <button type="button" className="btn secondary" onClick={onAdd} style={{ minHeight: 30, padding: '6px 9px' }}>
                    <Icon name="plus" size={13} />
                    {t('Add')}
                </button>
            </div>

            {values.map((value, index) => (
                <label key={`${type}-${index}`} className="form-field">
                    <span>
                        {label} {index + 1}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            type={meta.type}
                            value={value}
                            placeholder={meta.placeholder}
                            onChange={(e) => onChange(index, e.target.value)}
                        />
                        <button
                            type="button"
                            className="icon-btn small danger"
                            aria-label={`${t('Remove')} ${label}`}
                            onClick={() => onRemove(index)}
                            disabled={values.length === 1 && !value}
                            style={{ flexShrink: 0, alignSelf: 'center' }}
                        >
                            <Icon name="trash" size={13} />
                        </button>
                    </div>
                    {errors?.[`${type}.${index}`] && <small style={{ color: '#ce4444' }}>{errors[`${type}.${index}`]}</small>}
                </label>
            ))}
        </div>
    );
}

export default function SettingsEdit({ settings }) {
    const { app_base, flash } = usePage().props;
    const t = usePhraseTranslation();
    const [activeSection, setActiveSection] = useState('general');
    const initialData = useMemo(() => ({
        app_name: settings.app_name || '',
        currency_label: settings.currency_label || 'MMK',
        theme_color: settings.theme_color || '#087f74',
        logo: null,
        favicon: null,
        remove_logo: false,
        remove_favicon: false,
        contacts: ensureContacts(settings.contacts),
    }), [settings]);
    const form = useForm(initialData);
    const hasChanges = serializeEditorData(form.data) !== serializeEditorData(initialData);

    useEffect(() => {
        const errorKeys = Object.keys(form.errors || {});
        if (errorKeys.some((key) => key.startsWith('contacts.'))) {
            setActiveSection('contacts');
        } else if (errorKeys.some((key) => ['theme_color', 'logo', 'favicon'].includes(key))) {
            setActiveSection('branding');
        } else if (errorKeys.length) {
            setActiveSection('general');
        }
    }, [form.errors]);

    const submit = (e) => {
        e.preventDefault();
        form.post(routeWithBase('/admin/settings', app_base), {
            preserveScroll: true,
            forceFormData: true,
        });
    };

    const setContact = (type, index, value) => {
        const next = [...(form.data.contacts[type] || [''])];
        next[index] = value;
        form.setData('contacts', { ...form.data.contacts, [type]: next });
    };

    const addContact = (type) => {
        form.setData('contacts', {
            ...form.data.contacts,
            [type]: [...(form.data.contacts[type] || []), ''],
        });
    };

    const removeContact = (type, index) => {
        const next = (form.data.contacts[type] || []).filter((_, i) => i !== index);
        form.setData('contacts', {
            ...form.data.contacts,
            [type]: next.length ? next : [''],
        });
    };

    const contactErrors = Object.entries(form.errors || {}).reduce((carry, [key, value]) => {
        if (key.startsWith('contacts.')) {
            const [, type, index] = key.split('.');
            carry[`${type}.${index}`] = value;
        }

        return carry;
    }, {});

    const logoName = form.data.logo?.name || (form.data.remove_logo ? t('Logo will be removed') : t('No new file selected'));
    const faviconName = form.data.favicon?.name || (form.data.remove_favicon ? t('Favicon will be removed') : t('No new file selected'));
    const previewColor = validHex(form.data.theme_color) ? form.data.theme_color : '#087f74';
    const logoObjectUrl = useObjectUrl(form.data.logo);
    const faviconObjectUrl = useObjectUrl(form.data.favicon);
    const logoPreviewUrl = form.data.remove_logo ? null : logoObjectUrl || settings.logo_url;
    const faviconPreviewUrl = form.data.remove_favicon ? null : faviconObjectUrl || settings.favicon_url;

    return (
        <AdminLayout title={t('Application settings')} eyebrow={t('Office configuration')}>
            <Head title={t('Application Settings')}>
                {settings.favicon_url && <link rel="icon" href={settings.favicon_url} />}
            </Head>

            <AdminFlash flash={flash} errors={form.errors} />

            <form onSubmit={submit} className="settings-workspace-form">
                <div className="settings-workspace">
                    <aside className="settings-section-nav" aria-label={t('Settings sections')}>
                        <div className="settings-nav-heading">
                            <p className="eyebrow">{t('Configuration')}</p>
                            <strong>{t('Application')}</strong>
                        </div>
                        {[
                            { id: 'general', label: 'General', description: 'Name and currency', icon: 'settings' },
                            { id: 'branding', label: 'Branding', description: 'Color and assets', icon: 'palette' },
                            { id: 'contacts', label: 'Contacts', description: 'Public channels', icon: 'chat' },
                        ].map((section) => (
                            <button
                                key={section.id}
                                type="button"
                                className={activeSection === section.id ? 'active' : ''}
                                onClick={() => setActiveSection(section.id)}
                                aria-current={activeSection === section.id ? 'page' : undefined}
                            >
                                <span className="settings-nav-icon"><Icon name={section.icon} size={15} /></span>
                                <span>
                                    <strong>{t(section.label)}</strong>
                                    <small>{t(section.description)}</small>
                                </span>
                            </button>
                        ))}
                    </aside>

                    <section className="settings-work-surface">
                        {activeSection === 'general' && (
                            <div className="settings-section-content">
                                <PanelHeading eyebrow={t('General')} title={t('Application identity')} />
                                <p className="settings-section-description">{t('Set the name and currency used throughout the admin console and storefront.')}</p>
                                <div className="settings-compact-grid">
                                    <label className="form-field">
                                        <span>{t('Application name')}</span>
                                        <input value={form.data.app_name} onChange={(e) => form.setData('app_name', e.target.value)} required maxLength={80} />
                                        {form.errors.app_name && <small className="field-error">{form.errors.app_name}</small>}
                                    </label>
                                    <label className="form-field">
                                        <span>{t('Currency label')}</span>
                                        <input value={form.data.currency_label} onChange={(e) => form.setData('currency_label', e.target.value)} placeholder="USD, MMK, CNY" required maxLength={12} />
                                        {form.errors.currency_label && <small className="field-error">{form.errors.currency_label}</small>}
                                    </label>
                                </div>
                            </div>
                        )}

                        {activeSection === 'branding' && (
                            <div className="settings-section-content">
                                <PanelHeading eyebrow={t('Brand system')} title={t('Branding')} />
                                <p className="settings-section-description">{t('Keep the admin console and customer storefront visually consistent.')}</p>
                                <div className="settings-brand-workspace">
                                    <div className="settings-brand-editor">
                                        <section className="settings-brand-config-card">
                                            <div className="settings-brand-config-heading">
                                                <span className="settings-brand-config-icon"><Icon name="palette" size={14} /></span>
                                                <div>
                                                    <strong>{t('Brand color')}</strong>
                                                    <small>{t('Used for navigation, buttons, and highlights.')}</small>
                                                </div>
                                            </div>
                                            <label className="form-field settings-theme-color-field">
                                                <span>{t('Primary color')}</span>
                                                <div className="settings-color-control">
                                                    <input type="color" value={previewColor} onChange={(e) => form.setData('theme_color', e.target.value)} aria-label={t('Choose brand color')} />
                                                    <input value={form.data.theme_color} onChange={(e) => form.setData('theme_color', e.target.value)} placeholder="#087f74" maxLength={7} />
                                                    <code>{t('HEX')}</code>
                                                </div>
                                                {form.errors.theme_color && <small className="field-error">{form.errors.theme_color}</small>}
                                            </label>
                                        </section>

                                        <section className="settings-brand-config-card">
                                            <div className="settings-brand-config-heading">
                                                <span className="settings-brand-config-icon"><Icon name="image" size={14} /></span>
                                                <div>
                                                    <strong>{t('Brand assets')}</strong>
                                                    <small>{t('Upload a logo and compact browser icon.')}</small>
                                                </div>
                                            </div>
                                            <div className="settings-asset-list settings-asset-list-vertical settings-brand-asset-grid">
                                                <AssetControl id="settings-logo-upload" label="Logo" previewUrl={logoPreviewUrl} icon="image" fileName={logoName} error={form.errors.logo} accept="image/jpeg,image/png,image/webp,image/svg+xml" canRemove={!!settings.logo_url && !form.data.remove_logo} onUpload={(file) => form.setData({ ...form.data, logo: file, remove_logo: false })} onRemove={() => form.setData({ ...form.data, logo: null, remove_logo: true })} t={t} />
                                                <AssetControl id="settings-favicon-upload" label="Favicon" previewUrl={faviconPreviewUrl} icon="settings" fileName={faviconName} error={form.errors.favicon} accept="image/x-icon,image/jpeg,image/png,image/webp,image/svg+xml" canRemove={!!settings.favicon_url && !form.data.remove_favicon} onUpload={(file) => form.setData({ ...form.data, favicon: file, remove_favicon: false })} onRemove={() => form.setData({ ...form.data, favicon: null, remove_favicon: true })} t={t} />
                                            </div>
                                        </section>
                                    </div>

                                    <aside className="brand-preview-card settings-sticky-preview settings-brand-preview">
                                        <div className="settings-brand-preview-heading">
                                            <div>
                                                <strong>{t('Live preview')}</strong>
                                                <small>{t('Admin console')}</small>
                                            </div>
                                            <span className="status" style={{ color: previewColor, background: `${previewColor}1a` }}>
                                                <span className="status-dot" style={{ background: previewColor }} />
                                                {t('Primary')}
                                            </span>
                                        </div>
                                        <div className="settings-brand-preview-window">
                                            <div className="settings-brand-preview-topbar">
                                                <div className="brand-preview-mark" style={{ background: previewColor }}>
                                                    {logoPreviewUrl ? <img src={logoPreviewUrl} alt="" /> : <Icon name="shop" size={15} />}
                                                </div>
                                                <div>
                                                    <strong>{form.data.app_name || t('Application')}</strong>
                                                    <small>{t('Admin console')}</small>
                                                </div>
                                                <span className="settings-preview-window-controls" aria-hidden="true"><i /><i /><i /></span>
                                            </div>
                                            <div className="settings-brand-preview-body">
                                                <span className="settings-brand-preview-rail" style={{ background: previewColor }} />
                                                <div>
                                                    <span className="settings-preview-line wide" />
                                                    <span className="settings-preview-line" />
                                                    <span className="btn primary" style={{ background: previewColor }}>{t('Action')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="brand-token-row">
                                            <span style={{ background: previewColor }} />
                                            <div>
                                                <small>{t('Primary token')}</small>
                                                <code>{form.data.theme_color || '#087f74'}</code>
                                            </div>
                                        </div>
                                    </aside>
                                </div>
                            </div>
                        )}

                        {activeSection === 'contacts' && (
                            <div className="settings-section-content">
                                <PanelHeading eyebrow={t('Contacts')} title={t('Public contact channels')} />
                                <p className="settings-section-description">{t('These details can be shown to customers in the storefront and support areas.')}</p>
                                <div className="settings-contact-grid">
                                    {Object.keys(contactMeta).map((type) => (
                                        <ContactRows key={type} type={type} values={form.data.contacts[type] || ['']} errors={contactErrors} onChange={(index, value) => setContact(type, index, value)} onAdd={() => addContact(type)} onRemove={(index) => removeContact(type, index)} t={t} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                </div>

                <div className="editor-action-bar">
                    <div className="editor-save-state">
                        <span className={hasChanges ? 'is-dirty' : 'is-clean'} />
                        <div>
                            <strong>{form.recentlySuccessful ? t('Settings saved') : hasChanges ? t('Unsaved changes') : t('All changes saved')}</strong>
                            <small>{t('Settings are saved together across every section.')}</small>
                        </div>
                    </div>
                    <div className="editor-action-buttons">
                        <button type="button" className="btn secondary" disabled={!hasChanges || form.processing} onClick={() => { form.reset(); form.clearErrors(); }}>
                            {t('Discard changes')}
                        </button>
                        <button type="submit" className="btn primary" disabled={form.processing || !hasChanges}>
                            <Icon name="check" size={14} />
                            {form.processing ? t('Saving...') : t('Save settings')}
                        </button>
                    </div>
                </div>
            </form>
        </AdminLayout>
    );
}
