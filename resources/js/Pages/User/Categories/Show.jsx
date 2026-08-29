import React from 'react';
import { Link, router, usePage } from '@/spa/router';
import {
    Box,
    Container,
    Typography,
    Paper,
    Stack,
    Avatar,
    Breadcrumbs,
    Chip,
    Pagination,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import BackLink from '@/Components/User/BackLink';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import ProductCard from '@/Components/User/ProductCard';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { routeWithBase } from '@/Utils/url';
import { productListGridSx } from '@/Utils/productListGrid';
import { storefrontBackgroundSx } from '@/Components/User/musicStoreDesign';

function categoryVisual(cat) {
    return {
        emoji: cat.metadata?.icon || cat.icon || '🛍️',
        imageUrl: cat.icon_image_url || null,
        accent: cat.metadata?.color || null,
    };
}

export default function CategoriesShow({ category, products = { data: [] } }) {
    const theme = useTheme();
    const { app_base } = usePage().props;
    const v = categoryVisual(category);
    const subs = category.children || [];
    const productRows = products.data || [];

    const handlePageChange = (_event, page) => {
        router.get(routeWithBase(`/categories/${category.slug}`, app_base), { page }, { preserveScroll: false, preserveState: true });
    };

    return (
        <Box className="user-storefront" sx={{ ...storefrontBackgroundSx(theme), minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <UserBrandHead title={category.name} />
            <Navbar />

            <Container maxWidth="lg" sx={{ mt: { xs: '16px', md: '24px' }, pb: { xs: '24px', md: '32px' } }}>
                <Breadcrumbs sx={{ display: { xs: 'none', md: 'flex' }, mb: '16px', '& a': { fontWeight: 700, fontSize: '0.8rem' } }}>
                    <Link href={routeWithBase('/', app_base)} style={{ textDecoration: 'none', color: 'inherit' }}>
                        Home
                    </Link>
                    <Link href={routeWithBase('/categories', app_base)} style={{ textDecoration: 'none', color: 'inherit' }}>
                        Categories
                    </Link>
                    <Typography color="text.primary" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>
                        {category.name}
                    </Typography>
                </Breadcrumbs>

                <BackLink href={routeWithBase('/categories', app_base)} sx={{ display: { xs: 'inline-flex', md: 'none' } }}>
                    All categories
                </BackLink>

                <Paper
                    elevation={0}
                    sx={{
                        p: { xs: '16px', sm: '20px' },
                        mb: '20px',
                        borderRadius: 4,
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                        background: `linear-gradient(135deg, rgba(255,255,255,0.96) 0%, ${alpha(theme.palette.primary.main, 0.04)} 100%)`,
                        boxShadow: `0 18px 55px ${alpha(theme.palette.primary.main, 0.08)}`,
                    }}
                >
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                        <Avatar
                            src={v.imageUrl || undefined}
                            sx={{
                                width: { xs: 56, sm: 72 },
                                height: { xs: 56, sm: 72 },
                                bgcolor: v.accent || alpha(theme.palette.primary.main, 0.12),
                                fontSize: { xs: '1.5rem', sm: '1.85rem' },
                                borderRadius: 3,
                                alignSelf: { xs: 'flex-start', sm: 'center' },
                                '& img': { objectFit: 'cover' },
                            }}
                        >
                            {v.emoji}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em', mb: 0.5 }}>
                                {category.name}
                            </Typography>
                            {category.description ? (
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ fontWeight: 600, lineHeight: 1.6, mb: 2 }}
                                >
                                    {category.description}
                                </Typography>
                            ) : null}
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                    {category.products_count ?? 0}{' '}
                                    {(category.products_count ?? 0) === 1 ? 'product' : 'products'}
                                </Typography>
                            </Stack>
                        </Box>
                    </Stack>
                </Paper>

                {subs.length > 0 ? (
                    <Box sx={{ mb: '20px' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.25 }}>
                            Subcategories
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={1}>
                            {subs.map((sub) => (
                                <Chip
                                    key={sub.id}
                                    component={Link}
                                    href={routeWithBase(`/categories/${sub.slug}`, app_base)}
                                    label={`${sub.name} (${sub.products_count ?? 0})`}
                                    clickable
                                    sx={{ fontWeight: 700 }}
                                />
                            ))}
                        </Stack>
                    </Box>
                ) : null}

                {productRows.length > 0 ? (
                    <>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                            Products in {category.name}
                        </Typography>
                        <Box sx={{ ...productListGridSx, mb: 2 }}>
                            {productRows.map((p) => (
                                <ProductCard key={p.id} product={p} />
                            ))}
                        </Box>
                        {products.last_page > 1 && (
                            <Stack alignItems="center" sx={{ mt: 3, mb: 2 }}>
                                <Pagination
                                    count={products.last_page}
                                    page={products.current_page}
                                    onChange={handlePageChange}
                                    color="primary"
                                />
                            </Stack>
                        )}
                    </>
                ) : (
                    <Paper sx={{ p: 3, borderRadius: 3, textAlign: 'center', mb: 2 }}>
                        <Typography color="text.secondary" sx={{ fontWeight: 700, mb: 2 }}>
                            No products in this category yet.
                        </Typography>
                        <Button component={Link} href={routeWithBase('/products', app_base)} variant="contained">
                            Browse other items
                        </Button>
                    </Paper>
                )}
            </Container>

            <Footer />
            <MobileBottomNavSpacer />
            <MobileBottomNav />
        </Box>
    );
}
