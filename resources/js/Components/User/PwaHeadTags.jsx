import { useEffect } from 'react';
import { usePage } from '@/spa/router';

export default function PwaHeadTags() {
    const { app_base, app_settings } = usePage().props;
    const appName = app_settings?.app_name || 'Harmony House';
    const manifestUrl = `${app_base || ''}/manifest.webmanifest`;
    const iconUrl = app_settings?.favicon_url || app_settings?.logo_url || `${app_base || ''}/pwa-icon.svg`;
    const themeColor = app_settings?.theme_color || '#9c3f2c';

    useEffect(() => {
        const definitions = [
            ['link', { rel: 'manifest', href: manifestUrl }],
            ['link', { rel: 'icon', href: iconUrl }],
            ['link', { rel: 'apple-touch-icon', href: iconUrl }],
            ['meta', { name: 'theme-color', content: themeColor }],
            ['meta', { name: 'mobile-web-app-capable', content: 'yes' }],
            ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
            ['meta', { name: 'apple-mobile-web-app-title', content: appName }],
            ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }],
            ['meta', { name: 'application-name', content: appName }],
            ['meta', { name: 'msapplication-TileColor', content: themeColor }],
        ];

        const nodes = definitions.map(([tag, attributes]) => {
            const node = document.createElement(tag);
            Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
            node.setAttribute('data-spa-pwa-head', 'true');
            document.head.appendChild(node);
            return node;
        });

        return () => nodes.forEach((node) => node.remove());
    }, [appName, iconUrl, manifestUrl, themeColor]);

    return null;
}
