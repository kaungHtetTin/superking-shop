import { router, usePage } from '@/spa/router';
import { routeWithBase } from '@/Utils/url';

function valueAtPath(source, path) {
    return path.split('.').reduce((value, key) => value?.[key], source);
}

function interpolate(value, replacements = {}) {
    return Object.entries(replacements).reduce(
        (text, [key, replacement]) => text.replaceAll(`:${key}`, replacement),
        value,
    );
}

export function useTranslation(namespace = 'navigation') {
    const { translations = {} } = usePage().props;
    const dictionary = translations?.[namespace] || {};

    return (key, fallback = key, replacements = {}) => {
        const value = valueAtPath(dictionary, key);

        if (typeof value !== 'string') {
            return fallback;
        }

        return interpolate(value, replacements);
    };
}

export function translatePhrase(dictionary, text, replacements = {}) {
    if (typeof text !== 'string' || text === '') {
        return text;
    }

    const phrases = dictionary?.phrases || {};
    if (typeof phrases[text] === 'string') {
        return interpolate(phrases[text], replacements);
    }

    const dynamicPatterns = [
        ['Order ', 'Order :value'],
        ['Customer ', 'Customer :value'],
        ['Edit ', 'Edit :value'],
        ['Chat • ', 'Chat • :value'],
    ];

    for (const [prefix, key] of dynamicPatterns) {
        if (text.startsWith(prefix) && typeof phrases[key] === 'string') {
            return interpolate(phrases[key], { value: text.slice(prefix.length) });
        }
    }

    if (text.endsWith(' Inventory') && typeof phrases[':value Inventory'] === 'string') {
        return interpolate(phrases[':value Inventory'], { value: text.slice(0, -10) });
    }

    return interpolate(text, replacements);
}

export function usePhraseTranslation(namespace = 'navigation') {
    const { translations = {} } = usePage().props;
    const dictionary = translations?.[namespace] || {};

    return (text, replacements = {}) => translatePhrase(dictionary, text, replacements);
}

export function useLocale() {
    const page = usePage();
    const { app_base, locale = 'en', supported_locales = {} } = page.props;
    const isAdminArea = String(page.url || '').split('?')[0].includes('/admin');

    const setLocale = (nextLocale) => {
        if (!nextLocale || nextLocale === locale) return;

        router.post(
            routeWithBase(isAdminArea ? '/admin/locale' : '/locale', app_base),
            { locale: nextLocale },
            {
                preserveScroll: true,
                preserveState: false,
            },
        );
    };

    return { locale, supportedLocales: supported_locales, setLocale };
}
