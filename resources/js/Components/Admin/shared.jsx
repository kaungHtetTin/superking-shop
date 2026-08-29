import { useEffect, useRef, useState } from 'react';
import Icon from '@/Components/Admin/icons';
import { usePhraseTranslation } from '@/Utils/i18n';

const STATUS_MAP = {
    success: 'status-success',
    paid: 'status-success',
    delivered: 'status-success',
    available: 'status-success',
    healthy: 'status-success',
    warning: 'status-warning',
    pending: 'status-warning',
    pending_review: 'status-warning',
    unpaid: 'status-warning',
    danger: 'status-danger',
    error: 'status-danger',
    rejected: 'status-danger',
    cancelled: 'status-danger',
    failed: 'status-danger',
    info: 'status-info',
    processing: 'status-info',
    shipped: 'status-info',
    assigned: 'status-info',
    primary: 'status-info',
    neutral: 'status-neutral',
    default: 'status-neutral',
    offline: 'status-neutral',
    inactive: 'status-neutral',
    super_admin: 'status-info',
    manager: 'status-success',
    staff: 'status-neutral',
};

export function statusClass(value) {
    const key = String(value || 'neutral').toLowerCase().replace(/\s+/g, '_');
    return STATUS_MAP[key] || 'status-neutral';
}

export function StatusBadge({ status, label }) {
    const cls = statusClass(status);
    const t = usePhraseTranslation();

    return (
        <span className={`status ${cls}`}>
            <span className="status-dot" />
            {t(label || status)}
        </span>
    );
}

export function PanelHeading({ eyebrow, title, action, actionLabel, onAction }) {
    const t = usePhraseTranslation();

    return (
        <div className="panel-heading">
            <div>
                {eyebrow && <p className="eyebrow">{t(eyebrow)}</p>}
                <h2>{t(title)}</h2>
            </div>
            {action}
            {!action && actionLabel && onAction && (
                <button className="text-btn" type="button" onClick={onAction}>
                    {t(actionLabel)}
                </button>
            )}
        </div>
    );
}

export function ColumnVisibilityControl({ columns, visible, onToggle }) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const t = usePhraseTranslation();

    useEffect(() => {
        const closeOutside = (event) => {
            if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
        };
        const closeOnEscape = (event) => event.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', closeOutside);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('mousedown', closeOutside);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, []);

    return (
        <div className="column-visibility-control" ref={wrapRef}>
            <button
                type="button"
                className="btn secondary"
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={() => setOpen((value) => !value)}
            >
                <Icon name="grid" size={13} />
                {t('Columns')}
            </button>
            {open && (
                <div className="column-visibility-menu glass" role="menu">
                    <p className="eyebrow">{t('Visible columns')}</p>
                    {columns.map((column) => (
                        <label key={column.key}>
                            <input
                                type="checkbox"
                                checked={column.locked || visible[column.key] !== false}
                                disabled={column.locked}
                                onChange={() => onToggle(column.key)}
                            />
                            <span>{t(column.label)}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

const BRAND_PRESETS = ['#087f74', '#2874bc', '#7c3aed', '#e91e63', '#d17d19', '#168255'];

export function ThemeControl({ theme, onThemeChange, brand, onBrandChange, density = 'compact', onDensityChange }) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const t = usePhraseTranslation();

    useEffect(() => {
        const onDoc = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        const onKeyDown = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, []);

    return (
        <div className="theme-popover-wrap" ref={wrapRef}>
            <button
                type="button"
                className="icon-btn"
                aria-label={t('Theme settings')}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
            >
                <Icon name="palette" size={16} />
            </button>
            {open && (
                <div className="theme-popover glass">
                    <p className="eyebrow">{t('Appearance')}</p>
                    <div className="segmented" style={{ marginTop: 8 }}>
                        <button
                            type="button"
                            className={theme === 'light' ? 'active' : ''}
                            onClick={() => onThemeChange('light')}
                        >
                            <Icon name="sun" size={14} /> {t('Light')}
                        </button>
                        <button
                            type="button"
                            className={theme === 'dark' ? 'active' : ''}
                            onClick={() => onThemeChange('dark')}
                        >
                            <Icon name="moon" size={14} /> {t('Dark')}
                        </button>
                    </div>
                    {onDensityChange && (
                        <>
                            <p className="eyebrow" style={{ marginTop: 12 }}>{t('UI density')}</p>
                            <div className="segmented" style={{ marginTop: 8 }}>
                                <button type="button" className={density === 'compact' ? 'active' : ''} onClick={() => onDensityChange('compact')}>
                                    <Icon name="menu" size={14} /> {t('Compact')}
                                </button>
                                <button type="button" className={density === 'comfortable' ? 'active' : ''} onClick={() => onDensityChange('comfortable')}>
                                    <Icon name="grid" size={14} /> {t('Comfortable')}
                                </button>
                            </div>
                        </>
                    )}
                    <p className="eyebrow" style={{ marginTop: 12 }}>
                        {t('Brand color')}
                    </p>
                    <div className="color-swatches">
                        {BRAND_PRESETS.map((color) => (
                            <button
                                key={color}
                                type="button"
                                className={brand === color ? 'active' : ''}
                                style={{ background: color }}
                                aria-label={`${t('Brand color')} ${color}`}
                                onClick={() => onBrandChange(color)}
                            />
                        ))}
                    </div>
                    <label className="form-field" style={{ marginTop: 10 }}>
                        <span>{t('Custom')}</span>
                        <input type="color" value={brand} onChange={(e) => onBrandChange(e.target.value)} />
                    </label>
                </div>
            )}
        </div>
    );
}

export function AdminLogo({ settings }) {
    const appName = settings?.app_name || 'LaLaPick';
    const t = usePhraseTranslation();

    return (
        <div className="admin-logo">
            {settings?.logo_url ? (
                <img
                    src={settings.logo_url}
                    alt=""
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: 6,
                        objectFit: 'contain',
                        background: '#fff',
                        flexShrink: 0,
                    }}
                />
            ) : (
                <span
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: 6,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'var(--color-primary)',
                        color: '#fff',
                        flexShrink: 0,
                    }}
                >
                    <Icon name="shop" size={18} />
                </span>
            )}
            <div>
                <strong>{appName}</strong>
                <small className="muted">{t('Admin console')}</small>
            </div>
        </div>
    );
}
