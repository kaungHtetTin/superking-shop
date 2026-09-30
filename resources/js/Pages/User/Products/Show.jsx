import React, { useState, useMemo, useCallback } from 'react';
import { usePage, Link, useForm, router } from '@/spa/router';
import { 
    Box, Container, Typography, Stack, 
    Button, Chip, Rating, Divider, IconButton,
    ToggleButton, ToggleButtonGroup,
    Snackbar,
    Alert,
    TextField,
    Pagination
} from '@mui/material';
import { 
    Add as AddIcon, 
    Remove as RemoveIcon,
    Favorite,
    FavoriteBorder,
    Share,
    ShoppingBag,
    ChevronLeft,
    ChevronRight,
    Star,
    StarBorder
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import BackLink from '@/Components/User/BackLink';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import ProductCard from '@/Components/User/ProductCard';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { storageUrl, routeWithBase } from '@/Utils/url';
import { productListGridSx } from '@/Utils/productListGrid';
import { useCartStore } from '@/stores/cartStore';
import { useWishlistStore } from '@/stores/wishlistStore';
import { formatMoney, hasFlashSale, unitOriginalPrice, unitPrice } from '@/Utils/pricing';
import { formatUnitWithConversion } from '@/Utils/unitLabel';
import { pickDefaultUnitForProduct } from '@/Utils/pickDefaultUnit';
import {
    eyebrowSxForTheme,
    getMusicStoreColors,
    sectionShellSxForTheme,
    storefrontBackgroundSx,
} from '@/Components/User/musicStoreDesign';
import { usePhraseTranslation } from '@/Utils/i18n';

const productImageUrl = (image, appUrl, appBase) => {
    const path = image?.image_url || image?.image_path;
    return path ? storageUrl(path, appUrl) : routeWithBase('/images/product-default.png', appBase);
};

const safeProductListHref = (currentUrl, appBase) => {
    const fallback = routeWithBase('/products', appBase);

    try {
        const origin = 'http://spa.local';
        const returnTo = new URL(currentUrl, origin).searchParams.get('return_to');
        if (!returnTo) return fallback;

        const candidate = new URL(returnTo, origin);
        const expected = new URL(fallback, origin);
        if (candidate.origin !== expected.origin || candidate.pathname !== expected.pathname) {
            return fallback;
        }

        return `${candidate.pathname}${candidate.search}${candidate.hash}`;
    } catch {
        return fallback;
    }
};

const Show = ({ product, relatedProducts, recommendedProducts = [], frequentlyBoughtTogether = [], reviews = { data: [] } }) => {
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);
    const sectionShellSx = sectionShellSxForTheme(theme);
    const ORDER_QTY_MAX = 999;
    const page = usePage();
    const { app_url, app_base, auth } = page.props;
    const t = usePhraseTranslation();
    const productUnits = product.units || [];
    const [selectedUnit, setSelectedUnit] = useState(() => pickDefaultUnitForProduct(product));
    const [quantity, setQuantity] = useState(1);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [actionToast, setActionToast] = useState({ open: false, message: '' });
    const addItem = useCartStore((s) => s.addItem);
    const toggleWishlist = useWishlistStore((s) => s.toggle);
    const inWishlist = useWishlistStore((s) => s.items.some((item) => item.productId === product.id));
    const selectedUnitQtyLimit = Math.min(ORDER_QTY_MAX, Math.max(1, Number(selectedUnit?.available_qty ?? 1)));
    const reviewRows = reviews.data || product.reviews || [];
    const { data, setData, post, processing, errors } = useForm({
        rating: 5,
        comment: '',
    });
    const productListHref = useMemo(() => safeProductListHref(page.url, app_base), [app_base, page.url]);

    const images = useMemo(() => {
        return product.images.length > 0 ? product.images : [{ image_path: null }];
    }, [product.images]);
    const buyableUnits = useMemo(
        () => productUnits.filter((unit) => unit.is_active !== false && Number(unit.available_qty ?? 0) > 0),
        [productUnits]
    );
    const hasMultipleImages = images.length > 1;
    const wishlistPayload = useMemo(() => ({
        productId: product.id,
        productCode: product.product_code || null,
        slug: product.slug,
        name: product.name,
        imagePath: product.primary_image?.image_path || product.images?.[0]?.image_path || null,
        units: productUnits,
        categoryName: product.category?.name || null,
        rating: Number(product.rating || 0),
        review_count: Number(product.review_count || 0),
    }), [product, productUnits]);

    const selectImage = useCallback((index) => {
        if (images.length === 0) return;

        const nextIndex = (index + images.length) % images.length;
        setActiveImageIndex(nextIndex);
    }, [images]);

    const showPreviousImage = useCallback(() => {
        selectImage(activeImageIndex - 1);
    }, [activeImageIndex, selectImage]);

    const showNextImage = useCallback(() => {
        selectImage(activeImageIndex + 1);
    }, [activeImageIndex, selectImage]);

    const handleQuantityChange = (delta) => {
        setQuantity(prev => Math.max(1, Math.min(selectedUnitQtyLimit, prev + delta)));
    };

    const handleAddToCart = () => {
        if (!selectedUnit) return;
        const img = images[activeImageIndex]?.image_path || null;
        addItem({
            unitId: selectedUnit.id,
            productId: product.id,
            name: product.name,
            unitName: selectedUnit.name || selectedUnit.code,
            productCode: product.product_code || null,
            priceType: 'retail',
            price: unitPrice(selectedUnit),
            originalPrice: unitOriginalPrice(selectedUnit),
            flashSale: selectedUnit.flash_sale || null,
            imagePath: img,
            maxQty: selectedUnit.available_qty,
            unitOptions: buyableUnits.map((unit) => ({
                id: unit.id,
                name: unit.name || unit.code,
                code: unit.code || null,
                price: unitPrice(unit),
                originalPrice: unitOriginalPrice(unit),
                flashSale: unit.flash_sale || null,
                imagePath: unit.image?.image_path || img,
                maxQty: Number(unit.available_qty || 0),
                conversionFactor: Number(unit.conversion_factor || 1),
                isBase: Boolean(unit.is_base),
            })),
            isPreorder: false,
            qty: Math.min(quantity, Number(selectedUnit.available_qty ?? 1)),
        });
        setActionToast({ open: true, message: t('Added to your cart') });
        setQuantity(1);
    };

    const handleWishlist = useCallback(() => {
        const added = toggleWishlist(wishlistPayload);
        setActionToast({
            open: true,
            message: t(added ? 'Saved to wishlist' : 'Removed from wishlist'),
        });
    }, [toggleWishlist, wishlistPayload, t]);

    const submitReview = (e) => {
        e.preventDefault();
        const reviewUrl = `${routeWithBase(`/products/${product.slug}/reviews`, app_base)}?return_to=${encodeURIComponent(productListHref)}`;
        post(reviewUrl, {
            preserveScroll: true,
        });
    };

    const handleReviewPageChange = (_event, page) => {
        router.get(routeWithBase(`/products/${product.slug}`, app_base), {
            reviews_page: page,
            return_to: productListHref,
        }, {
            preserveScroll: true,
            preserveState: true,
        });
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
            <UserBrandHead title={product.name} />
            
            <Navbar />

            <Container maxWidth="lg" sx={{ mt: { xs: '16px', md: '24px' }, pb: { xs: '24px', md: '32px' } }}>
                <BackLink href={productListHref}>
                    {t('Back to Shop')}
                </BackLink>

                <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 0.4fr) minmax(0, 0.6fr)' }, 
                    gap: { xs: '20px', md: '32px' },
                    alignItems: 'start'
                }}>
                    {/* Image Gallery */}
                    <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: 420 }, mx: 'auto' }}>
                        <Box
                            role={hasMultipleImages ? 'region' : undefined}
                            aria-label={hasMultipleImages ? t('Product image carousel') : undefined}
                            tabIndex={hasMultipleImages ? 0 : undefined}
                            onKeyDown={(event) => {
                                if (!hasMultipleImages) return;
                                if (event.key === 'ArrowLeft') {
                                    event.preventDefault();
                                    showPreviousImage();
                                }
                                if (event.key === 'ArrowRight') {
                                    event.preventDefault();
                                    showNextImage();
                                }
                            }}
                            sx={{
                                position: 'relative',
                                aspectRatio: { xs: '1 / 1', sm: '3 / 4' },
                                borderRadius: 2,
                                overflow: 'hidden',
                                border: '1px solid',
                                borderColor: 'rgba(36,27,24,0.1)',
                                bgcolor: musicColors.sheet,
                                boxShadow: '0 22px 58px rgba(36,27,24,0.14)',
                                '&:focus-visible': {
                                    outline: `3px solid ${musicColors.rosin}`,
                                    outlineOffset: 3,
                                },
                            }}
                        >
                            <Box 
                                component="img" 
                                key={images[activeImageIndex]?.id || images[activeImageIndex]?.image_path || activeImageIndex}
                                src={productImageUrl(images[activeImageIndex], app_url, app_base)}
                                alt={`${product.name} ${activeImageIndex + 1}`}
                                sx={{ 
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    bgcolor: musicColors.sheet,
                                    animation: 'productGalleryFade 180ms ease',
                                    '@keyframes productGalleryFade': {
                                        from: { opacity: 0.72, transform: 'scale(1.01)' },
                                        to: { opacity: 1, transform: 'scale(1)' },
                                    },
                                }}
                            />
                            {hasMultipleImages && (
                                <>
                                    <IconButton
                                        onClick={showPreviousImage}
                                        aria-label={t('Previous image')}
                                        sx={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: 12,
                                            transform: 'translateY(-50%)',
                                            bgcolor: 'rgba(255,253,248,0.92)',
                                            border: '1px solid rgba(36,27,24,0.12)',
                                            boxShadow: '0 10px 24px rgba(36,27,24,0.16)',
                                            '&:hover': { bgcolor: '#fff' },
                                        }}
                                    >
                                        <ChevronLeft />
                                    </IconButton>
                                    <IconButton
                                        onClick={showNextImage}
                                        aria-label={t('Next image')}
                                        sx={{
                                            position: 'absolute',
                                            top: '50%',
                                            right: 12,
                                            transform: 'translateY(-50%)',
                                            bgcolor: 'rgba(255,253,248,0.92)',
                                            border: '1px solid rgba(36,27,24,0.12)',
                                            boxShadow: '0 10px 24px rgba(36,27,24,0.16)',
                                            '&:hover': { bgcolor: '#fff' },
                                        }}
                                    >
                                        <ChevronRight />
                                    </IconButton>
                                    <Stack
                                        direction="row"
                                        spacing={0.75}
                                        sx={{
                                            position: 'absolute',
                                            left: '50%',
                                            bottom: 14,
                                            transform: 'translateX(-50%)',
                                            px: 1,
                                            py: 0.75,
                                            borderRadius: 999,
                                            bgcolor: 'rgba(255,253,248,0.9)',
                                            border: '1px solid rgba(36,27,24,0.08)',
                                        }}
                                    >
                                        {images.map((img, idx) => (
                                            <Box
                                                key={`dot-${img?.id || img?.image_path || idx}`}
                                                component="button"
                                                type="button"
                                                aria-label={`${t('Show image')} ${idx + 1}`}
                                                onClick={() => selectImage(idx)}
                                                sx={{
                                                    width: activeImageIndex === idx ? 18 : 7,
                                                    height: 7,
                                                    p: 0,
                                                    border: 0,
                                                    borderRadius: 999,
                                                    cursor: 'pointer',
                                                    bgcolor: activeImageIndex === idx ? musicColors.rosin : 'rgba(36,27,24,0.28)',
                                                    transition: 'width 160ms ease, background-color 160ms ease',
                                                }}
                                            />
                                        ))}
                                    </Stack>
                                </>
                            )}
                        </Box>
                    </Stack>

                    {/* Product Info */}
                    <Stack spacing="20px" sx={{ minWidth: 0 }}>
                        <Box>
                            <Typography sx={{ ...eyebrowSxForTheme(theme), mb: 1.5 }}>
                                {product.category?.name || t('Uncategorized')}
                            </Typography>
                            <Typography variant="h3" sx={{ fontWeight: 700, fontSize: { xs: '1.45rem', sm: '1.75rem' }, mb: 2, lineHeight: 1.18, color: musicColors.ink }}>
                                {product.name}
                            </Typography>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Rating value={parseFloat(product.rating || 0)} readOnly size="small" precision={0.5} />
                                <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.5 }}>
                                    ({product.review_count || 0} {t('reviews')})
                                </Typography>
                            </Stack>
                        </Box>

                        <Box sx={{ py: 1 }}>
                            <Typography variant="h3" sx={{ fontWeight: 700, fontSize: { xs: '1.35rem', sm: '1.6rem' }, mb: 1, color: musicColors.rosin }}>
                                {formatMoney(unitPrice(selectedUnit))}
                            </Typography>
                            {hasFlashSale(selectedUnit) && (
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                    <Chip label={t('Flash Sale')} color="error" size="small" sx={{ fontWeight: 700 }} />
                                    <Typography variant="body2" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                                        {formatMoney(unitOriginalPrice(selectedUnit))}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {t('Ends')} {new Date(selectedUnit.flash_sale.ends_at).toLocaleString()}
                                    </Typography>
                                </Stack>
                            )}
                            <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
                                {t('In Stock')} ({selectedUnit?.available_qty ?? 0} {t('available')})
                            </Typography>
                        </Box>

                        {/* Image Selector moved here */}
                        <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }}>
                            {images.map((img, idx) => (
                                <Box 
                                    key={idx}
                                    onClick={() => selectImage(idx)}
                                    component="img"
                                    src={productImageUrl(img, app_url, app_base)}
                                    sx={{ 
                                        width: 72, 
                                        height: 96, 
                                        borderRadius: 1, 
                                        border: activeImageIndex === idx ? '2px solid' : '1px solid',
                                        borderColor: activeImageIndex === idx ? 'primary.main' : 'divider',
                                        cursor: 'pointer',
                                        objectFit: 'cover'
                                    }}
                                />
                            ))}
                        </Box>

                        <Divider />

                        {/* Variants Selection */}
                        {buyableUnits.length > 1 && (
                            <Box sx={{ py: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>{t('Choose selling unit')}</Typography>
                                <ToggleButtonGroup
                                    value={selectedUnit?.id}
                                    exclusive
                                    onChange={(e, next) => {
                                        const unit = buyableUnits.find(s => s.id === next);
                                        if (unit) {
                                            setSelectedUnit(unit);
                                            setQuantity(1);
                                            const unitImageIndex = images.findIndex(
                                                (img) => unit?.image?.id === img?.id || unit?.image?.image_path === img?.image_path
                                            );
                                            if (unitImageIndex >= 0) {
                                                setActiveImageIndex(unitImageIndex);
                                            }
                                        }
                                    }}
                                    size="small"
                                    sx={{ flexWrap: 'wrap', gap: 1.5, '& .MuiToggleButton-root': { border: '1px solid !important', borderRadius: '8px !important', minHeight: 44, px: 2, py: 1, '&.Mui-selected': { borderColor: 'primary.main !important', bgcolor: 'primary.light' } } }}
                                >
                                    {buyableUnits.map((unit) => (
                                        <ToggleButton key={unit.id} value={unit.id}>
                                            <Stack spacing={0.25} alignItems="flex-start">
                                                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                                    {formatUnitWithConversion(unit, buyableUnits)}
                                                </Typography>
                                                <Typography variant="caption" color={hasFlashSale(unit) ? 'error.main' : 'text.secondary'} sx={{ fontWeight: 700 }}>
                                                    {formatMoney(unitPrice(unit))}
                                                </Typography>
                                            </Stack>
                                        </ToggleButton>
                                    ))}
                                </ToggleButtonGroup>
                            </Box>
                        )}

                        {/* Quantity & Actions */}
                        <Stack
                            direction="row"
                            spacing={1.25}
                            alignItems="center"
                            sx={{ pt: 2, width: '100%', minWidth: 0, position: { xs: 'sticky', sm: 'static' }, bottom: { xs: 72 }, zIndex: 20, p: { xs: '8px', sm: 0 }, mx: { xs: '-8px', sm: 0 }, bgcolor: { xs: 'rgba(255,253,248,.96)', sm: 'transparent' }, borderRadius: 2, backdropFilter: { xs: 'blur(14px)', sm: 'none' }, boxShadow: { xs: '0 -10px 28px rgba(36,27,24,.10)', sm: 'none' } }}
                        >
                            <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                border: '1px solid', 
                                borderColor: 'divider', 
                                borderRadius: 2,
                                bgcolor: musicColors.sheet,
                                p: 0.5,
                                width: 112,
                                flex: '0 0 112px',
                            }}>
                                <IconButton size="small" onClick={() => handleQuantityChange(-1)} disabled={quantity <= 1}>
                                    <RemoveIcon fontSize="small" />
                                </IconButton>
                                <Typography variant="body1" sx={{ px: 2.5, fontWeight: 700 }}>{quantity}</Typography>
                                <IconButton
                                    size="small"
                                    onClick={() => handleQuantityChange(1)}
                                    disabled={quantity >= selectedUnitQtyLimit}
                                >
                                    <AddIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <Button 
                                variant="contained" 
                                startIcon={<ShoppingBag />}
                                disabled={!selectedUnit}
                                onClick={handleAddToCart}
                                sx={{
                                    py: 1.75,
                                    fontWeight: 700,
                                    borderRadius: 2,
                                    fontSize: '1rem',
                                    flex: '1 1 0',
                                    minWidth: 0,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {t('Add to Cart')}
                            </Button>
                            <IconButton
                                aria-label={t(inWishlist ? 'Remove from wishlist' : 'Add to wishlist')}
                                aria-pressed={inWishlist}
                                onClick={handleWishlist}
                                sx={{
                                    border: '1px solid',
                                    borderColor: inWishlist ? 'primary.main' : 'divider',
                                    borderRadius: 2,
                                    width: 48,
                                    height: 48,
                                    p: 0,
                                    flex: '0 0 48px',
                                    bgcolor: inWishlist ? 'primary.light' : musicColors.sheet,
                                    '&:hover': { bgcolor: 'primary.light', borderColor: 'primary.main' },
                                }}
                            >
                                {inWishlist ? <Favorite color="primary" /> : <FavoriteBorder color="primary" />}
                            </IconButton>
                        </Stack>

                        {product.description && <Box sx={{ ...sectionShellSx, p: { xs: '16px', md: '24px' }, mt: '24px' }}>
                            <Typography sx={{ ...eyebrowSxForTheme(theme), mb: 0.5 }}>{t('Details')}</Typography>
                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: musicColors.ink }}>{t('Product description')}</Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8, opacity: 0.9 }}>
                                {product.description}
                            </Typography>
                        </Box>}

                        <Stack direction="row" spacing={3}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}>
                                <Share fontSize="small" />
                                <Typography variant="caption" sx={{ fontWeight: 600 }}>{t('Share')}</Typography>
                            </Stack>
                        </Stack>
                    </Stack>
                </Box>

                <Box sx={{ mt: { xs: '32px', md: '48px' }, maxWidth: 960 }}>
                    <Typography sx={{ ...eyebrowSxForTheme(theme), mb: 0.5 }}>
                        {t('Feedback')}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: musicColors.ink }}>
                        {t('Ratings & Reviews')}
                    </Typography>
                    <Stack spacing={2}>
                        {auth?.user ? (
                            <Box component="form" onSubmit={submitReview} sx={{ ...sectionShellSx, p: 2 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                    {t('Rate this product')}
                                </Typography>
                                <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={1}
                                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                                    sx={{ mb: 1.5 }}
                                >
                                    <Rating
                                        name="product-rating"
                                        value={Number(data.rating)}
                                        onChange={(_, value) => setData('rating', value || 1)}
                                        icon={<Star fontSize="inherit" />}
                                        emptyIcon={<StarBorder fontSize="inherit" />}
                                        size="large"
                                        sx={{
                                            color: 'primary.main',
                                            '& .MuiRating-icon': {
                                                width: 34,
                                                height: 34,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            },
                                            '& .MuiSvgIcon-root': {
                                                display: 'block',
                                                fontSize: 30,
                                            },
                                        }}
                                    />
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                        {t('Your rating')}: {Number(data.rating) || 1} / 5
                                    </Typography>
                                </Stack>
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    label={t('Comment (optional)')}
                                    value={data.comment}
                                    onChange={(e) => setData('comment', e.target.value)}
                                    error={Boolean(errors.comment)}
                                    helperText={errors.comment}
                                />
                                {errors.rating && (
                                    <Typography variant="caption" color="error">
                                        {errors.rating}
                                    </Typography>
                                )}
                                <Button type="submit" variant="contained" sx={{ mt: 1.5 }} disabled={processing}>
                                    {t(processing ? 'Saving...' : 'Submit rating')}
                                </Button>
                            </Box>
                        ) : (
                            <Alert severity="info" variant="outlined">
                                <Link href={routeWithBase('/login', app_base)}>{t('Log in')}</Link> {t('to leave a rating.')}
                            </Alert>
                        )}

                        {reviewRows.length > 0 ? (
                            <>
                                {reviewRows.map((r) => (
                                    <Box key={r.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                {r.user?.name || t('Customer')}
                                            </Typography>
                                            <Rating readOnly size="small" value={Number(r.rating)} />
                                        </Stack>
                                        {r.comment && (
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                                {r.comment}
                                            </Typography>
                                        )}
                                    </Box>
                                ))}
                                {reviews.last_page > 1 && (
                                    <Stack alignItems="center" sx={{ mt: 1 }}>
                                        <Pagination
                                            count={reviews.last_page}
                                            page={reviews.current_page}
                                            onChange={handleReviewPageChange}
                                            color="primary"
                                            size="small"
                                        />
                                    </Stack>
                                )}
                            </>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                {t('No reviews yet. Be the first to rate this product.')}
                            </Typography>
                        )}
                    </Stack>
                </Box>

                {/* Recommendations */}
                {frequentlyBoughtTogether.length > 0 && (
                    <Box sx={{ mt: { xs: '32px', md: '48px' }, mb: '24px' }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>{t('Frequently Bought Together')}</Typography>
                        <Box sx={{
                            ...productListGridSx,
                        }}>
                            {frequentlyBoughtTogether.map((p) => (
                                <ProductCard key={p.id} product={p} returnTo={productListHref} />
                            ))}
                        </Box>
                    </Box>
                )}

                {recommendedProducts.length > 0 && (
                    <Box sx={{ mt: { xs: '32px', md: '48px' }, mb: '24px' }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>{t('Recommended for you')}</Typography>
                        <Box sx={{ 
                            ...productListGridSx,
                        }}>
                            {recommendedProducts.map((p) => (
                                <ProductCard key={p.id} product={p} returnTo={productListHref} />
                            ))}
                        </Box>
                    </Box>
                )}

                {/* Related Products */}
                {relatedProducts.length > 0 && (
                    <Box sx={{ mt: { xs: '32px', md: '48px' }, mb: '24px' }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>{t('You May Also Like')}</Typography>
                        <Box sx={{ 
                            ...productListGridSx,
                        }}>
                            {relatedProducts.map((p) => (
                                <ProductCard key={p.id} product={p} returnTo={productListHref} />
                            ))}
                        </Box>
                    </Box>
                )}
            </Container>

            <Footer />
            <MobileBottomNavSpacer />
            <MobileBottomNav />

            <Snackbar
                open={actionToast.open}
                autoHideDuration={3000}
                onClose={() => setActionToast((current) => ({ ...current, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                sx={{ bottom: { xs: 72, sm: 24 } }}
            >
                <Alert severity="success" variant="filled" onClose={() => setActionToast((current) => ({ ...current, open: false }))} sx={{ width: '100%' }}>
                    {actionToast.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default Show;
