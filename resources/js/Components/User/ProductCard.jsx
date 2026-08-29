import React, { useMemo, useState, useCallback } from 'react';
import { Card, CardMedia, CardContent, Typography, Box, IconButton, Stack, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { FavoriteBorder, Favorite, AddShoppingCart, Add, Remove, StarRounded, CheckCircleRounded, RadioButtonUncheckedRounded } from '@mui/icons-material';
import { usePage, Link } from '@/spa/router';
import { storageUrl, routeWithBase } from '@/Utils/url';
import { useCartStore } from '@/stores/cartStore';
import { useWishlistStore } from '@/stores/wishlistStore';
import { pickDefaultUnitForProduct } from '@/Utils/pickDefaultUnit';
import { formatMoney, hasFlashSale, unitOriginalPrice, unitPrice } from '@/Utils/pricing';
import { useTheme } from '@mui/material/styles';
import { getMusicStoreColors } from '@/Components/User/musicStoreDesign';
import { usePhraseTranslation } from '@/Utils/i18n';

const formatUnitLabel = (unit) => {
    return unit?.name || unit?.code || 'Unit';
};

const ProductCard = ({ product, returnTo = null }) => {
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);
    const ORDER_QTY_MAX = 999;
    const { app_url, app_base } = usePage().props;
    const t = usePhraseTranslation();
    const addToCart = useCartStore((s) => s.addItem);
    const wishToggle = useWishlistStore((s) => s.toggle);
    const inWishlist = useWishlistStore((s) => s.items.some((i) => i.productId === product.id));

    const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
    const [unitDialogOpen, setUnitDialogOpen] = useState(false);
    const [selectedUnitIds, setSelectedUnitIds] = useState([]);
    const [unitQuantities, setUnitQuantities] = useState({});
    const purchasableUnits = useMemo(
        () => (product.units || []).filter((s) => s.is_active !== false && Number(s.available_qty ?? 0) > 0),
        [product.units]
    );

    const displayUnit = useMemo(() => {
        if (purchasableUnits.length === 0) return null;
        return pickDefaultUnitForProduct(product) || purchasableUnits[0];
    }, [product, purchasableUnits]);
    const minPrice = displayUnit ? unitPrice(displayUnit) : 0;
    const showFlashPrice = displayUnit && hasFlashSale(displayUnit) && unitOriginalPrice(displayUnit) > minPrice;
    const ratingValue = Number(product.rating || 0);
    const reviewCount = Number(product.review_count || 0);
    const reviewText = reviewCount > 0
        ? `${reviewCount.toLocaleString()} ${t(reviewCount === 1 ? 'review' : 'reviews')}`
        : t('No reviews yet');

    const imageUrl = useMemo(() => {
        return product.primary_image
            ? storageUrl(product.primary_image.image_url || product.primary_image.image_path, app_url)
            : routeWithBase('/images/product-placeholder.svg', app_base);
    }, [product.primary_image, app_url, app_base]);

    const detailHref = useMemo(() => {
        const href = routeWithBase(`/products/${product.slug}`, app_base);
        return returnTo ? `${href}?return_to=${encodeURIComponent(returnTo)}` : href;
    }, [app_base, product.slug, returnTo]);

    const defaultUnit = useMemo(() => pickDefaultUnitForProduct(product), [product]);
    const canAddCart = Boolean(defaultUnit);
    const wishlistPayload = useMemo(
        () => ({
            productId: product.id,
            productCode: product.product_code || null,
            slug: product.slug,
            name: product.name,
            imagePath: product.primary_image?.image_path ?? null,
            units: product.units || [],
            categoryName: product.category?.name ?? null,
            rating: product.rating ?? 0,
            review_count: product.review_count ?? 0,
        }),
        [product]
    );

    const showToast = useCallback((message, severity = 'success') => {
        setToast({ open: true, message, severity });
    }, []);

    const handleWishlist = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            const added = wishToggle(wishlistPayload);
            showToast(t(added ? 'Saved to wishlist' : 'Removed from wishlist'), 'success');
        },
        [wishToggle, wishlistPayload, showToast, t]
    );

    const handleAddToCart = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!defaultUnit || !canAddCart) {
                showToast(t('No purchasable unit found for this product.'), 'warning');
                return;
            }
            setSelectedUnitIds([defaultUnit.id]);
            setUnitQuantities({ [defaultUnit.id]: 1 });
            setUnitDialogOpen(true);
        },
        [defaultUnit, canAddCart, showToast, t]
    );

    const unitQtyLimit = useCallback((unit) => Math.min(ORDER_QTY_MAX, Math.max(1, Number(unit?.available_qty ?? 1))), []);

    const clampUnitQuantity = useCallback((unit, value) => {
        const numericValue = Number(value);
        const nextValue = Number.isFinite(numericValue) ? numericValue : 1;
        return Math.max(1, Math.min(unitQtyLimit(unit), Math.floor(nextValue)));
    }, [unitQtyLimit]);

    const getUnitQuantity = useCallback((unit) => clampUnitQuantity(unit, unitQuantities[unit.id] ?? 1), [clampUnitQuantity, unitQuantities]);

    const toggleUnitSelection = useCallback((unit) => {
        setSelectedUnitIds((current) => (
            current.includes(unit.id)
                ? current.filter((id) => id !== unit.id)
                : [...current, unit.id]
        ));
        setUnitQuantities((current) => ({ ...current, [unit.id]: clampUnitQuantity(unit, current[unit.id] ?? 1) }));
    }, [clampUnitQuantity]);

    const changeUnitQuantity = useCallback((unit, value) => {
        setUnitQuantities((current) => ({ ...current, [unit.id]: clampUnitQuantity(unit, value) }));
        setSelectedUnitIds((current) => (current.includes(unit.id) ? current : [...current, unit.id]));
    }, [clampUnitQuantity]);

    const selectedCartUnits = useMemo(
        () => purchasableUnits.filter((unit) => selectedUnitIds.includes(unit.id)),
        [purchasableUnits, selectedUnitIds]
    );

    const handleConfirmAddToCart = useCallback(() => {
            if (selectedCartUnits.length === 0) {
                showToast(t('Please select at least one option.'), 'warning');
                return;
            }

            selectedCartUnits.forEach((unit) => {
                const imagePath = product.primary_image?.image_path || null;
                const addQty = getUnitQuantity(unit);

                addToCart({
                    unitId: unit.id,
                    productId: product.id,
                    name: product.name,
                    unitName: formatUnitLabel(unit),
                    productCode: product.product_code || null,
                    priceType: 'retail',
                    price: unitPrice(unit),
                    originalPrice: unitOriginalPrice(unit),
                    flashSale: unit.flash_sale || null,
                    imagePath,
                    maxQty: Number(unit.available_qty ?? 0),
                    isPreorder: false,
                    qty: addQty,
                });
            });

            setUnitDialogOpen(false);
            showToast(t('Added to cart'), 'success');
        },
        [selectedCartUnits, product, addToCart, showToast, getUnitQuantity, t]
    );

    return (
        <Card
            elevation={0}
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                border: '1px solid',
                borderColor: 'rgba(36,27,24,0.09)',
                borderRadius: 2,
                bgcolor: musicColors.sheet,
                overflow: 'hidden',
                boxShadow: '0 14px 34px rgba(36,27,24,0.06)',
                transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                    borderColor: musicColors.brass,
                    transform: 'translateY(-3px)',
                    boxShadow: '0 20px 44px rgba(36,27,24,0.12)',
                },
            }}
        >
            <Box
                component={Link}
                href={detailHref}
                sx={{ position: 'relative', pt: '125%', display: 'block' }}
            >
                <CardMedia
                    component="img"
                    image={imageUrl}
                    alt={product.name}
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        bgcolor: '#eee6d8',
                    }}
                />
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 'auto 0 0 0',
                        height: '38%',
                        background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(23,19,18,0.38) 100%)',
                        pointerEvents: 'none',
                    }}
                />
                <IconButton
                    sx={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        width: 44,
                        height: 44,
                        bgcolor: 'rgba(255,253,248,0.94)',
                        padding: 0,
                        zIndex: 1,
                        border: '1px solid rgba(36,27,24,0.08)',
                        '&:hover': { bgcolor: 'white' },
                    }}
                    size="small"
                    onClick={handleWishlist}
                    aria-label={t(inWishlist ? 'Remove from wishlist' : 'Add to wishlist')}
                >
                    {inWishlist ? (
                        <Favorite sx={{ fontSize: '1.15rem' }} color="primary" />
                    ) : (
                        <FavoriteBorder sx={{ fontSize: '1.15rem' }} color="primary" />
                    )}
                </IconButton>
                <IconButton
                    sx={{
                        position: 'absolute',
                        top: 62,
                        right: 10,
                        width: 44,
                        height: 44,
                        bgcolor: 'rgba(255,253,248,0.94)',
                        padding: 0,
                        zIndex: 1,
                        border: '1px solid rgba(36,27,24,0.08)',
                        '&:hover': { bgcolor: 'white' },
                    }}
                    size="small"
                    onClick={handleAddToCart}
                    disabled={!defaultUnit || !canAddCart}
                    aria-label={t('Add to cart')}
                >
                    <AddShoppingCart sx={{ fontSize: '1.15rem' }} color="primary" />
                </IconButton>
            </Box>
            <CardContent sx={{ flexGrow: 1, p: { xs: '12px !important', sm: '14px !important' } }}>
                <Typography variant="caption" sx={{ fontSize: '0.68rem', fontWeight: 700, color: musicColors.rosin, textTransform: 'uppercase', letterSpacing: '0.035em' }}>
                    {product.category?.name || t('Uncategorized')}
                </Typography>
                <Typography
                    variant="body2"
                    component={Link}
                    href={detailHref}
                    sx={{
                        fontWeight: 600,
                        fontSize: '0.84rem',
                        mt: '4px',
                        mb: '8px',
                        lineHeight: 1.35,
                        height: '2.7em',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        textDecoration: 'none',
                        color: 'inherit',
                        '&:hover': { color: musicColors.rosin },
                    }}
                >
                    {product.name}
                </Typography>

                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1, minHeight: 18 }}>
                    <StarRounded sx={{ fontSize: '0.95rem', color: reviewCount > 0 ? '#f5a623' : 'text.disabled' }} />
                    {reviewCount > 0 && (
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.primary', fontWeight: 600 }}>
                            {ratingValue.toFixed(1).replace(/\.0$/, '')}
                        </Typography>
                    )}
                    <Typography
                        variant="caption"
                        sx={{
                            fontSize: '0.7rem',
                            color: 'text.secondary',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {reviewCount > 0 ? `- ${reviewText}` : reviewText}
                    </Typography>
                </Stack>

                <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
                    <Box>
                        {showFlashPrice && (
                            <Typography
                                variant="caption"
                                sx={{ color: 'error.main', fontWeight: 700, display: 'block', lineHeight: 1.1 }}
                            >
                                {t('Flash Sale')}
                            </Typography>
                        )}
                        <Stack direction="row" spacing={0.75} alignItems="baseline" useFlexGap flexWrap="wrap">
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.15, color: musicColors.rosin }}>
                        {formatMoney(minPrice)}
                    </Typography>
                            {showFlashPrice && (
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ textDecoration: 'line-through', fontWeight: 600, lineHeight: 1 }}
                                >
                                    {formatMoney(unitOriginalPrice(displayUnit))}
                                </Typography>
                            )}
                        </Stack>
                    </Box>
                </Stack>
            </CardContent>

            <Snackbar
                open={toast.open}
                autoHideDuration={2200}
                onClose={() => setToast((t) => ({ ...t, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                sx={{ bottom: { xs: 72, sm: 24 } }}
            >
                <Alert
                    severity={toast.severity}
                    variant="filled"
                    onClose={() => setToast((t) => ({ ...t, open: false }))}
                    sx={{ width: '100%' }}
                >
                    {toast.message}
                </Alert>
            </Snackbar>

            <Dialog open={unitDialogOpen} onClose={() => setUnitDialogOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>{t('Select option')}</DialogTitle>
                <DialogContent sx={{ pt: '8px !important', pb: '8px' }}>
                    <Stack spacing="8px">
                        {purchasableUnits.map((unit) => {
                            const isSelected = selectedUnitIds.includes(unit.id);
                            const quantity = getUnitQuantity(unit);
                            return (
                                <Box
                                    key={unit.id}
                                    sx={{
                                        p: '10px 12px',
                                        border: '1px solid',
                                        borderColor: isSelected ? 'primary.main' : 'divider',
                                        borderRadius: 2,
                                        bgcolor: isSelected ? 'primary.light' : 'background.paper',
                                        color: 'text.primary',
                                        transition: 'border-color 0.15s, background 0.15s',
                                    }}
                                >
                                    <Box
                                        role="button"
                                        tabIndex={0}
                                        aria-pressed={isSelected}
                                        aria-label={`${t('Select option')} ${formatUnitLabel(unit)}`}
                                        onClick={() => toggleUnitSelection(unit)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                toggleUnitSelection(unit);
                                            }
                                        }}
                                        sx={{
                                            display: 'grid',
                                            gridTemplateColumns: '22px minmax(0, 1fr) auto',
                                            gap: '10px',
                                            alignItems: 'center',
                                            minHeight: 44,
                                            minWidth: 0,
                                            cursor: 'pointer',
                                            outline: 'none',
                                            '&:focus-visible': { boxShadow: '0 0 0 3px', boxShadowColor: 'primary.light', borderRadius: 1 },
                                        }}
                                    >
                                        {isSelected
                                            ? <CheckCircleRounded color="primary" sx={{ fontSize: 21 }} />
                                            : <RadioButtonUncheckedRounded color="disabled" sx={{ fontSize: 21 }} />}
                                        <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                                            <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.3 }} title={formatUnitLabel(unit)}>
                                                {formatUnitLabel(unit)}
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2" color="primary" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                                            {formatMoney(unitPrice(unit))}
                                        </Typography>
                                    </Box>
                                    {isSelected && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', pt: '8px', mt: '6px', borderTop: '1px solid', borderColor: 'divider' }}>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                {t('Quantity')}
                                            </Typography>
                                            <Box sx={{ display: 'grid', gridTemplateColumns: '44px 34px 44px', alignItems: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, bgcolor: 'background.paper', overflow: 'hidden' }}>
                                                <IconButton
                                                    size="small"
                                                    aria-label={`${t('Decrease quantity for')} ${formatUnitLabel(unit)}`}
                                                    disabled={quantity <= 1}
                                                    onClick={() => changeUnitQuantity(unit, quantity - 1)}
                                                    sx={{ width: 44, height: 44, borderRadius: 0 }}
                                                >
                                                    <Remove fontSize="small" />
                                                </IconButton>
                                                <Typography aria-label={`${t('Qty')} ${formatUnitLabel(unit)}`} sx={{ height: 44, lineHeight: '44px', textAlign: 'center', fontWeight: 700, borderLeft: '1px solid', borderRight: '1px solid', borderColor: 'divider', fontSize: '0.875rem' }}>
                                                    {quantity}
                                                </Typography>
                                                <IconButton
                                                    size="small"
                                                    aria-label={`${t('Increase quantity for')} ${formatUnitLabel(unit)}`}
                                                    disabled={quantity >= unitQtyLimit(unit)}
                                                    onClick={() => changeUnitQuantity(unit, quantity + 1)}
                                                    sx={{ width: 44, height: 44, borderRadius: 0 }}
                                                >
                                                    <Add fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
                            );
                        })}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUnitDialogOpen(false)} color="inherit">
                        {t('Cancel')}
                    </Button>
                    <Button variant="contained" onClick={handleConfirmAddToCart} disabled={selectedCartUnits.length === 0}>
                        {t('Add to cart')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Card>
    );
};

export default ProductCard;
