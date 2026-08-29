import { useEffect, useMemo, useState } from 'react';
import { Head, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading } from '@/Components/Admin/shared';
import CropImageModal from '@/Components/Admin/CropImageModal';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

const sectionLabels = {
    categories: 'Category strip',
    flash_sale: 'Flash sale',
    promos: 'Promo tiles',
    best_sellers: 'Best sellers',
    blogs: 'Blogs',
};

const normalizeBlock = (block = {}, fallback = {}) => ({
    id: block.id || null,
    key: block.key || fallback.key || '',
    title: block.title || fallback.title || '',
    subtitle: block.subtitle || fallback.subtitle || '',
    button_label: block.button_label || fallback.button_label || '',
    link_url: block.link_url || fallback.link_url || '',
    accent_color: block.accent_color || fallback.accent_color || '#087f74',
    sort_order: block.sort_order ?? fallback.sort_order ?? 0,
    is_active: block.is_active ?? fallback.is_active ?? true,
    image_url: block.image_url || null,
    image: null,
    remove_image: false,
});

const imageCropPresets = {
    hero: { aspect: 16 / 9, ratioLabel: '16:9', title: 'Crop hero image', outputType: 'image/jpeg' },
    promo: { aspect: 2, ratioLabel: '2:1', title: 'Crop promo tile', outputType: 'image/jpeg' },
};

const croppedImageName = (sourceName, prefix) => {
    const base = (sourceName || prefix).replace(/\.[^.]+$/, '').replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return `${base || prefix}-crop-${Date.now()}.jpg`;
};

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

        const next = URL.createObjectURL(file);
        setUrl(next);
        return () => URL.revokeObjectURL(next);
    }, [file]);

    return url;
}

function ImagePicker({ label, block, onChange, onFileSelect, cropHint }) {
    const t = usePhraseTranslation();
    const objectUrl = useObjectUrl(block.image);
    const previewUrl = block.remove_image ? null : objectUrl || block.image_url;

    return (
        <div className="storefront-image-picker">
            <div className="storefront-image-preview" style={{ background: block.accent_color || '#087f74' }}>
                {previewUrl ? (
                    <img src={previewUrl} alt="" />
                ) : (
                    <Icon name="image" size={18} />
                )}
            </div>
            <div className="storefront-image-meta">
                <strong>{t(label)}</strong>
                <small>{block.image?.name || (previewUrl ? t('Current image') : t('No image selected'))}</small>
                {cropHint && <small className="storefront-crop-hint">{t(cropHint)}</small>}
            </div>
            <div className="storefront-image-actions">
                <label className="btn secondary">
                    <Icon name="image" size={13} />
                    {t('Upload')}
                    <input
                        className="sr-only-file"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/svg+xml"
                        onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            event.target.value = '';
                            if (file && onFileSelect) onFileSelect(file);
                        }}
                    />
                </label>
                {previewUrl && (
                    <button type="button" className="icon-btn small danger" onClick={() => onChange({ image: null, remove_image: true })}>
                        <Icon name="trash" size={13} />
                    </button>
                )}
            </div>
        </div>
    );
}

