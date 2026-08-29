import React, { useEffect, useState } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Badge, InputBase, Box, Container, Stack, Button } from '@mui/material';
import { ArticleOutlined, Search, ShoppingCart, ChatBubbleOutlined, Favorite, MusicNote, Piano, Headphones } from '@mui/icons-material';
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
    borderRadius: 10,
    backgroundColor: alpha(theme.palette.common.white, 0.92),
    '&:hover': {
        backgroundColor: theme.palette.common.white,
    },
    marginRight: theme.spacing(1),
    marginLeft: 0,
    width: '100%',
    [theme.breakpoints.up('sm')]: {
        marginLeft: theme.spacing(2),
        width: 'auto',
    },
    border: '1px solid rgba(244, 194, 103, 0.35)',
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
        minHeight: 42,
        padding: theme.spacing(1, 1.5, 1, 0),
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
            width: '28ch',
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
            bgcolor: 'rgba(31, 23, 20, 0.94)',
            color: 'white',
            backdropFilter: 'blur(16px)',
            borderBottom: `1px solid ${alpha(musicColors.amber, 0.34)}`,
            boxShadow: '0 3px 12px rgba(23, 19, 18, 0.12)',
            zIndex: 1100,
        }}>
            <Container maxWidth="lg">
                <Toolbar variant="dense" sx={{ px: { xs: 0, sm: 1 }, minHeight: { xs: 56, sm: 64 } }}>
                    <Box
                        component={Link}
                        href={routeWithBase('/', app_base)}
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 1,
                            minWidth: 0,
                            mr: { xs: 0.75, sm: 2 },
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
                                    bgcolor: musicColors.sheet,
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
                                    bgcolor: musicColors.brass,
                                    color: musicColors.ink,
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
                                    color: musicColors.amber,
                                    lineHeight: 1.05,
                                }}
                            >
                                {appName}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, fontSize: '0.75rem', display: { sm: 'none', md: 'block' } }}>
                                {t('storefront.tagline', 'Instruments, gear & studio essentials')}
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
                                color: 'rgba(255,255,255,0.78)',
                                fontWeight: 700,
                                px: 1.25,
                                minHeight: 42,
                                '&:hover': { color: musicColors.amber, bgcolor: alpha(musicColors.amber, 0.08) },
                            },
                        }}
                    >
                        <Button component={Link} href={routeWithBase('/products', app_base)} startIcon={<Piano fontSize="small" />}>
                            {t('storefront.shop', 'Shop')}
                        </Button>
                        <Button component={Link} href={routeWithBase('/categories', app_base)} startIcon={<Headphones fontSize="small" />}>
                            {t('storefront.categories', 'Categories')}
                        </Button>
                        <Button component={Link} href={routeWithBase('/blogs', app_base)} startIcon={<ArticleOutlined fontSize="small" />}>
                            {t('storefront.blog', 'Blog')}
                        </Button>
                    </Stack>

                    <Box sx={{ flexGrow: 1 }} />
                    
                    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                        {renderSearch(t('storefront.search_desktop', 'Search instruments, cables, amps...'))}
                    </Box>

                    <Box sx={{ display: 'flex', gap: { xs: 0.25, sm: 0.5 }, alignItems: 'center' }}>
                        <IconButton
                            size="small"
                            aria-label={t('storefront.support_chat', 'Open support chat')}
                            component={Link}
                            href={routeWithBase(auth?.user ? '/chat' : '/login', app_base)}
                            sx={{ color: musicColors.amber, width: { xs: 40, sm: 42 }, height: { xs: 40, sm: 42 } }}
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
                            sx={{ display: { xs: 'none', sm: 'flex' }, color: musicColors.amber, width: 42, height: 42 }}
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
                            sx={{ color: musicColors.amber, width: { xs: 40, sm: 42 }, height: { xs: 40, sm: 42 } }}
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
                    {renderSearch(t('storefront.search_mobile', 'Search guitars, keys, drums...'))}
                </Box>
            </Container>
        </AppBar>
    );
};

export default Navbar;
