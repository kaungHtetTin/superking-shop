import { useEffect, useRef, useState } from 'react';
import { Head, Link, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading } from '@/Components/Admin/shared';
import CropImageModal from '@/Components/Admin/CropImageModal';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

const emptyPost = {
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    blog_category_id: '',
    category_name: '',
    tags: '',
    youtube_url: '',
    status: 'draft',
    published_at: '',
    cover_image: null,
    remove_cover_image: false,
};

const toDateTimeInput = (value) => {
    if (!value) return '';
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const buildInitialData = (post) => {
    if (!post) return { ...emptyPost };

    return {
        title: post.title || '',
        slug: post.slug || '',
        excerpt: post.excerpt || '',
        content: post.content || '',
        blog_category_id: post.blog_category_id || '',
        category_name: '',
        tags: (post.tags || []).map((tag) => tag.name).join(', '),
        youtube_url: post.youtube_url || '',
        status: post.status || 'draft',
        published_at: toDateTimeInput(post.published_at),
        cover_image: null,
        remove_cover_image: false,
    };
};

const useObjectUrl = (file) => {
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
};

const extractYoutubeId = (value) => {
    const patterns = [
        /youtu\.be\/([A-Za-z0-9_-]{11})/,
        /youtube\.com\/watch\?.*v=([A-Za-z0-9_-]{11})/,
        /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
        /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
        const match = value?.match(pattern);
        if (match) return match[1];
    }

    return null;
};

function RichTextEditor({ value, onChange, t }) {
    const ref = useRef(null);
    const tools = [
        { label: 'Bold', text: 'B', action: () => command('bold') },
        { label: 'Italic', text: 'I', action: () => command('italic') },
        { label: 'Underline', text: 'U', action: () => command('underline') },
        { label: 'Heading 2', text: 'H2', action: () => command('formatBlock', 'h2') },
        { label: 'Heading 3', text: 'H3', action: () => command('formatBlock', 'h3') },
        { label: 'Unordered list', text: 'UL', action: () => command('insertUnorderedList') },
        { label: 'Ordered list', text: '1.', action: () => command('insertOrderedList') },
        { label: 'Quote', text: 'Q', action: () => command('formatBlock', 'blockquote') },
        { label: 'Paragraph', text: 'P', action: () => command('formatBlock', 'p') },
    ];

    useEffect(() => {
        if (ref.current && ref.current.innerHTML !== (value || '')) {
            ref.current.innerHTML = value || '';
        }
    }, [value]);

    const command = (name, arg = null) => {
        document.execCommand(name, false, arg);
        onChange(ref.current?.innerHTML || '');
        ref.current?.focus();
    };

    return (
        <div className="rich-editor">
            <div className="rich-editor-toolbar" aria-label={t('Text formatting')}>
                {tools.map((tool) => (
                    <button key={tool.label} type="button" onClick={tool.action} title={t(tool.label)} aria-label={t(tool.label)}>
                        {tool.text}
                    </button>
                ))}
            </div>
            <div
                ref={ref}
                className="rich-editor-surface"
                contentEditable
                onInput={(event) => onChange(event.currentTarget.innerHTML)}
                suppressContentEditableWarning
            />
        </div>
    );
}

export default function BlogForm({ post = null, categories = [], tags = [], statuses = [], mode = 'create' }) {
    const { app_base, flash } = usePage().props;
    const t = usePhraseTranslation();
    const [cropper, setCropper] = useState(null);
    const form = useForm(buildInitialData(post));
    const coverObjectUrl = useObjectUrl(form.data.cover_image);
    const coverPreview = form.data.remove_cover_image ? null : coverObjectUrl || post?.cover_image_url;
    const youtubeId = extractYoutubeId(form.data.youtube_url);

    const openCropper = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setCropper({ image: reader.result, name: file.name });
        reader.readAsDataURL(file);
    };

    const handleCropComplete = (blob) => {
        const source = (cropper?.name || 'blog-cover').replace(/\.[^.]+$/, '').replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
        const cropped = new File([blob], `${source || 'blog-cover'}-crop-${Date.now()}.jpg`, {
            type: blob.type || 'image/jpeg',
        });

        form.setData({ ...form.data, cover_image: cropped, remove_cover_image: false });
        setCropper(null);
    };

    const submit = (event) => {
        event.preventDefault();
        const options = { forceFormData: true, preserveScroll: true };

        if (mode === 'edit') {
            form.post(routeWithBase(`/admin/blogs/${post.id}`, app_base), options);
        } else {
            form.post(routeWithBase('/admin/blogs', app_base), options);
        }
    };

    return (
        <AdminLayout
            title={mode === 'edit' ? `${t('Edit')}: ${post.title}` : t('New blog post')}
            eyebrow={t('Marketing')}
            action={
                <button type="button" className="btn primary" onClick={submit} disabled={form.processing}>
                    <Icon name="check" size={14} />
                    {form.processing ? t('Saving...') : mode === 'edit' ? t('Save changes') : t('Publish draft')}
                </button>
            }
        >
            <Head title={mode === 'edit' ? t('Edit Blog') : t('Create Blog')} />
            <AdminFlash flash={flash} errors={form.errors} />

            <div className="sticky-toolbar">
                <Link href={routeWithBase('/admin/blogs', app_base)} className="back-link" style={{ marginBottom: 0 }}>
                    <Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} />
                    {t('Back to blogs')}
                </Link>
            </div>

            <form onSubmit={submit} className="blog-form-layout">
                <section className="panel glass">
                    <PanelHeading eyebrow={t('Article')} title={t('Content')} />
                    <div className="crud-grid">
                        <label className="form-field span-2">
                            <span>{t('Title')}</span>
                            <input value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} required />
                        </label>
                        <label className="form-field span-2">
                            <span>{t('Slug')}</span>
                            <input value={form.data.slug} onChange={(e) => form.setData('slug', e.target.value)} placeholder={t('Auto-generated from title')} />
                        </label>
                        <label className="form-field span-2">
                            <span>{t('Excerpt')}</span>
                            <textarea value={form.data.excerpt} onChange={(e) => form.setData('excerpt', e.target.value)} rows={3} />
                        </label>
                        <div className="form-field span-2">
                            <span>{t('Content')}</span>
                            <RichTextEditor value={form.data.content} onChange={(value) => form.setData('content', value)} t={t} />
                        </div>
                    </div>
                </section>

                <aside className="blog-form-side">
                    <section className="panel glass">
                        <PanelHeading eyebrow={t('Publishing')} title={t('Settings')} />
                        <div className="crud-grid">
                            <label className="form-field span-2">
                                <span>{t('Status')}</span>
                                <select value={form.data.status} onChange={(e) => form.setData('status', e.target.value)}>
                                    {(statuses.length ? statuses : ['draft', 'published', 'archived']).map((status) => (
                                        <option key={status} value={status}>{t(status)}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="form-field span-2">
                                <span>{t('Published date')}</span>
                                <input type="datetime-local" value={form.data.published_at} onChange={(e) => form.setData('published_at', e.target.value)} />
                            </label>
                            <label className="form-field span-2">
                                <span>{t('Category')}</span>
                                <select
                                    value={form.data.blog_category_id}
                                    onChange={(e) => form.setData({ ...form.data, blog_category_id: e.target.value, category_name: '' })}
                                >
                                    <option value="">{t('No category')}</option>
                                    {categories.map((category) => (
                                        <option key={category.id} value={category.id}>{category.name}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="form-field span-2">
                                <span>{t('New category')}</span>
                                <input
                                    value={form.data.category_name}
                                    onChange={(e) => form.setData({ ...form.data, category_name: e.target.value, blog_category_id: '' })}
                                    placeholder={t('Optional')}
                                />
                            </label>
                            <label className="form-field span-2">
                                <span>{t('Tags')}</span>
                                <input
                                    value={form.data.tags}
                                    onChange={(e) => form.setData('tags', e.target.value)}
                                    placeholder={tags.slice(0, 3).map((tag) => tag.name).join(', ') || t('Gift guide, New arrival')}
                                />
                            </label>
                        </div>
                    </section>

                    <section className="panel glass">
                        <PanelHeading eyebrow={t('Media')} title={t('Cover and video')} />
                        <div className="blog-cover-picker">
                            <div className="blog-cover-preview">
                                {coverPreview ? <img src={coverPreview} alt="" /> : <Icon name="image" size={22} />}
                            </div>
                            <div className="storefront-image-actions">
                                <label className="btn secondary">
                                    <Icon name="image" size={13} />
                                    {t('Upload cover')}
                                    <input
                                        className="sr-only-file"
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={(event) => {
                                            const file = event.target.files?.[0] || null;
                                            event.target.value = '';
                                            if (file) openCropper(file);
                                        }}
                                    />
                                </label>
                                {coverPreview && (
                                    <button type="button" className="icon-btn small danger" onClick={() => form.setData({ ...form.data, cover_image: null, remove_cover_image: true })}>
                                        <Icon name="trash" size={13} />
                                    </button>
                                )}
                            </div>
                            <small className="muted">{t('Fixed crop: 16:9 article cover')}</small>
                        </div>

                        <label className="form-field" style={{ marginTop: 14 }}>
                            <span>{t('YouTube URL')}</span>
                            <input value={form.data.youtube_url} onChange={(e) => form.setData('youtube_url', e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
                        </label>
                        {youtubeId && (
                            <div className="blog-video-preview">
                                <iframe
                                    title={t('YouTube preview')}
                                    src={`https://www.youtube.com/embed/${youtubeId}`}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                />
                            </div>
                        )}
                    </section>
                </aside>
            </form>

            <CropImageModal
                open={!!cropper}
                image={cropper?.image}
                onCropComplete={handleCropComplete}
                onCancel={() => setCropper(null)}
                aspect={16 / 9}
                title={t('Crop blog cover')}
                ratioLabel="16:9"
            />
        </AdminLayout>
    );
}
