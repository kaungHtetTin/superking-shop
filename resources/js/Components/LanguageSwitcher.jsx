import { useLocale, useTranslation } from '@/Utils/i18n';
import { Translate } from '@mui/icons-material';

export default function LanguageSwitcher({ className = '', compact = false }) {
    const { locale, supportedLocales, setLocale } = useLocale();
    const t = useTranslation();
    const label = t('language.label', 'Language');

    return (
        <label className={`language-switcher ${compact ? 'compact' : ''} ${className}`.trim()}>
            <span className="language-switcher-icon" aria-hidden="true">
                <Translate fontSize="inherit" />
            </span>
            {!compact && <span className="language-switcher-label">{label}</span>}
            <select
                value={locale}
                aria-label={label}
                title={label}
                onChange={(event) => setLocale(event.target.value)}
            >
                {Object.entries(supportedLocales).map(([code, label]) => (
                    <option key={code} value={code}>
                        {label}
                    </option>
                ))}
            </select>
        </label>
    );
}
