import { useEffect, useRef, useState } from 'react';
import { Head, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import CropImageModal from '@/Components/Admin/CropImageModal';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

function useObjectUrl(file) {
    const [url, setUrl] = useState(null);

    useEffect(() => {
        if (!file) {
            setUrl(null);
            return undefined;
        }

        const next = URL.createObjectURL(file);
        setUrl(next);
        return () => URL.revokeObjectURL(next);
    }, [file]);

    return url;
}

const croppedIconName = (sourceName) => {
    const base = (sourceName || 'category-icon').replace(/\.[^.]+$/, '').replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return `${base || 'category-icon'}-crop-${Date.now()}.png`;
};

export default function Index({ categories, parentCategories }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const categoryRows = categories.data || categories;
    const [open, setOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentCategory, setCurrentCategory] = useState(null);
    const [iconCropper, setIconCropper] = useState(null);
    const iconInputRef = useRef(null);

    const { data, setData, post, patch, delete: destroy, processing, reset, errors } = useForm({
        parent_id: '',
        name: '',
        description: '',
        icon: '',
        icon_image: null,
        remove_icon_image: false,
        metadata: { color: '#FCE4EC' },
        homepage_featured: true,
        is_active: true,
        sort_order: 0,
    });
    const iconPreviewObjectUrl = useObjectUrl(data.icon_image);
    const iconPreviewUrl = data.remove_icon_image ? null : iconPreviewObjectUrl || currentCategory?.icon_image_url;

    const handleOpen = (category = null) => {
        if (category) {
            setEditMode(true);
            setCurrentCategory(category);
            setData({
                parent_id: category.parent_id || '',
                name: category.name,
                description: category.description || '',
                icon: category.icon || '',
                icon_image: null,
                remove_icon_image: false,
                metadata: category.metadata || { color: '#FCE4EC' },
                homepage_featured: category.metadata?.homepage_featured ?? true,
                is_active: !!category.is_active,
                sort_order: category.sort_order || 0,
            });
        } else {
            setEditMode(false);
            setCurrentCategory(null);
            reset();
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setIconCropper(null);
        reset();
    };

    const openIconCropper = (file) => {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => setIconCropper({ image: reader.result, sourceName: file.name });
        reader.readAsDataURL(file);
    };

    const handleIconCropComplete = (croppedBlob) => {
        const croppedFile = new File([croppedBlob], croppedIconName(iconCropper?.sourceName), {
            type: croppedBlob.type || 'image/png',
        });

        setData({
            ...data,
            icon_image: croppedFile,
            remove_icon_image: false,
        });
        setIconCropper(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editMode) {
            post(routeWithBase(`/admin/categories/${currentCategory.id}`, app_base), {
                forceFormData: true,
                onSuccess: () => handleClose(),
            });
        } else {
            post(routeWithBase('/admin/categories', app_base), {
                forceFormData: true,
                onSuccess: () => handleClose(),
            });
        }
    };

    const handleDelete = (id) => {
        if (confirm(t('Are you sure you want to delete this category?'))) {
            destroy(routeWithBase(`/admin/categories/${id}`, app_base));
        }
    };

    return (
        <AdminLayout
            title={t('Categories')}
            eyebrow={t('Catalog management')}
            action={
                <button type="button" className="btn primary" onClick={() => handleOpen()}>
                    <Icon name="plus" size={14} />
                    {t('Add category')}
                </button>
            }
        >
            <Head title={t('Manage Categories')} />

            <section className="panel glass">
                <PanelHeading eyebrow={t('Taxonomy')} title={t('Product categories')} />
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('Icon')}</th>
                                <th>{t('Name')}</th>
                                <th>{t('Parent')}</th>
                                <th>{t('Order')}</th>
                                <th>{t('Status')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {categoryRows.length === 0 ? (
                                <tr>
                                    <td colSpan={6}>
                                        <span className="muted">{t('No categories found.')}</span>
                                    </td>
                                </tr>
                            ) : (
                                categoryRows.map((category) => (
                                    <tr key={category.id}>
                                        <td>
                                            <span
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 6,
                                                    display: 'inline-grid',
                                                    placeItems: 'center',
                                                    background: category.metadata?.color || 'var(--color-primary-soft)',
                                                    color: 'var(--color-primary)',
                                                }}
                                            >
                                                {category.icon_image_url ? (
                                                    <img
                                                        src={category.icon_image_url}
                                                        alt=""
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                ) : category.icon || <Icon name="tag" size={14} />}
                                            </span>
                                        </td>
                                        <td>
                                            <strong>{category.name}</strong>
                                        </td>
                                        <td>{category.parent?.name || '-'}</td>
                                        <td>{category.sort_order}</td>
                                        <td>
                                            <StatusBadge
                                                status={category.is_active ? 'success' : 'neutral'}
                                                label={category.is_active ? t('Active') : t('Inactive')}
                                            />
                                        </td>
                                        <td>
                                            <div className="inline-actions">
                                                <button
                                                    type="button"
                                                    className="icon-btn small"
                                                    aria-label={t('Edit category')}
                                                    onClick={() => handleOpen(category)}
                                                >
                                                    <Icon name="edit" size={13} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="icon-btn small danger"
                                                    aria-label={t('Delete category')}
                                                    onClick={() => handleDelete(category.id)}
                                                >
                                                    <Icon name="trash" size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={categories} label={t('categories')} />
            </section>

            {open && (
                <div className="modal-backdrop" onClick={handleClose}>
                    <form
                        className="operation-modal compact glass payment-method-modal category-modal"
                        onSubmit={handleSubmit}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="category-dialog-title"
                    >
                        <div className="drawer-header payment-method-modal-header category-modal-header">
                            <div className="payment-method-modal-title category-modal-title">
                                <span className="payment-method-title-icon" aria-hidden="true">
                                    <Icon name="tag" size={17} />
                                </span>
                                <div>
                                    <h2 id="category-dialog-title">{editMode ? t('Edit category') : t('New category')}</h2>
                                </div>
                            </div>
                            <button type="button" className="icon-btn small" onClick={handleClose} aria-label={t('Close dialog')}>
                                <Icon name="close" size={14} />
                            </button>
                        </div>

                        <div className="payment-method-modal-body category-modal-body">
                            <section className="payment-method-brand-panel category-icon-panel" aria-labelledby="category-icon-heading">
                                <h3 id="category-icon-heading" className="payment-logo-label">{t('Category icon')}</h3>
                                <input
                                    ref={iconInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                                    className="payment-logo-input"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0] || null;
                                        event.target.value = '';
                                        if (file) openIconCropper(file);
                                    }}
                                />
                                <button
                                    type="button"
                                    className={`payment-logo-uploader category-icon-uploader ${iconPreviewUrl ? 'has-logo' : ''}`}
                                    style={{ background: data.metadata.color || '#FCE4EC' }}
                                    onClick={() => iconInputRef.current?.click()}
                                    aria-label={iconPreviewUrl ? t('Change category icon image') : t('Choose category icon image')}
                                >
                                    <span className="payment-logo-preview">
                                        {iconPreviewUrl ? (
                                            <img src={iconPreviewUrl} alt="" />
                                        ) : data.icon ? (
                                            <span className="category-icon-fallback">{data.icon}</span>
                                        ) : (
                                            <span className="payment-logo-placeholder"><Icon name="image" size={24} /></span>
                                        )}
                                    </span>
                                </button>
                                {iconPreviewUrl && (
                                    <button
                                        type="button"
                                        className="icon-btn small danger category-icon-remove"
                                        onClick={() => setData({ ...data, icon_image: null, remove_icon_image: true })}
                                        aria-label={t('Remove category icon image')}
                                    >
                                        <Icon name="trash" size={13} />
                                    </button>
                                )}
                                {errors.icon_image && <small className="field-error">{errors.icon_image}</small>}
                            </section>

                            <section className="payment-method-account-panel category-details-panel" aria-labelledby="category-details-heading">
                                <div className="payment-method-section-heading">
                                    <span className="payment-section-icon" aria-hidden="true"><Icon name="settings" size={14} /></span>
                                    <div>
                                        <h3 id="category-details-heading">{t('Category details')}</h3>
                                        <p>{t('Set the category hierarchy, appearance and storefront visibility.')}</p>
                                    </div>
                                </div>

                                <div className="payment-account-grid category-details-grid">
                                    <label className="form-field category-name-field">
                                        <span>{t('Category name')}</span>
                                        <input
                                            value={data.name}
                                            onChange={(e) => setData('name', e.target.value)}
                                            placeholder={t('Enter category name')}
                                            required
                                        />
                                        {errors.name && <small className="field-error">{errors.name}</small>}
                                    </label>
                                    <label className="form-field category-parent-field">
                                        <span>{t('Parent category')}</span>
                                        <select value={data.parent_id} onChange={(e) => setData('parent_id', e.target.value)}>
                                            <option value="">{t('None (top level)')}</option>
                                            {parentCategories
                                                .filter((pc) => !currentCategory || pc.id !== currentCategory.id)
                                                .map((pc) => (
                                                    <option key={pc.id} value={pc.id}>{pc.name}</option>
                                                ))}
                                        </select>
                                    </label>
                                    <label className="form-field category-sort-field">
                                        <span>{t('Display order')}</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={data.sort_order}
                                            onChange={(e) => setData('sort_order', e.target.value)}
                                        />
                                    </label>
                                    <label className="form-field category-fallback-field">
                                        <span>{t('Emoji fallback')}</span>
                                        <input
                                            value={data.icon}
                                            onChange={(e) => setData('icon', e.target.value)}
                                            placeholder={t('Optional emoji or symbol')}
                                        />
                                    </label>
                                    <label className="form-field category-color-field">
                                        <span>{t('Color')}</span>
                                        <input
                                            type="color"
                                            value={data.metadata.color}
                                            onChange={(e) => setData('metadata', { ...data.metadata, color: e.target.value })}
                                            aria-label={t('Category color')}
                                        />
                                    </label>
                                    <label className="form-field category-description-field">
                                        <span>{t('Description')}</span>
                                        <textarea
                                            value={data.description}
                                            onChange={(e) => setData('description', e.target.value)}
                                            placeholder={t('Optional category description')}
                                        />
                                    </label>
                                </div>

                                <div className={`category-toggle-grid ${editMode ? '' : 'single'}`}>
                                    {editMode && (
                                        <label className="payment-active-setting category-toggle-setting">
                                            <span className="payment-active-icon" aria-hidden="true"><Icon name="check" size={14} /></span>
                                            <span className="payment-active-copy">
                                                <strong>{t('Active status')}</strong>
                                                <small>{t('Keep this category available in the catalog.')}</small>
                                            </span>
                                            <input
                                                type="checkbox"
                                                checked={data.is_active}
                                                onChange={(e) => setData('is_active', e.target.checked)}
                                            />
                                            <span className="payment-toggle" aria-hidden="true"><i /></span>
                                        </label>
                                    )}
                                    <label className="payment-active-setting category-toggle-setting">
                                        <span className="payment-active-icon" aria-hidden="true"><Icon name="storefront" size={14} /></span>
                                        <span className="payment-active-copy">
                                            <strong>{t('Show on homepage')}</strong>
                                            <small>{t('Feature this category in the storefront.')}</small>
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={data.homepage_featured}
                                            onChange={(e) => setData('homepage_featured', e.target.checked)}
                                        />
                                        <span className="payment-toggle" aria-hidden="true"><i /></span>
                                    </label>
                                </div>
                            </section>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn secondary" onClick={handleClose}>
                                {t('Cancel')}
                            </button>
                            <button type="submit" className="btn primary" disabled={processing}>
                                {editMode ? t('Update category') : t('Create category')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <CropImageModal
                open={!!iconCropper}
                image={iconCropper?.image}
                onCropComplete={handleIconCropComplete}
                onCancel={() => setIconCropper(null)}
                aspect={1}
                title={t('Crop category icon')}
                ratioLabel="1:1"
                outputType="image/png"
            />
        </AdminLayout>
    );
}
