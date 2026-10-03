import React, { useEffect, useState } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Badge, InputBase, Box, Container, Stack, Button } from '@mui/material';
import { ArticleOutlined, Search, ShoppingCartOutlined as ShoppingCart, ChatBubbleOutlineRounded as ChatBubbleOutlined, FavoriteBorderOutlined as Favorite, MusicNote, StorefrontOutlined, CategoryOutlined } from '@mui/icons-material';
import { styled, alpha, useTheme } from '@mui/material/styles';
import { Link, router, usePage } from '@/spa/router';
import { routeWithBase } from '@/Utils/url';
import { useCartStore } from '@/stores/cartStore';
import { useWishlistStore } from '@/stores/wishlistStore';
import ProfileMenu from '@/Components/User/ProfileMenu';
import { getMusicStoreColors } from '@/Components/User/musicStoreDesign';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import { useUserChrome } from '@/Layouts/UserChromeContext';
import { useTranslation } from '@/Utils/i18n';

const SearchContainer = styled('form')(({ theme }) => ({
    position: 'relative',
    borderRadius: 8,
    backgroundColor: '#f5f8f8',
    '&:hover': {
        backgroundColor: theme.palette.common.white,
        borderColor: alpha(theme.palette.primary.main, 0.45),
    },
    '&:focus-within': {
        backgroundColor: theme.palette.common.white,
        borderColor: theme.palette.primary.main,
        boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.12)}`,
    },
    marginRight: 0,
    marginLeft: 0,
    width: '100%',
    [theme.breakpoints.up('sm')]: {
        marginLeft: 0,
        width: 'auto',
    },
    border: '1px solid rgba(15, 23, 42, 0.12)',
    transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
    minWidth: 0,
    minHeight: 44,
}));

const SearchIconWrapper = styled('button')(({ theme }) => ({
    width: 44,
    padding: 0,
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: getMusicStoreColors(theme).rosin,
    border: 0,
    background: 'transparent',
    cursor: 'pointer',
    '&:hover': {
        color: getMusicStoreColors(theme).brass,
    },
}));

const StyledInputBase = styled(InputBase)((({ theme }) => ({
    color: theme.palette.text.primary,
    width: '100%',
    '& .MuiInputBase-input': {
        minHeight: 44,
        boxSizing: 'border-box',
        padding: '10px 12px 10px 44px',
        paddingLeft: 44,
        transition: theme.transitions.create('width'),
        fontSize: '0.875rem',
        fontWeight: 500,
        color: getMusicStoreColors(theme).ink,
        '&::placeholder': {
            color: alpha(getMusicStoreColors(theme).coal, 0.72),
            opacity: 1,
            fontWeight: 400,
        },
        width: '100%',
        [theme.breakpoints.up('md')]: {
            width: '24ch',
        },
    },
})));

const Navbar = ({ persistentRoot = false }) => {
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);
    const { app_base, auth, chat_unread_count, app_settings } = usePage().props;
    const { url } = usePage();
    const [search, setSearch] = useState('');
    const cartCount = useCartStore((s) => s.itemCount());
    const wishCount = useWishlistStore((s) => s.count());
    const appName = app_settings?.app_name || 'Harmony House';
    const userChrome = useUserChrome();
    const t = useTranslation();
    const currentPath = String(url || '').split('?')[0];
    const isActive = (section) => new RegExp(`/${section}(?:/|$)`).test(currentPath);
    const actionSx = {
        color: musicColors.rosin,
        width: { xs: 40, sm: 42 },
        height: { xs: 40, sm: 42 },
        borderRadius: 2,
        '&:hover': { bgcolor: alpha(musicColors.rosin, 0.09) },
    };

    useEffect(() => {
        const queryString = typeof url === 'string' ? url.split('?')[1] : '';
        const params = new URLSearchParams(queryString || '');
        setSearch(params.get('search') || '');
    }, [url]);

    if (userChrome?.persistent && !persistentRoot) {
        return null;
    }

    const submitSearch = (event) => {
        event.preventDefault();

        const term = search.trim();
        router.get(
            routeWithBase('/products', app_base),
            term ? { search: term } : {},
            {
                preserveScroll: false,
                preserveState: false,
            },
        );
    };

    const renderSearch = (placeholder) => (
        <SearchContainer onSubmit={submitSearch}>
            <SearchIconWrapper type="submit" aria-label={t('storefront.search_products', 'Search products')}>
                <Search sx={{ fontSize: '1.1rem' }} />
            </SearchIconWrapper>
            <StyledInputBase
                placeholder={placeholder}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                inputProps={{ 'aria-label': t('storefront.search_products', 'Search products') }}
            />
        </SearchContainer>
    );

    return (
        <AppBar position="sticky" elevation={0} sx={{
            bgcolor: 'rgba(255, 255, 255, 0.96)',
            color: musicColors.ink,
            backdropFilter: 'blur(16px)',
            borderBottom: `1px solid ${alpha(musicColors.rosin, 0.17)}`,
            boxShadow: 'none',
            borderRadius: 0,
            '& .storefront-language-switcher': { borderRadius: '8px', minHeight: 44 },
            '& .MuiIconButton-root': { width: 44, height: 44, borderRadius: '8px' },
            zIndex: 1100,
        }}>
            <Container maxWidth="lg">
                <Toolbar variant="dense" sx={{ px: '0 !important', gap: { xs: '4px', lg: '12px' }, minHeight: { xs: 64, sm: 72 } }}>
                    <Box
                        component={Link}
                        href={routeWithBase('/', app_base)}
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 1,
                            minWidth: 0,
                            mr: 0,
                            color: 'inherit',
                            textDecoration: 'none',
                        }}
                    >
                        {app_settings?.logo_url ? (
                            <Box
                                component="img"
                                src={app_settings.logo_url}
                                alt=""
                                sx={{
                                    width: { xs: 32, sm: 36 },
                                    height: { xs: 32, sm: 36 },
                                    objectFit: 'contain',
                                    borderRadius: 1,
                                    bgcolor: musicColors.smoke,
                                }}
                            />
                        ) : (
                            <Box
                                sx={{
                                    width: { xs: 32, sm: 36 },
                                    height: { xs: 32, sm: 36 },
                                    display: 'grid',
                                    placeItems: 'center',
                                    borderRadius: 1.5,
                                    bgcolor: alpha(musicColors.rosin, 0.12),
                                    color: musicColors.rosin,
                                    fontSize: '0.95rem',
                                    fontWeight: 700,
                                }}
                            >
                                <MusicNote fontSize="inherit" />
                            </Box>
                        )}
                        <Box sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 0 }}>
                            <Typography
                                variant="subtitle1"
                                noWrap
                                sx={{
                                    maxWidth: { sm: 180, md: 220 },
                                    fontWeight: 700,
                                    color: musicColors.ink,
                                    lineHeight: 1.05,
                                }}
                            >
                                {appName}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 400, fontSize: '0.75rem', display: { xs: 'none', xl: 'block' } }}>
                                {t('storefront.tagline', 'Engine oils & vehicle care essentials')}
                            </Typography>
                        </Box>
                    </Box>

                    <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{
                            display: { xs: 'none', lg: 'flex' },
                            ml: 1,
                            '& .MuiButton-root': {
                                color: musicColors.ink,
                                fontWeight: 700,
                                px: '12px',
                                minHeight: 44,
                                borderRadius: '8px',
                                '&:hover': { color: musicColors.rosin, bgcolor: alpha(musicColors.rosin, 0.07) },
                                '&[aria-current="page"]': { color: musicColors.rosin, bgcolor: alpha(musicColors.rosin, 0.1) },
                            },
                        }}
                    >
                        <Button component={Link} href={routeWithBase('/products', app_base)} aria-current={isActive('products') ? 'page' : undefined} startIcon={<StorefrontOutlined fontSize="small" />}>
                            {t('storefront.shop', 'Shop')}
                        </Button>
                        <Button component={Link} href={routeWithBase('/categories', app_base)} aria-current={isActive('categories') ? 'page' : undefined} startIcon={<CategoryOutlined fontSize="small" />}>
                            {t('storefront.categories', 'Categories')}
                        </Button>
                        <Button component={Link} href={routeWithBase('/blogs', app_base)} aria-current={isActive('blogs') ? 'page' : undefined} startIcon={<ArticleOutlined fontSize="small" />}>
                            {t('storefront.blog', 'Blog')}
                        </Button>
                    </Stack>

                    <Box sx={{ flexGrow: 1 }} />

                    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                        {renderSearch(t('storefront.search_desktop', 'Search engine oils, filters, accessories...'))}
                    </Box>

                    <Box sx={{ display: 'flex', gap: { xs: 0.25, sm: 0.5 }, alignItems: 'center' }}>
                        <IconButton
                            size="small"
                            aria-label={t('storefront.support_chat', 'Open support chat')}
                            component={Link}
                            href={routeWithBase(auth?.user ? '/chat' : '/login', app_base)}
                            sx={actionSx}
                        >
                            <Badge
                                badgeContent={chat_unread_count || 0}
                                color="primary"
                                invisible={!chat_unread_count}
                                sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }}
                            >
                                <ChatBubbleOutlined sx={{ fontSize: '1.25rem' }} />
                            </Badge>
                        </IconButton>
                        <IconButton
                            size="small"
                            component={Link}
                            href={routeWithBase('/wishlist', app_base)}
                            aria-label={t('storefront.wishlist', 'Wishlist')}
                            sx={{ ...actionSx, display: { xs: 'none', sm: 'flex' } }}
                        >
                            <Badge
                                badgeContent={wishCount}
                                color="primary"
                                invisible={wishCount === 0}
                                sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }}
                            >
                                <Favorite sx={{ fontSize: '1.25rem' }} />
                            </Badge>
                        </IconButton>
                        <IconButton
                            size="small"
                            component={Link}
                            href={routeWithBase('/cart', app_base)}
                            aria-label={t('storefront.cart', 'Cart')}
                            sx={actionSx}
                        >
                            <Badge
                                badgeContent={cartCount}
                                color="primary"
                                invisible={cartCount === 0}
                                sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }}
                            >
                                <ShoppingCart sx={{ fontSize: '1.25rem' }} />
                            </Badge>
                        </IconButton>
                        <LanguageSwitcher compact className="storefront-language-switcher" />
                        <ProfileMenu />
                    </Box>
                </Toolbar>
                <Box sx={{ pb: 2, px: { xs: 0, sm: 1 }, display: { xs: 'block', md: 'none' } }}>
                    {renderSearch(t('storefront.search_mobile', 'Search oils, filters, accessories...'))}
                </Box>
            </Container>
        </AppBar>
    );
};

export default Navbar;
