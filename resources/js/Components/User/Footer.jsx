import React from 'react';
import { Link, usePage } from '@/spa/router';
import {
    Box,
    Container,
    Divider,
    Stack,
    Typography,
} from '@mui/material';
import {
    EmailOutlined,
    Facebook,
    Headphones,
    MusicNote,
    PhoneOutlined,
} from '@mui/icons-material';
import { routeWithBase } from '@/Utils/url';
import { useTheme } from '@mui/material/styles';
import { getMusicStoreColors, musicGradientForTheme } from '@/Components/User/musicStoreDesign';
import { useTranslation } from '@/Utils/i18n';

const asArray = (value) =>
    Array.isArray(value)
        ? value.map((item) => (item == null ? '' : String(item).trim())).filter(Boolean)
        : [];

const socialHref = (value, platform) => {
    if (!value) return '#';
    if (/^https?:\/\//i.test(value)) return value;

    const clean = value.replace(/^@/, '').replace(/^\/+/, '');

    if (platform === 'facebook') {
        return `https://facebook.com/${clean}`;
    }

    return `https://tiktok.com/@${clean}`;
};

function ContactList({ title, items, icon, hrefFor }) {
    if (items.length === 0) return null;

    return (
        <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>
                {title}
            </Typography>
            <Stack spacing={0.75}>
                {items.map((item) => (
                    <Typography
                        key={`${title}-${item}`}
                        component="a"
                        href={hrefFor(item)}
                        target={hrefFor(item).startsWith('http') ? '_blank' : undefined}
                        rel={hrefFor(item).startsWith('http') ? 'noopener noreferrer' : undefined}
                        variant="caption"
                        sx={{
                            color: 'inherit',
                            textDecoration: 'none',
                            opacity: 0.86,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.75,
                            wordBreak: 'break-word',
                            '&:hover': { opacity: 1, textDecoration: 'underline' },
                        }}
                    >
                        {icon}
                        {item}
                    </Typography>
                ))}
            </Stack>
        </Box>
    );
}

export default function Footer() {
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);
    const { app_base, app_settings } = usePage().props;
    const t = useTranslation();
    const appName = app_settings?.app_name || 'Harmony House';
    const contacts = app_settings?.contacts || {};
    const emails = asArray(contacts.email);
    const phones = asArray(contacts.phone);
    const facebook = asArray(contacts.facebook);
    const tiktok = asArray(contacts.tiktok);
    const hasContacts = [emails, phones, facebook, tiktok].some((items) => items.length > 0);

    return (
        <Box
            component="footer"
            sx={{
                background: musicGradientForTheme(theme),
                color: 'white',
                py: { xs: '24px', md: '32px' },
                mt: 'auto',
                borderTop: `1px solid ${musicColors.amber}`,
            }}
        >
            <Container maxWidth="lg">
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1.1fr 0.9fr', md: hasContacts ? '1.1fr 0.8fr 1.4fr' : '1.2fr 1fr' },
                        gap: { xs: '20px', md: '28px' },
                    }}
                >
                    <Box>
                        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
                            {app_settings?.logo_url && (
                                <Box
                                    component="img"
                                    src={app_settings.logo_url}
                                    alt=""
                                    sx={{
                                        width: 32,
                                        height: 32,
                                        objectFit: 'contain',
                                        borderRadius: 1,
                                        bgcolor: musicColors.sheet,
                                    }}
                                />
                            )}
                            {!app_settings?.logo_url && (
                                <Box
                                    sx={{
                                        width: 32,
                                        height: 32,
                                        display: 'grid',
                                        placeItems: 'center',
                                        borderRadius: 1.5,
                                        bgcolor: musicColors.amber,
                                        color: musicColors.ink,
                                    }}
                                >
                                    <MusicNote fontSize="small" />
                                </Box>
                            )}
                            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
                                {appName}
                            </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ opacity: 0.84, display: 'block', maxWidth: 320 }}>
                            {t('storefront.footer_text', 'Instruments, accessories, and essentials for practice rooms, studios, and stages.')}
                        </Typography>
                    </Box>

                    <Box>
                        <Typography variant="caption" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>
                            {t('storefront.shop', 'Shop')}
                        </Typography>
                        <Stack spacing={0.75}>
                            <Typography
                                component={Link}
                                href={routeWithBase('/products?sort=newest', app_base)}
                                variant="caption"
                                sx={{ opacity: 0.86, color: 'inherit', textDecoration: 'none', '&:hover': { opacity: 1, textDecoration: 'underline' } }}
                            >
                                {t('storefront.new_arrivals', 'New arrivals')}
                            </Typography>
                            <Typography
                                component={Link}
                                href={routeWithBase('/products?sort=best_selling', app_base)}
                                variant="caption"
                                sx={{ opacity: 0.86, color: 'inherit', textDecoration: 'none', '&:hover': { opacity: 1, textDecoration: 'underline' } }}
                            >
                                {t('storefront.best_sellers', 'Best sellers')}
                            </Typography>
                            <Typography
                                component={Link}
                                href={routeWithBase('/buying-guide', app_base)}
                                variant="caption"
                                sx={{ opacity: 0.86, color: 'inherit', textDecoration: 'none', '&:hover': { opacity: 1, textDecoration: 'underline' } }}
                            >
                                {t('storefront.buying_guides', 'Buying guides')}
                            </Typography>
                            <Typography
                                component={Link}
                                href={routeWithBase('/blogs', app_base)}
                                variant="caption"
                                sx={{ opacity: 0.86, color: 'inherit', textDecoration: 'none', '&:hover': { opacity: 1, textDecoration: 'underline' } }}
                            >
                                {t('storefront.blog', 'Blog')}
                            </Typography>
                        </Stack>
                    </Box>

                    {hasContacts && (
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                gap: 2,
                            }}
                        >
                            <ContactList
                                title={t('storefront.email', 'Email')}
                                items={emails}
                                icon={<EmailOutlined sx={{ fontSize: 14 }} />}
                                hrefFor={(item) => `mailto:${item}`}
                            />
                            <ContactList
                                title={t('storefront.phone', 'Phone')}
                                items={phones}
                                icon={<PhoneOutlined sx={{ fontSize: 14 }} />}
                                hrefFor={(item) => `tel:${item.replace(/\s+/g, '')}`}
                            />
                            <ContactList
                                title="Facebook"
                                items={facebook}
                                icon={<Facebook sx={{ fontSize: 14 }} />}
                                hrefFor={(item) => socialHref(item, 'facebook')}
                            />
                            <ContactList
                                title="TikTok"
                                items={tiktok}
                                icon={<MusicNote sx={{ fontSize: 14 }} />}
                                hrefFor={(item) => socialHref(item, 'tiktok')}
                            />
                        </Box>
                    )}
                </Box>

                <Divider sx={{ my: { xs: '20px', md: '24px' }, bgcolor: 'rgba(244,194,103,0.22)' }} />
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ opacity: 0.72, mb: 0.75 }}>
                    <Headphones sx={{ fontSize: 15 }} />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {t('storefront.footer_note', 'Built for musicians, teachers, producers, and first-time players.')}
                    </Typography>
                </Stack>
                <Typography variant="caption" sx={{ textAlign: 'center', display: 'block', opacity: 0.64 }}>
                    {t('storefront.copyright', `Copyright ${new Date().getFullYear()} ${appName}.`, { year: new Date().getFullYear(), app: appName })}
                </Typography>
                <Typography
                    component="a"
                    href="https://k2softwarestudio.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="caption"
                    sx={{
                        mt: 0.5,
                        textAlign: 'center',
                        display: 'block',
                        color: 'inherit',
                        textDecoration: 'none',
                        opacity: 0.64,
                        '&:hover': { opacity: 1, textDecoration: 'underline' },
                    }}
                >
                    {t('storefront.developed_by', 'Developed by k2softwarestudio.com')}
                </Typography>
            </Container>
        </Box>
    );
}
