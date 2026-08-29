import React from 'react';
import { usePage, Link } from '@/spa/router';
import { routeWithBase } from '@/Utils/url';
import {
    Box,
    Container,
    Typography,
    Button,
    Stack,
    Avatar,
    Chip,
} from '@mui/material';
import {
    ArrowForward,
    LocalFireDepartment,
    AutoAwesome,
    ArticleOutlined,
    PlayCircle,
    AccountBalanceWallet,
    Piano,
    GraphicEq,
    Headphones,
    Speaker,
    LibraryMusic,
    MusicNote,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import ProductCard from '@/Components/User/ProductCard';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { blogThumbnailSource } from '@/Utils/blogMedia';
import { productListGridSx } from '@/Utils/productListGrid';
import {
    eyebrowSx,
    eyebrowSxForTheme,
    getMusicStoreColors,
    musicGradientForTheme,
    sectionShellSxForTheme,
    storefrontBackgroundSx,
} from '@/Components/User/musicStoreDesign';
import { usePhraseTranslation } from '@/Utils/i18n';

const defaultSections = {
    categories: { title: 'Shop by sound', subtitle: 'Find the right instrument family for your next session.', is_active: true },
    flash_sale: { title: null, is_active: true },
    promos: { title: null, is_active: true },
    best_sellers: { title: null, subtitle: null, is_active: true },
    blogs: { title: 'Player guides', subtitle: 'Care tips, buying advice, and setup ideas from the shop.', is_active: true },
};

const defaultHero = {
    title: 'Tune up your next performance',
    subtitle: 'Shop instruments, accessories, and studio-ready gear selected for players at every level.',
    button_label: 'Explore the shop',
    link_url: '/products',
    accent_color: null,
    image_url: null,
};

const fallbackPromos = [
    {
        id: 'editors-picks',
        title: 'For the rehearsal room',
        subtitle: 'Strings, picks, sticks, cables, and everyday essentials',
        link_url: '/products',
        accent_color: null,
        image_url: null,
    },
    {
        id: 'new-arrivals',
        title: 'New on the wall',
        subtitle: 'Fresh guitars, keyboards, percussion, and recording tools',
        link_url: '/products?sort=newest',
        accent_color: null,
        image_url: null,
    },
];

const categoryIconCycle = [Piano, GraphicEq, Headphones, Speaker, LibraryMusic, MusicNote];

const isExternal = (href) => /^https?:\/\//i.test(href || '');
const blockHref = (href, appBase) => {
    if (!href) return routeWithBase('/products', appBase);
    return isExternal(href) ? href : routeWithBase(href, appBase);
};

function blockLinkProps(href, appBase) {
    const resolved = blockHref(href, appBase);
    if (isExternal(resolved)) {
        return { component: 'a', href: resolved, target: '_blank', rel: 'noopener noreferrer' };
    }

    return { component: Link, href: resolved };
}

const formatBlogDate = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

function SectionHeader({ eyebrow, title, subtitle, action }) {
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);
    const t = usePhraseTranslation();

    return (
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }} spacing="10px" sx={{ mb: '16px' }}>
            <Box>
                {eyebrow && <Typography sx={{ ...eyebrowSxForTheme(theme), mb: 0.5 }}>{t(eyebrow)}</Typography>}
                <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { xs: '1.2rem', md: '1.4rem' }, color: musicColors.ink, lineHeight: 1.2 }}>
                    {t(title)}
                </Typography>
                {subtitle && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 560, fontWeight: 600 }}>
                        {t(subtitle)}
                    </Typography>
                )}
            </Box>
            {action}
        </Stack>
    );
}

function HeroInstrumentArt() {
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);

    return (
        <Box
            sx={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 2,
                p: 3,
                opacity: 0.98,
            }}
        >
            <Box sx={{ alignSelf: 'end', transform: 'rotate(-8deg)', color: musicColors.amber }}>
                <Piano sx={{ fontSize: 154, filter: 'drop-shadow(0 20px 24px rgba(0,0,0,0.28))' }} />
            </Box>
            <Stack spacing={2} sx={{ justifyContent: 'center', color: 'rgba(255,255,255,0.9)' }}>
                <GraphicEq sx={{ fontSize: 92, color: musicColors.amber }} />
                <Headphones sx={{ fontSize: 110, ml: 5, filter: 'drop-shadow(0 18px 20px rgba(0,0,0,0.24))' }} />
                <MusicNote sx={{ fontSize: 66, color: musicColors.amber, ml: 2 }} />
            </Stack>
        </Box>
    );
}

