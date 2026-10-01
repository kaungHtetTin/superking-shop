import React from 'react';
import { Link, router, usePage } from '@/spa/router';
import {
    Box,
    Container,
    Typography,
    Paper,
    Stack,
    Avatar,
    Chip,
    Button,
    Pagination,
} from '@mui/material';
import { ChevronRight, MusicNote } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import BackLink from '@/Components/User/BackLink';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { routeWithBase } from '@/Utils/url';
import {
    eyebrowSxForTheme,
    getMusicStoreColors,
    storefrontBackgroundSx,
} from '@/Components/User/musicStoreDesign';

function categoryVisual(cat) {
    return {
        emoji: cat.metadata?.icon || cat.icon || null,
        imageUrl: cat.icon_image_url || null,
    };
}

export default function CategoriesIndex({ categories = [] }) {
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);
    const { app_base } = usePage().props;
    const categoryRows = (categories.data || categories).filter((category) => Number(category.products_count || 0) > 0);

    const handlePageChange = (_event, page) => {
        router.get(routeWithBase('/categories', app_base), { page }, { preserveScroll: false, preserveState: true });
    };

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
            <UserBrandHead title="Categories" />
            <Navbar />

            <Container maxWidth="lg" sx={{ mt: { xs: '20px', md: '28px' }, pb: '40px' }}>
                <BackLink href={routeWithBase('/', app_base)}>
                    Back to home
                </BackLink>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px', mb: '24px', mt: '8px' }}>
                    <Box>
                    <Typography sx={{ ...eyebrowSxForTheme(theme), mb: 0.5 }}>
                        Categories
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5, color: musicColors.ink, lineHeight: 1.1 }}>
                        Shop by category
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: '8px', maxWidth: 580 }}>
                        Find instruments, accessories and essentials in one place.
                    </Typography>
                    </Box>
                    <Button component={Link} href={routeWithBase('/products', app_base)} variant="outlined">View all products</Button>
                </Box>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            sm: `repeat(${Math.max(1, Math.min(2, categoryRows.length))}, minmax(0, 1fr))`,
                            md: `repeat(${Math.max(1, Math.min(3, categoryRows.length))}, minmax(0, 1fr))`,
                        },
                        gap: { xs: '10px', sm: '12px', md: '16px' },
                    }}
                >
                    {categoryRows.map((cat) => {
                        const v = categoryVisual(cat);
                        const count = cat.products_count ?? 0;
                        const subs = cat.children || [];

                        return (
                            <Paper
                                key={cat.id}
                                elevation={0}
                                sx={{
                                    p: { xs: '20px', sm: '24px' },
                                    borderRadius: '10px',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    border: '1px solid rgba(15,23,42,0.1)',
                                    background: musicColors.sheet,
                                    boxShadow: '0 4px 14px rgba(15,23,42,0.05)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'stretch',
                                    minWidth: 0,
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                                    '&:hover': {
                                        borderColor: musicColors.rosin,
                                    },
                                    '&:focus-visible': { outline: `2px solid ${musicColors.rosin}`, outlineOffset: 3 },
                                }}
                            >
                                <Stack component={Link} href={routeWithBase(`/categories/${cat.slug}`, app_base)} direction="row" sx={{ alignItems: 'center', gap: '16px', color: 'inherit', textDecoration: 'none', '&:focus-visible': { outline: `2px solid ${musicColors.rosin}`, outlineOffset: 4 } }}>
                                    <Avatar
                                        src={v.imageUrl || undefined}
                                        sx={{
                                            width: { xs: 44, sm: 52 },
                                            height: { xs: 44, sm: 52 },
                                            bgcolor: alpha(musicColors.rosin, 0.08),
                                            borderRadius: '10px',
                                            fontSize: '1.35rem',
                                            flexShrink: 0,
                                            color: musicColors.rosin,
                                            '& img': { objectFit: 'cover' },
                                        }}
                                    >
                                        {v.emoji || <MusicNote fontSize="small" />}
                                    </Avatar>
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography
                                            variant="subtitle2"
                                            sx={{ fontWeight: 700, lineHeight: 1.4, mb: '4px', overflowWrap: 'anywhere' }}
                                        >
                                            {cat.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {count} {count === 1 ? 'item' : 'items'}
                                        </Typography>
                                    </Box>
                                    <ChevronRight sx={{ fontSize: 20, color: musicColors.rosin, opacity: 0.7, flexShrink: 0 }} />
                                </Stack>

                                {cat.description ? (
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{
                                            mt: '16px',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            lineHeight: 1.45,
                                        }}
                                    >
                                        {cat.description}
                                    </Typography>
                                ) : null}

                                {subs.length > 0 ? (
                                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: '8px', mt: '16px', pt: '16px', borderTop: '1px solid', borderColor: 'divider' }}>
                                        {subs.slice(0, 3).map((sub) => (
                                            <Chip
                                                key={sub.id}
                                                component={Link}
                                                href={routeWithBase(`/categories/${sub.slug}`, app_base)}
                                                label={sub.name}
                                                size="small"
                                                onClick={(e) => e.stopPropagation()}
                                                sx={{
                                                    minHeight: 28,
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    '& .MuiChip-label': { px: 0.75 },
                                                }}
                                            />
                                        ))}
                                        {subs.length > 3 ? (
                                            <Chip label={`+${subs.length - 3}`} size="small" sx={{ height: 22, fontSize: '0.65rem' }} />
                                        ) : null}
                                    </Stack>
                                ) : null}
                            </Paper>
                        );
                    })}
                </Box>

                {categoryRows.length === 0 ? (
                    <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
                        <Typography color="text.secondary" sx={{ fontWeight: 700, mb: 2 }}>
                            No categories available yet.
                        </Typography>
                        <Button component={Link} href={routeWithBase('/products', app_base)} variant="contained">
                            Browse all products
                        </Button>
                    </Paper>
                ) : null}

                {categories.last_page > 1 && (
                    <Stack  sx={{ alignItems: "center", ...({ mt: 3, mb: 2 }) }}>
                        <Pagination
                            count={categories.last_page}
                            page={categories.current_page}
                            onChange={handlePageChange}
                            color="primary"
                        />
                    </Stack>
                )}
            </Container>

            <Footer />
            <MobileBottomNavSpacer />
            <MobileBottomNav />
        </Box>
    );
}
