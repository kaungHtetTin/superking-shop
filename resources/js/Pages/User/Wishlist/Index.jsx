import React, { useEffect, useMemo, useState } from 'react';
import { Link, usePage } from '@/spa/router';
import { Box, Button, Container, Pagination, Paper, Stack, Typography } from '@mui/material';
import BackLink from '@/Components/User/BackLink';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import UserBrandHead from '@/Components/User/UserBrandHead';
import ProductCard from '@/Components/User/ProductCard';
import { routeWithBase } from '@/Utils/url';
import { productListGridSx } from '@/Utils/productListGrid';
import { useWishlistStore } from '@/stores/wishlistStore';
import { useCartStore } from '@/stores/cartStore';
import { pickDefaultUnitForProduct } from '@/Utils/pickDefaultUnit';
import { hasFlashSale, unitOriginalPrice, unitPrice } from '@/Utils/pricing';
import { FavoriteBorderRounded } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { storefrontBackgroundSx } from '@/Components/User/musicStoreDesign';

function wishlistItemToProduct(w) {
    return {
        id: w.productId,
        product_code: w.productCode || null,
        slug: w.slug,
        name: w.name,
        units: w.units || [],
        category: w.categoryName ? { name: w.categoryName } : null,
        primary_image: w.imagePath ? { image_path: w.imagePath } : null,
        rating: w.rating ?? 0,
        review_count: w.review_count ?? 0,
    };
}
export default function WishlistIndex() {
    const theme = useTheme();
    const { app_base } = usePage().props;
    const items = useWishlistStore((s) => s.items);
    const removeWishlistItem = useWishlistStore((s) => s.remove);
    const addToCart = useCartStore((s) => s.addItem);
    const visibleItems = useMemo(
        () => items.filter((item) => (item.units || []).some((unit) => unit.is_active !== false && Number(unit.available_qty ?? 0) > 0)),
        [items]
    );
    const perPage = 12;
    const [page, setPage] = useState(1);
    const pageCount = Math.max(1, Math.ceil(visibleItems.length / perPage));
    const paginatedItems = useMemo(() => {
        const start = (page - 1) * perPage;
        return visibleItems.slice(start, start + perPage);
    }, [visibleItems, page]);

    useEffect(() => {
        if (page > pageCount) {
            setPage(pageCount);
        }
    }, [page, pageCount]);

    const moveAllToCart = () => {
        visibleItems.forEach((item) => {
            const product = wishlistItemToProduct(item);
            const unit = pickDefaultUnitForProduct(product);
            if (!unit) return;
            addToCart({
                unitId: unit.id,
                productId: item.productId,
                name: item.name,
                unitName: unit.name || unit.code || 'Unit',
                productCode: item.productCode || null,
                priceType: 'retail',
                price: unitPrice(unit),
                originalPrice: unitOriginalPrice(unit),
                flashSale: hasFlashSale(unit) ? unit.flash_sale : null,
                imagePath: item.imagePath || null,
                maxQty: Number(unit.available_qty || 0),
                qty: 1,
            });
            removeWishlistItem(item.productId);
        });
    };

    return (
        <Box className="user-storefront" sx={{ ...storefrontBackgroundSx(theme), minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <UserBrandHead title="Wishlist" />
            <Navbar />

            <Container maxWidth="lg" sx={{ mt: { xs: '16px', md: '24px' }, pb: { xs: '24px', md: '32px' } }}>
                <BackLink href={routeWithBase('/products', app_base)}>
                    Continue shopping
                </BackLink>

                <Stack direction="row" alignItems="center" justifyContent="space-between" gap="12px" sx={{ mb: '16px' }}>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>Wishlist {visibleItems.length > 0 && `(${visibleItems.length})`}</Typography>
                    {visibleItems.length > 0 && <Button variant="outlined" onClick={moveAllToCart}>Move all to cart</Button>}
                </Stack>

                {visibleItems.length === 0 ? (
                    <Paper elevation={0} sx={{ p: { xs: '24px', sm: '28px' }, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                        <FavoriteBorderRounded sx={{ fontSize: 48, color: 'primary.main', mb: '12px' }} />
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: '8px' }}>Your wishlist is ready for inspiration</Typography>
                        <Typography color="text.secondary" sx={{ mb: '16px', maxWidth: 520, mx: 'auto' }}>
                            Save items you love — tap the heart on any product card.
                        </Typography>
                        <Button variant="contained" component={Link} href={routeWithBase('/products', app_base)}>
                            Browse products
                        </Button>
                    </Paper>
                ) : (
                    <>
                        <Box sx={{ ...productListGridSx, mb: '24px' }}>
                            {paginatedItems.map((w) => (
                                <ProductCard key={w.productId} product={wishlistItemToProduct(w)} />
                            ))}
                        </Box>
                        {pageCount > 1 && (
                            <Stack alignItems="center" sx={{ mb: 4 }}>
                                <Pagination
                                    count={pageCount}
                                    page={page}
                                    onChange={(_event, value) => setPage(value)}
                                    color="primary"
                                />
                            </Stack>
                        )}
                    </>
                )}
            </Container>

            <Footer />
            <MobileBottomNavSpacer />
            <MobileBottomNav />
        </Box>
    );
}