function BlogPreviewCard({ post }) {
    const { app_base, app_settings } = usePage().props;
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);
    const thumbnail = blogThumbnailSource(post, app_settings);

    return (
        <Box
            component={Link}
            href={routeWithBase(`/blogs/${post.slug}`, app_base)}
            sx={{
                display: 'grid',
                gridTemplateRows: 'auto 1fr',
                bgcolor: 'white',
                border: '1px solid rgba(36,27,24,0.08)',
                borderRadius: 2,
                overflow: 'hidden',
                color: 'inherit',
                textDecoration: 'none',
                minHeight: 260,
                boxShadow: '0 14px 34px rgba(36,27,24,0.06)',
                '&:hover': { borderColor: musicColors.brass },
            }}
        >
            <Box sx={{ aspectRatio: '16 / 9', bgcolor: 'rgba(244,194,103,0.2)', display: 'grid', placeItems: 'center', overflow: 'hidden', position: 'relative' }}>
                {thumbnail.url ? (
                    <Box
                        component="img"
                        src={thumbnail.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        sx={{
                            width: thumbnail.type === 'app-icon' ? '46%' : '100%',
                            height: thumbnail.type === 'app-icon' ? '46%' : '100%',
                            objectFit: thumbnail.type === 'app-icon' ? 'contain' : 'cover',
                        }}
                    />
                ) : (
                    <ArticleOutlined sx={{ fontSize: 42, color: musicColors.rosin, opacity: 0.65 }} />
                )}
                {post.youtube_video_id && (
                    <PlayCircle sx={{ position: 'absolute', right: 10, bottom: 10, color: 'white', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.45))' }} />
                )}
            </Box>
            <Stack spacing="8px" sx={{ p: { xs: '16px', md: '18px' } }}>
                <Typography variant="caption" color="text.secondary">
                    {[post.category?.name, formatBlogDate(post.published_at)].filter(Boolean).join(' - ')}
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.25 }}>{post.title}</Typography>
                {post.excerpt && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {post.excerpt}
                    </Typography>
                )}
            </Stack>
        </Box>
    );
}

function ProductSectionEmpty({ title, subtitle }) {
    const { app_base } = usePage().props;
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);
    const sectionShellSx = sectionShellSxForTheme(theme);
    const t = usePhraseTranslation();

    return (
        <Box
            sx={{
                ...sectionShellSx,
                p: { xs: 3, md: 4 },
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'auto 1fr auto' },
                gap: { xs: 2, md: 3 },
                alignItems: 'center',
            }}
        >
            <Box
                sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(musicColors.rosin, 0.1),
                    color: musicColors.rosin,
                }}
            >
                <MusicNote sx={{ fontSize: 34 }} />
            </Box>
            <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: musicColors.ink, mb: 0.5 }}>
                    {t(title)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, maxWidth: 620 }}>
                    {t(subtitle)}
                </Typography>
            </Box>
            <Button
                component={Link}
                href={routeWithBase('/products', app_base)}
                variant="contained"
                endIcon={<ArrowForward />}
                sx={{ fontWeight: 700, justifySelf: { xs: 'stretch', md: 'end' } }}
            >
                {t('Browse catalog')}
            </Button>
        </Box>
    );
}