export default function StorefrontIndex({ hero, promos, sections }) {
    const t = usePhraseTranslation();
    const { app_base, app_url, flash } = usePage().props;
    const [cropper, setCropper] = useState(null);
    const [activeBlock, setActiveBlock] = useState('hero');
    const [previewMode, setPreviewMode] = useState('desktop');

    const initialPromos = useMemo(() => (
        promos.length ? promos : [
            { key: 'editors-picks', title: "Editor's Picks", subtitle: 'Handpicked favorites', link_url: '/products', button_label: 'Explore', accent_color: '#fce4ec', sort_order: 1, is_active: true },
            { key: 'new-arrivals', title: 'New Arrivals', subtitle: 'Latest drops', link_url: '/products?sort=newest', button_label: 'View new', accent_color: '#f3e5f5', sort_order: 2, is_active: true },
        ]
    ), [promos]);

    const initialData = useMemo(() => ({
        hero: normalizeBlock(hero, {
            title: 'Fresh picks for every occasion',
            subtitle: 'Discover customer favorites, seasonal gifts, and new arrivals curated for today.',
            button_label: 'Shop now',
            link_url: '/products',
            accent_color: '#087f74',
            is_active: true,
        }),
        promos: initialPromos.map((promo) => normalizeBlock(promo)),
        sections: sections.map((section) => ({
            id: section.id,
            key: section.key,
            title: section.title || '',
            subtitle: section.subtitle || '',
            sort_order: section.sort_order ?? 0,
            is_active: !!section.is_active,
        })),
    }), [hero, initialPromos, sections]);
    const form = useForm(initialData);
    const hasChanges = serializeEditorData(form.data) !== serializeEditorData(initialData);

    const updateHero = (patch) => form.setData('hero', { ...form.data.hero, ...patch });
    const updatePromo = (index, patch) => {
        const next = [...form.data.promos];
        next[index] = { ...next[index], ...patch };
        form.setData('promos', next);
    };
    const updateSection = (index, patch) => {
        const next = [...form.data.sections];
        next[index] = { ...next[index], ...patch };
        form.setData('sections', next);
    };
    const moveSection = (index, direction) => {
        const target = index + direction;
        if (target < 0 || target >= form.data.sections.length) return;

        const next = [...form.data.sections];
        [next[index], next[target]] = [next[target], next[index]];
        form.setData('sections', next.map((section, sectionIndex) => ({ ...section, sort_order: sectionIndex + 1 })));
        setActiveBlock(`section:${target}`);
    };

    const openImageCropper = (file, target, preset) => {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            setCropper({
                image: reader.result,
                sourceName: file.name,
                target,
                ...preset,
            });
        };
        reader.readAsDataURL(file);
    };

    const handleCropComplete = (croppedBlob) => {
        if (!cropper) return;

        const croppedFile = new File([croppedBlob], croppedImageName(cropper.sourceName, cropper.target.type), {
            type: croppedBlob.type || cropper.outputType || 'image/jpeg',
        });

        if (cropper.target.type === 'hero') {
            updateHero({ image: croppedFile, remove_image: false });
        } else if (cropper.target.type === 'promo') {
            updatePromo(cropper.target.index, { image: croppedFile, remove_image: false });
        }

        setCropper(null);
    };

    const submit = (event) => {
        event.preventDefault();
        form.post(routeWithBase('/admin/storefront', app_base), {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    const activePromoIndex = activeBlock.startsWith('promo:') ? Number(activeBlock.split(':')[1]) : -1;
    const activeSectionIndex = activeBlock.startsWith('section:') ? Number(activeBlock.split(':')[1]) : -1;
    const activePromo = activePromoIndex >= 0 ? form.data.promos[activePromoIndex] : null;
    const activeSection = activeSectionIndex >= 0 ? form.data.sections[activeSectionIndex] : null;
    const activeTitle = activeBlock === 'hero'
        ? t('Hero banner')
        : activePromo
            ? activePromo.title || `${t('Promo tile')} ${activePromoIndex + 1}`
            : activeSection
                ? t(sectionLabels[activeSection.key] || activeSection.key)
                : t('Storefront');
    const activeDescription = activeBlock === 'hero'
        ? t('Manage the homepage headline, call to action, color, and banner image.')
        : activePromo
            ? t('Manage this promotional tile, destination, color, and image.')
            : t('Manage the customer-facing heading, visibility, and homepage order.');
    const activeIsVisible = activeBlock === 'hero'
        ? form.data.hero.is_active
        : activePromo?.is_active ?? activeSection?.is_active ?? false;
    const setActiveVisibility = (isActive) => {
        if (activeBlock === 'hero') updateHero({ is_active: isActive });
        else if (activePromo) updatePromo(activePromoIndex, { is_active: isActive });
        else if (activeSection) updateSection(activeSectionIndex, { is_active: isActive });
    };

    return (
        <AdminLayout title={t('Storefront')} eyebrow={t('Client decoration')}>
            <Head title={t('Storefront')} />
            <AdminFlash flash={flash} errors={form.errors} />

            <form onSubmit={submit} className="storefront-workspace-form">
                <div className="settings-workspace storefront-workspace storefront-settings-workspace">
                    <aside className="settings-section-nav storefront-outline" aria-label={t('Homepage outline')}>
                        <div className="storefront-outline-heading">
                            <p className="eyebrow">{t('Page outline')}</p>
                            <strong>{t('Homepage')}</strong>
                        </div>
                        <div className="storefront-outline-group">
                            <small>{t('Main content')}</small>
                            <button type="button" className={activeBlock === 'hero' ? 'active' : ''} onClick={() => setActiveBlock('hero')} aria-current={activeBlock === 'hero' ? 'page' : undefined}>
                                <span className="settings-nav-icon"><Icon name="image" size={14} /></span>
                                <span><strong>{t('Hero banner')}</strong><small>{t('Main content')}</small></span>
                                <i className={form.data.hero.is_active ? 'visible' : 'hidden'} />
                            </button>
                        </div>
                        <div className="storefront-outline-group">
                            <small>{t('Promo tiles')}</small>
                            {form.data.promos.map((promo, index) => (
                                <button key={promo.key || index} type="button" className={activeBlock === `promo:${index}` ? 'active' : ''} onClick={() => setActiveBlock(`promo:${index}`)} aria-current={activeBlock === `promo:${index}` ? 'page' : undefined}>
                                    <span className="settings-nav-icon"><Icon name="image" size={14} /></span>
                                    <span><strong>{promo.title || `${t('Promo tile')} ${index + 1}`}</strong><small>{t('Promo tile')}</small></span>
                                    <i className={promo.is_active ? 'visible' : 'hidden'} />
                                </button>
                            ))}
                        </div>
                        <div className="storefront-outline-group">
                            <small>{t('Homepage sections')}</small>
                            {form.data.sections.map((section, index) => (
                                <button key={section.key} type="button" className={activeBlock === `section:${index}` ? 'active' : ''} onClick={() => setActiveBlock(`section:${index}`)} aria-current={activeBlock === `section:${index}` ? 'page' : undefined}>
                                    <span className="settings-nav-icon"><Icon name="menu" size={14} /></span>
                                    <span><strong>{t(sectionLabels[section.key] || section.key)}</strong><small>{t('Homepage section')}</small></span>
                                    <i className={section.is_active ? 'visible' : 'hidden'} />
                                </button>
                            ))}
                        </div>
                    </aside>

                    <section className="settings-work-surface storefront-settings-surface">
                        <div className="settings-section-content storefront-settings-content">
                            <PanelHeading
                                eyebrow={activeBlock === 'hero' ? t('Homepage hero') : activePromo ? t('Marketing tile') : t('Homepage section')}
                                title={activeTitle}
                                action={(
                                <label className="editor-visibility-toggle">
                                    <span>{t('Visible')}</span>
                                    <span className="switch-lite"><input type="checkbox" checked={activeIsVisible} onChange={(e) => setActiveVisibility(e.target.checked)} /><span /></span>
                                </label>
                                )}
                            />
                            <p className="settings-section-description">{activeDescription}</p>

                            <div className="storefront-settings-editor-layout">
                                <section className="storefront-block-editor">

                        {activeBlock === 'hero' && (
                            <div className="storefront-editor-fields">
                                <div className="editor-field-section">
                                    <div className="editor-field-section-heading"><strong>{t('Content')}</strong><small>{t('Headline and call to action')}</small></div>
                                    <div className="storefront-field-grid">
                                        <label className="form-field"><span>{t('Hero title')}</span><input value={form.data.hero.title} onChange={(e) => updateHero({ title: e.target.value })} /></label>
                                        <label className="form-field"><span>{t('Button label')}</span><input value={form.data.hero.button_label} onChange={(e) => updateHero({ button_label: e.target.value })} /></label>
                                        <label className="form-field span-2"><span>{t('Subtitle')}</span><input value={form.data.hero.subtitle} onChange={(e) => updateHero({ subtitle: e.target.value })} /></label>
                                        <label className="form-field"><span>{t('Button link')}</span><input value={form.data.hero.link_url} onChange={(e) => updateHero({ link_url: e.target.value })} placeholder="/products" /></label>
                                        <label className="form-field"><span>{t('Accent color')}</span><div className="editor-color-control"><input type="color" value={form.data.hero.accent_color} onChange={(e) => updateHero({ accent_color: e.target.value })} /><input value={form.data.hero.accent_color} onChange={(e) => updateHero({ accent_color: e.target.value })} maxLength={7} /></div></label>
                                    </div>
                                </div>
                                <div className="editor-field-section">
                                    <div className="editor-field-section-heading"><strong>{t('Media')}</strong><small>{t('Recommended ratio 16:9')}</small></div>
                                    <ImagePicker label="Hero image" block={form.data.hero} onChange={updateHero} onFileSelect={(file) => openImageCropper(file, { type: 'hero' }, imageCropPresets.hero)} cropHint="Fixed crop: 16:9 banner" />
                                </div>
                            </div>
                        )}

                        {activePromo && (
                            <div className="storefront-editor-fields">
                                <div className="editor-field-section">
                                    <div className="editor-field-section-heading"><strong>{t('Content')}</strong><small>{t('Tile copy and destination')}</small></div>
                                    <div className="storefront-field-grid">
                                        <label className="form-field"><span>{t('Title')}</span><input value={activePromo.title} onChange={(e) => updatePromo(activePromoIndex, { title: e.target.value })} /></label>
                                        <label className="form-field"><span>{t('Button label')}</span><input value={activePromo.button_label} onChange={(e) => updatePromo(activePromoIndex, { button_label: e.target.value })} /></label>
                                        <label className="form-field span-2"><span>{t('Subtitle')}</span><input value={activePromo.subtitle} onChange={(e) => updatePromo(activePromoIndex, { subtitle: e.target.value })} /></label>
                                        <label className="form-field"><span>{t('Link')}</span><input value={activePromo.link_url} onChange={(e) => updatePromo(activePromoIndex, { link_url: e.target.value })} /></label>
                                        <label className="form-field"><span>{t('Accent color')}</span><div className="editor-color-control"><input type="color" value={activePromo.accent_color} onChange={(e) => updatePromo(activePromoIndex, { accent_color: e.target.value })} /><input value={activePromo.accent_color} onChange={(e) => updatePromo(activePromoIndex, { accent_color: e.target.value })} maxLength={7} /></div></label>
                                    </div>
                                </div>
                                <div className="editor-field-section">
                                    <div className="editor-field-section-heading"><strong>{t('Media')}</strong><small>{t('Recommended ratio 2:1')}</small></div>
                                    <ImagePicker label="Tile image" block={activePromo} onChange={(patch) => updatePromo(activePromoIndex, patch)} onFileSelect={(file) => openImageCropper(file, { type: 'promo', index: activePromoIndex }, imageCropPresets.promo)} cropHint="Fixed crop: 2:1 tile" />
                                </div>
                            </div>
                        )}

                        {activeSection && (
                            <div className="storefront-editor-fields">
                                <div className="editor-field-section">
                                    <div className="editor-field-section-heading"><strong>{t('Section content')}</strong><small>{t('Customer-facing heading and description')}</small></div>
                                    <div className="storefront-field-grid one-column">
                                        <label className="form-field"><span>{t('Section title')}</span><input value={activeSection.title} onChange={(e) => updateSection(activeSectionIndex, { title: e.target.value })} /></label>
                                        <label className="form-field"><span>{t('Subtitle')}</span><input value={activeSection.subtitle} onChange={(e) => updateSection(activeSectionIndex, { subtitle: e.target.value })} /></label>
                                    </div>
                                </div>
                                <div className="editor-field-section">
                                    <div className="editor-field-section-heading"><strong>{t('Section order')}</strong><small>{t('Move this block on the homepage')}</small></div>
                                    <div className="section-order-control">
                                        <span><Icon name="menu" size={15} /> {activeSectionIndex + 1} / {form.data.sections.length}</span>
                                        <div>
                                            <button type="button" className="btn secondary" disabled={activeSectionIndex === 0} onClick={() => moveSection(activeSectionIndex, -1)}><Icon name="chevronUp" size={14} />{t('Move up')}</button>
                                            <button type="button" className="btn secondary" disabled={activeSectionIndex === form.data.sections.length - 1} onClick={() => moveSection(activeSectionIndex, 1)}><Icon name="chevronDown" size={14} />{t('Move down')}</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    <aside className="storefront-live-preview-pane">
                        <div className="storefront-preview-toolbar">
                            <div><p className="eyebrow">{t('Live preview')}</p><strong>{activeTitle}</strong></div>
                            <div className="preview-device-toggle" aria-label={t('Preview size')}>
                                {[['desktop', 'desktop'], ['tablet', 'desktop'], ['mobile', 'mobile']].map(([mode, icon]) => (
                                    <button key={mode} type="button" className={previewMode === mode ? 'active' : ''} onClick={() => setPreviewMode(mode)} aria-label={t(mode)} title={t(mode)}><Icon name={icon} size={14} /></button>
                                ))}
                            </div>
                        </div>
                        <StorefrontLivePreview hero={form.data.hero} promo={activePromo} section={activeSection} mode={previewMode} t={t} />
                        <a className="btn secondary storefront-open-link" href={app_url || routeWithBase('/', app_base)} target="_blank" rel="noreferrer"><Icon name="external" size={14} />{t('Open storefront')}</a>
                    </aside>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="editor-action-bar storefront-action-bar">
                    <div className="editor-save-state">
                        <span className={hasChanges ? 'is-dirty' : 'is-clean'} />
                        <div>
                            <strong>{form.recentlySuccessful ? t('Storefront saved') : hasChanges ? t('Unsaved changes') : t('All changes saved')}</strong>
                            <small>{t('Changes become public after you save the storefront.')}</small>
                        </div>
                    </div>
                    <div className="editor-action-buttons">
                        <button type="button" className="btn secondary" disabled={!hasChanges || form.processing} onClick={() => { form.reset(); form.clearErrors(); setActiveBlock('hero'); }}>{t('Discard changes')}</button>
                        <a className="btn secondary" href={app_url || routeWithBase('/', app_base)} target="_blank" rel="noreferrer"><Icon name="eye" size={14} />{t('Preview')}</a>
                        <button type="submit" className="btn primary" disabled={form.processing || !hasChanges}><Icon name="check" size={14} />{form.processing ? t('Saving...') : t('Save storefront')}</button>
                    </div>
                </div>
            </form>

            <CropImageModal
                open={!!cropper}
                image={cropper?.image}
                onCropComplete={handleCropComplete}
                onCancel={() => setCropper(null)}
                aspect={cropper?.aspect || 16 / 9}
                title={t(cropper?.title || 'Crop image')}
                ratioLabel={cropper?.ratioLabel}
                outputType={cropper?.outputType || 'image/jpeg'}
            />
        </AdminLayout>
    );
}

function StorefrontLivePreview({ hero, promo, section, mode, t }) {
    const selectedBlock = promo || hero;
    const accent = selectedBlock?.accent_color || '#087f74';

    return (
        <div className="storefront-device-stage" data-device={mode}>
            <div className="storefront-device-frame">
                <div className="storefront-mini-browser"><span /><span /><span /><i /></div>
                {section ? (
                    <div className="storefront-section-preview">
                        <small>{t('Homepage section')}</small>
                        <h3>{section.title || t(sectionLabels[section.key] || section.key)}</h3>
                        <p>{section.subtitle || t('Section subtitle')}</p>
                        <div className="storefront-section-skeleton"><span /><span /><span /></div>
                        {!section.is_active && <div className="storefront-preview-hidden">{t('Hidden')}</div>}
                    </div>
                ) : promo ? (
                    <div className="storefront-promo-page-preview">
                        <div className="storefront-promo-tile-preview" style={{ background: accent }}>
                            <ImagePreviewOverlay block={promo} />
                            <div className="storefront-promo-copy">
                                <small>{t('Curated set')}</small>
                                <h3>{promo.title || t('Title')}</h3>
                                <p>{promo.subtitle || t('Subtitle')}</p>
                            </div>
                            <svg className="storefront-promo-sparkles" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M10.4 2.5 12 7.4l4.9 1.8-4.9 1.7-1.6 5-1.7-5-4.9-1.7 4.9-1.8 1.7-4.9Zm7.2 10.2.8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8.8-2.3Zm-12.8 2 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
                            </svg>
                            {!promo.is_active && <div className="storefront-preview-hidden">{t('Hidden')}</div>}
                        </div>
                    </div>
                ) : (
                    <div className="storefront-block-preview is-hero" style={{ background: accent }}>
                        <ImagePreviewOverlay block={selectedBlock} />
                        <div>
                            <small>{t('Hero banner')}</small>
                            <h3>{selectedBlock?.title || t('Title')}</h3>
                            <p>{selectedBlock?.subtitle || t('Subtitle')}</p>
                            <span>{selectedBlock?.button_label || t('Shop now')}</span>
                        </div>
                        {!selectedBlock?.is_active && <div className="storefront-preview-hidden">{t('Hidden')}</div>}
                    </div>
                )}
            </div>
        </div>
    );
}

function ImagePreviewOverlay({ block }) {
    const objectUrl = useObjectUrl(block.image);
    const src = block.remove_image ? null : objectUrl || block.image_url;

    if (!src) return null;

    return <img className="storefront-preview-image" src={src} alt="" />;
}