const Welcome = ({ products = [], productSection = null, categories, flashSaleProducts = [], activeFlashSale = null, flashSaleEvents = [], storefront = {}, latestBlogs = [], paymentMethods = [] }) => {
    const theme = useTheme();
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const musicColors = getMusicStoreColors(theme);
    const sectionShellSx = sectionShellSxForTheme(theme);
    const sections = { ...defaultSections, ...(storefront.sections || {}) };
    const featuredProducts = Array.isArray(products) ? products : [];
    const productSectionMeta = {
        source: 'new_arrivals',
        title: 'New arrivals on the wall',
        subtitle: 'Fresh instruments and gear ready for players to discover.',
        empty_title: 'No products are ready for the storefront yet',
        empty_subtitle: 'Create active products with available stock to show a polished customer-facing selection here.',
        ...(productSection || {}),
    };
    const hasConfiguredPromos = Array.isArray(storefront.promos) && storefront.promos.length > 0;
    const hero = storefront.hero || defaultHero;
    const promos = hasConfiguredPromos
        ? storefront.promos.filter((promo) => promo.is_active !== false)
        : fallbackPromos;
    const defaultAccent = alpha(theme.palette.primary.main, 0.12);
    const visibleFlashSaleEvents = Array.isArray(flashSaleEvents) && flashSaleEvents.length > 0
        ? flashSaleEvents.filter((sale) => !sale.ends_at || new Date(sale.ends_at).getTime() > Date.now())
        : activeFlashSale && flashSaleProducts.length > 0
            ? [{ ...activeFlashSale, products: flashSaleProducts }]
            : [];

    const displayCategories = categories.filter((cat) => Number(cat.products_count || 0) > 0).map((cat, index) => ({
        ...cat,
        Icon: categoryIconCycle[index % categoryIconCycle.length],
        icon: cat.metadata?.icon || cat.icon || null,
        imageUrl: cat.icon_image_url,
        color: cat.metadata?.color || defaultAccent,
    }));

    return (
        <Box
            className="user-storefront"
            sx={{
                minHeight: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                ...storefrontBackgroundSx(theme),
            }}
        >
            <UserBrandHead title="Home" />

            <Navbar />

            {hero.is_active !== false && (
                <Container maxWidth="lg" sx={{ mt: { xs: '16px', md: '24px' } }}>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: '1fr',
                                sm: hero.image_url ? '1.08fr 0.92fr' : '1fr',
                                md: '1.08fr 0.92fr',
                            },
                            gap: 0,
                            borderRadius: 2,
                            overflow: 'hidden',
                            background: hero.accent_color || musicGradientForTheme(theme),
                            minHeight: { xs: 280, sm: 340, md: 390 },
                            position: 'relative',
                            boxShadow: '0 24px 70px rgba(36, 27, 24, 0.22)',
                            border: '1px solid rgba(244,194,103,0.24)',
                        }}
                    >
                        <Box
                            sx={{
                                position: 'absolute',
                                inset: 0,
                                opacity: 0.16,
                                backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 58px, rgba(255,255,255,0.55) 58px 59px), repeating-linear-gradient(0deg, transparent 0 34px, rgba(255,255,255,0.28) 34px 35px)',
                            }}
                        />
                        <Box
                            sx={{
                                p: { xs: '20px', sm: '28px', md: '36px' },
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                color: 'white',
                                position: 'relative',
                                zIndex: 1,
                            }}
                        >
                            <Typography sx={{ ...eyebrowSx, color: musicColors.amber, mb: 1 }}>
                                {t('Musical instrument store')}
                            </Typography>
                            <Typography variant="h2" sx={{ fontWeight: 700, fontSize: { xs: '1.65rem', sm: '2rem', md: '2.5rem' }, mb: 1.25, lineHeight: 1.1, maxWidth: 620 }}>
                                {t(hero.title || defaultHero.title)}
                            </Typography>
                            <Typography variant="body1" sx={{ opacity: 0.88, mb: 3, maxWidth: 500, fontWeight: 600 }}>
                                {t(hero.subtitle || defaultHero.subtitle)}
                            </Typography>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }}>
                                <Button
                                    {...blockLinkProps(hero.link_url || '/products', app_base)}
                                    variant="contained"
                                    endIcon={<ArrowForward />}
                                    sx={{
                                        bgcolor: musicColors.amber,
                                        color: musicColors.ink,
                                        px: 3,
                                        py: 1.25,
                                        fontWeight: 700,
                                        '&:hover': { bgcolor: musicColors.amber },
                                    }}
                                >
                                    {t(hero.button_label || defaultHero.button_label)}
                                </Button>
                                <Button
                                    component={Link}
                                    href={routeWithBase('/categories', app_base)}
                                    variant="outlined"
                                    sx={{
                                        borderColor: 'rgba(255,255,255,0.36)',
                                        color: 'white',
                                        px: 2.5,
                                        py: 1.25,
                                        fontWeight: 700,
                                        '&:hover': { borderColor: musicColors.amber, bgcolor: alpha(musicColors.amber, 0.08) },
                                    }}
                                >
                                    {t('Browse categories')}
                                </Button>
                            </Stack>
                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 3 }}>
                                {['Guitars', 'Keys', 'Drums', 'Audio'].map((label) => (
                                    <Chip
                                        key={label}
                                        label={t(label)}
                                        size="small"
                                        sx={{
                                            color: 'white',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            bgcolor: 'rgba(255,255,255,0.08)',
                                            fontWeight: 700,
                                        }}
                                    />
                                ))}
                            </Stack>
                        </Box>
                        <Box
                            sx={{
                                display: {
                                    xs: 'none',
                                    sm: hero.image_url ? 'flex' : 'none',
                                    md: 'flex',
                                },
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: hero.image_url ? 'transparent' : 'rgba(0,0,0,0.1)',
                                position: 'relative',
                                overflow: 'hidden',
                                minHeight: { sm: 340, md: 390 },
                            }}
                        >
                            {hero.image_url ? (
                                <Box component="img" src={hero.image_url} alt="" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <HeroInstrumentArt />
                            )}
                        </Box>
                    </Box>
                </Container>
            )}

            {sections.categories?.is_active !== false && displayCategories.length > 0 && (
                <Container maxWidth="lg" sx={{ mt: { xs: '24px', md: '32px' } }}>
                    <SectionHeader
                        eyebrow="Departments"
                        title={sections.categories?.title || 'Shop by sound'}
                        subtitle={sections.categories?.subtitle}
                        action={(
                            <Button
                                component={Link}
                                href={routeWithBase('/categories', app_base)}
                                size="small"
                                endIcon={<ArrowForward />}
                                sx={{ color: musicColors.rosin, fontWeight: 700 }}
                            >
                                {t('View all')}
                            </Button>
                        )}
                    />
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: 'repeat(4, minmax(0, 1fr))',
                                sm: 'repeat(6, minmax(0, 1fr))',
                                md: 'repeat(8, minmax(0, 1fr))',
                            },
                            gap: { xs: 1.25, sm: 2 },
                        }}
                    >
                        {displayCategories.map((cat) => (
                            <Stack
                                key={cat.id}
                                alignItems="center"
                                spacing={0.75}
                                sx={{
                                    cursor: 'pointer',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    p: 1,
                                    borderRadius: 2,
                                    '&:hover': { bgcolor: 'rgba(36,27,24,0.04)' },
                                }}
                                component={Link}
                                href={routeWithBase(`/categories/${cat.slug}`, app_base)}
                            >
                                <Avatar
                                    src={cat.imageUrl || undefined}
                                    sx={{
                                        width: { xs: 56, md: 64 },
                                        height: { xs: 56, md: 64 },
                                        bgcolor: cat.color || 'rgba(244,194,103,0.2)',
                                        fontSize: '1.25rem',
                                        borderRadius: 2,
                                        color: musicColors.rosin,
                                        border: '1px solid rgba(36,27,24,0.08)',
                                        '& img': { objectFit: 'cover' },
                                        '&:hover': { transform: 'translateY(-2px)', transition: '0.2s' },
                                    }}
                                >
                                    {cat.icon || <cat.Icon fontSize="small" />}
                                </Avatar>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontWeight: 700,
                                        fontSize: '0.78rem',
                                        textAlign: 'center',
                                        lineHeight: 1.2,
                                        width: '100%',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {cat.name}
                                </Typography>
                            </Stack>
                        ))}
                    </Box>
                </Container>
            )}

            {sections.flash_sale?.is_active !== false && visibleFlashSaleEvents.map((sale) => {
                const saleProducts = Array.isArray(sale.products) ? sale.products : [];
                if (saleProducts.length === 0) return null;

                return (
                    <Container key={sale.id || sale.name} maxWidth="lg" sx={{ mt: { xs: '24px', md: '32px' } }}>
                        <Box sx={{ ...sectionShellSx, p: { xs: '16px', sm: '20px' } }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.25} sx={{ mb: 2 }}>
                                <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                                    <LocalFireDepartment sx={{ fontSize: '1.35rem', color: musicColors.rosin }} />
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                        {sale.name || sections.flash_sale?.title || 'Limited-time gear deals'}
                                    </Typography>
                                    {sale.ends_at && (
                                        <Chip
                                            label={`${t('Ends')} ${new Date(sale.ends_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                                            color="primary"
                                            size="small"
                                            sx={{ minHeight: 28, fontSize: '0.72rem', fontWeight: 700 }}
                                        />
                                    )}
                                </Stack>
                                <Button component={Link} href={routeWithBase('/products?flash_sale=1', app_base)} size="small" endIcon={<ArrowForward />} sx={{ color: musicColors.rosin, fontWeight: 700 }}>
                                    {t('More deals')}
                                </Button>
                            </Stack>
                            <Box sx={{ ...productListGridSx }}>
                                {saleProducts.slice(0, 4).map((product) => (
                                    <ProductCard key={product.id} product={product} />
                                ))}
                            </Box>
                        </Box>
                    </Container>
                );
            })}

            {sections.promos?.is_active !== false && promos.length > 0 && (
                <Container maxWidth="lg" sx={{ mt: { xs: '24px', md: '32px' } }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${Math.min(promos.length, 2)}, 1fr)` }, gap: 2 }}>
                        {promos.slice(0, 2).map((promo, index) => (
                            <Box
                                key={promo.id || promo.key || index}
                                {...blockLinkProps(promo.link_url || '/products', app_base)}
                                sx={{
                                    position: 'relative',
                                    minHeight: 132,
                                    p: { xs: '16px', md: '20px' },
                                    borderRadius: 2,
                                    bgcolor: promo.accent_color || musicColors.sheet,
                                    border: '1px solid rgba(36,27,24,0.08)',
                                    boxShadow: '0 16px 44px rgba(36, 27, 24, 0.07)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    overflow: 'hidden',
                                }}
                            >
                                {promo.image_url ? (
                                    <Box component="img" src={promo.image_url} alt="" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.24 }} />
                                ) : null}
                                <Box sx={{ position: 'relative', zIndex: 1 }}>
                                    <Typography sx={{ ...eyebrowSxForTheme(theme), mb: 0.5 }}>{t('Curated set')}</Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700, color: musicColors.ink, lineHeight: 1.1 }}>{t(promo.title)}</Typography>
                                    <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, mt: 0.75, maxWidth: 350 }}>{t(promo.subtitle)}</Typography>
                                </Box>
                                <AutoAwesome sx={{ position: 'relative', zIndex: 1, fontSize: 34, color: musicColors.brass }} />
                            </Box>
                        ))}
                    </Box>
                </Container>
            )}

            {sections.best_sellers?.is_active !== false && (
                <Container maxWidth="lg" sx={{ mt: { xs: '24px', md: '32px' }, mb: { xs: '24px', md: '32px' } }}>
                    <SectionHeader
                        eyebrow={productSectionMeta.source === 'best_sellers' ? 'Best sellers' : 'Shop highlights'}
                        title={sections.best_sellers?.title || productSectionMeta.title}
                        subtitle={sections.best_sellers?.subtitle || productSectionMeta.subtitle}
                    />
                    {featuredProducts.length > 0 ? (
                        <Box sx={{ ...productListGridSx }}>
                            {featuredProducts.map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </Box>
                    ) : (
                        <ProductSectionEmpty
                            title={productSectionMeta.empty_title}
                            subtitle={productSectionMeta.empty_subtitle}
                        />
                    )}
                </Container>
            )}

            {sections.blogs?.is_active !== false && latestBlogs.length > 0 && (
                <Container maxWidth="lg" sx={{ mt: { xs: '24px', md: '32px' }, mb: { xs: '24px', md: '32px' } }}>
                    <SectionHeader
                        eyebrow="Learn"
                        title={sections.blogs?.title || 'Player guides'}
                        subtitle={sections.blogs?.subtitle}
                        action={(
                            <Button
                                component={Link}
                                href={routeWithBase('/blogs', app_base)}
                                size="small"
                                endIcon={<ArrowForward />}
                                sx={{ color: musicColors.rosin, fontWeight: 700 }}
                            >
                                {t('View all')}
                            </Button>
                        )}
                    />
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                        {latestBlogs.slice(0, 3).map((post) => <BlogPreviewCard key={post.id} post={post} />)}
                    </Box>
                </Container>
            )}

            {paymentMethods.length > 0 && (
                <Container maxWidth="lg" sx={{ mt: { xs: '24px', md: '32px' }, mb: { xs: '24px', md: '32px' } }}>
                    <SectionHeader
                        eyebrow="Checkout"
                        title="Easy payment options"
                        subtitle="Manual transfer accounts are available at checkout."
                        action={(
                            <Button
                                component={Link}
                                href={routeWithBase('/checkout', app_base)}
                                size="small"
                                endIcon={<ArrowForward />}
                                sx={{ color: musicColors.rosin, fontWeight: 700 }}
                            >
                                {t('Checkout')}
                            </Button>
                        )}
                    />
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
                        {paymentMethods.map((method) => (
                            <Stack
                                key={method.id}
                                direction="row"
                                spacing={1.25}
                                alignItems="center"
                                sx={{
                                    bgcolor: musicColors.sheet,
                                    border: '1px solid rgba(36,27,24,0.08)',
                                    borderRadius: 2,
                                    p: '16px',
                                    minWidth: 0,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 1,
                                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                                        display: 'grid',
                                        placeItems: 'center',
                                        overflow: 'hidden',
                                        flexShrink: 0,
                                    }}
                                >
                                    {method.icon_url ? (
                                        <Box component="img" src={method.icon_url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <AccountBalanceWallet color="primary" fontSize="small" />
                                    )}
                                </Box>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                                        {method.banking_service}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                                        {method.account_name}
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 700 }} display="block" noWrap>
                                        {method.account_no}
                                    </Typography>
                                </Box>
                            </Stack>
                        ))}
                    </Box>
                </Container>
            )}

            <Footer />
            <MobileBottomNavSpacer />
            <MobileBottomNav />
        </Box>
    );
};

export default Welcome;
