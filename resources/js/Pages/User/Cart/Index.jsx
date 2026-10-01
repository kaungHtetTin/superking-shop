import React from 'react';
import axios from 'axios';
import { Link, router, usePage } from '@/spa/router';
import {
    Box,
    Button,
    Container,
    Divider,
    IconButton,
    Paper,
    Stack,
    TextField,
    MenuItem,
    Typography,
} from '@mui/material';
import { Add, DeleteOutlined, Remove, ShoppingCartRounded } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import BackLink from '@/Components/User/BackLink';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { routeWithBase, storageUrl } from '@/Utils/url';
import { useCartStore } from '@/stores/cartStore';
import { formatMoney, unitOriginalPrice, unitPrice } from '@/Utils/pricing';
import { formatUnitWithConversion } from '@/Utils/unitLabel';
import {
    eyebrowSxForTheme,
    getMusicStoreColors,
    sectionShellSxForTheme,
    storefrontBackgroundSx,
} from '@/Components/User/musicStoreDesign';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function CartIndex() {
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);
    const sectionShellSx = sectionShellSxForTheme(theme);
    const ORDER_QTY_MAX = 999;
    const { app_base, app_url, auth } = usePage().props;
    const t = usePhraseTranslation();
    const items = useCartStore((s) => s.items);
    const setQty = useCartStore((s) => s.setQty);
    const changeUnit = useCartStore((s) => s.changeUnit);
    const syncUnitOptions = useCartStore((s) => s.syncUnitOptions);
    const removeItem = useCartStore((s) => s.removeItem);

    React.useEffect(() => {
        const productIds = [...new Set(items.map((item) => Number(item.productId)).filter(Boolean))];
        if (productIds.length === 0) return undefined;

        let cancelled = false;
        axios.post(routeWithBase('/cart/selling-units', app_base), { product_ids: productIds })
            .then(({ data }) => {
                if (cancelled) return;
                productIds.forEach((productId) => {
                    const units = data.products?.[productId] || [];
                    syncUnitOptions(productId, (units || []).map((unit) => ({
                        id: unit.id,
                        name: unit.name || unit.code,
                        code: unit.code || null,
                        price: unitPrice(unit),
                        originalPrice: unitOriginalPrice(unit),
                        flashSale: unit.flash_sale || null,
                        maxQty: Number(unit.available_qty || 0),
                        conversionFactor: Number(unit.conversion_factor || 1),
                        isBase: Boolean(unit.is_base),
                    })));
                });
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [app_base]);

    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const hasUnavailableItems = items.some((item) => item.unavailable);

    return (
        <Box
            className="user-storefront storefront-purchase"
            sx={{
                minHeight: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                ...storefrontBackgroundSx(theme),
            }}
        >
            <UserBrandHead title="Your Cart" />
            <Navbar />

            <Container maxWidth="lg" sx={{ mt: { xs: '16px', md: '24px' }, pb: { xs: '24px', md: '32px' }, flex: '1 0 auto', width: '100%' }}>
                <BackLink href={routeWithBase('/products', app_base)}>
                    {t('Continue shopping')}
                </BackLink>

                <Typography variant="h4" sx={{ fontWeight: 700, mb: 2, color: musicColors.ink }}>
                    {t('Shopping cart')}
                </Typography>

                {items.length === 0 ? (
                    <Paper elevation={0} sx={{ ...sectionShellSx, p: { xs: '24px', sm: '28px' }, textAlign: 'center' }}>
                        <ShoppingCartRounded sx={{ fontSize: 52, color: 'primary.main', mb: '12px' }} />
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: '8px' }}>{t('Your cart is empty')}</Typography>
                        <Typography color="text.secondary" sx={{ mb: '16px', maxWidth: 520, mx: 'auto' }}>
                            {t('Your cart is empty. Add an instrument, cable, accessory, or studio essential to get started.')}
                        </Typography>
                        <Button variant="contained" component={Link} href={routeWithBase('/products', app_base)}>
                            {t('Browse products')}
                        </Button>
                    </Paper>
                ) : (
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 340px' }, gap: { xs: '16px', md: '20px' }, alignItems: 'start' }}>
                        <Stack spacing="12px" sx={{ minWidth: 0 }}>
                            <Stack direction="row" sx={{ px: '2px', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{t('Cart items')}</Typography>
                                <Typography variant="caption" color="text.secondary">{items.length} {t(items.length === 1 ? 'item' : 'items')}</Typography>
                            </Stack>
                        {items.map((line) => (
                            <Paper
                                key={line.unitId}
                                elevation={0}
                                sx={{
                                    p: { xs: '12px', sm: '16px' },
                                    borderRadius: '10px',
                                    border: '1px solid',
                                    borderColor: 'rgba(15,23,42,0.1)',
                                    bgcolor: musicColors.sheet,
                                    display: 'grid',
                                    gridTemplateColumns: {
                                        xs: '72px minmax(0, 1fr)',
                                        sm: '88px minmax(0, 1fr) 170px',
                                    },
                                    gridTemplateAreas: {
                                        xs: '"image details" "actions actions"',
                                        sm: '"image details actions"',
                                    },
                                    columnGap: { xs: '12px', sm: '14px' },
                                    rowGap: { xs: '12px', sm: 0 },
                                    alignItems: { xs: 'start', sm: 'stretch' },
                                }}
                            >
                                <Box
                                    component="img"
                                    src={line.imagePath ? storageUrl(line.imagePath, app_url) : routeWithBase('/images/product-default.png', app_base)}
                                    alt=""
                                    sx={{
                                        gridArea: 'image',
                                        width: { xs: 72, sm: 88 },
                                        height: { xs: 72, sm: 88 },
                                        objectFit: 'contain',
                                        bgcolor: 'action.hover',
                                        borderRadius: 1.5,
                                        alignSelf: 'flex-start',
                                    }}
                                />
                                <Box sx={{ gridArea: 'details', minWidth: 0 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3, mb: '2px' }}>
                                        {line.name}
                                    </Typography>
                                    <Stack spacing="2px" sx={{ mb: '4px', minWidth: 0, pt: (line.unitOptions || []).length > 1 ? '14px' : '4px' }}>
                                        {(line.unitOptions || []).length > 1 ? (
                                            <TextField
                                                select
                                                size="small"
                                                label={t('Selling unit')}
                                                value={line.unitId}
                                                onChange={(event) => changeUnit(line.unitId, event.target.value)}
                                                sx={{ width: '100%', maxWidth: 320 }}
                                            >
                                                {line.unitOptions.map((unit) => (
                                                    <MenuItem key={unit.id} value={unit.id} disabled={Number(unit.maxQty || 0) <= 0}>
                                                        {formatUnitWithConversion(unit, line.unitOptions)} · {formatMoney(unit.price)}
                                                    </MenuItem>
                                                ))}
                                            </TextField>
                                        ) : (
                                            <Typography component="div" variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
                                                {t('Selling unit')}: {line.unitName}
                                            </Typography>
                                        )}
                                        {line.productCode && (
                                            <Typography component="div" variant="caption" color="text.secondary" sx={{ lineHeight: 1.35, overflowWrap: 'anywhere' }}>
                                                {t('Product code')}: {line.productCode}
                                            </Typography>
                                        )}
                                        {line.unavailable && <Typography variant="caption" color="error">{t('This selling unit is no longer available. Remove it or choose another unit.')}</Typography>}
                                        {line.isPreorder && (
                                            <Typography component="div" variant="caption" color="warning.main" sx={{ fontWeight: 700 }}>
                                                {t('Pre-order')}
                                            </Typography>
                                        )}
                                        {line.flashSale && (
                                            <Typography component="div" variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>
                                                {t('Flash Sale')}
                                            </Typography>
                                        )}
                                    </Stack>
                                    <Typography variant="body2" color="primary" sx={{ fontWeight: 700, mt: '4px' }}>
                                        {formatMoney(line.price)} {t('each')}
                                    </Typography>
                                    {line.flashSale && line.originalPrice && (
                                        <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                                            {formatMoney(line.originalPrice)}
                                        </Typography>
                                    )}
                                </Box>
                                <Box
                                    sx={{
                                        gridArea: 'actions',
                                        display: 'flex',
                                        flexDirection: { xs: 'row', sm: 'column' },
                                        alignItems: { xs: 'center', sm: 'flex-end' },
                                        justifyContent: { xs: 'space-between', sm: 'flex-end' },
                                        gap: { xs: '8px', sm: '6px' },
                                        minWidth: 0,
                                        width: { xs: '100%', sm: 'auto' },
                                    }}
                                >
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, whiteSpace: 'nowrap', minWidth: 0 }}>
                                        {formatMoney(line.price * line.qty)}
                                    </Typography>
                                    <Stack
                                        direction="row"

                                        spacing="4px"
                                        sx={{ alignItems: "center", ...({ width: 'auto', flexShrink: 0, justifyContent: 'flex-end', alignItems: 'center' }) }}
                                    >
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                borderRadius: 1,
                                                bgcolor: 'background.paper',
                                            }}
                                        >
                                            <IconButton aria-label={t('Decrease quantity')} size="small" sx={{ width: 44, height: 44 }} onClick={() => setQty(line.unitId, line.qty - 1)} disabled={line.qty <= 1}>
                                                <Remove fontSize="small" />
                                            </IconButton>
                                            <Typography aria-live="polite" sx={{ px: '4px', minWidth: 24, textAlign: 'center', fontWeight: 700, fontSize: '0.875rem' }}>{line.qty}</Typography>
                                            <IconButton
                                                aria-label={t('Increase quantity')}
                                                size="small"
                                                sx={{ width: 44, height: 44 }}
                                                onClick={() => setQty(line.unitId, line.qty + 1)}
                                                disabled={line.qty >= Math.min(ORDER_QTY_MAX, Number(line.maxQty || ORDER_QTY_MAX))}
                                            >
                                                <Add fontSize="small" />
                                            </IconButton>
                                        </Box>
                                        <IconButton size="small" color="error" sx={{ width: 44, height: 44 }} onClick={() => removeItem(line.unitId)} aria-label={t('Remove')}>
                                            <DeleteOutlined />
                                        </IconButton>
                                    </Stack>
                                </Box>
                            </Paper>
                        ))}
                        </Stack>

                        <Paper elevation={0} sx={{ ...sectionShellSx, p: { xs: '20px', sm: '24px' }, mt: { md: '44px' }, position: { md: 'sticky' }, top: { md: 88 }, borderRadius: '10px' }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>{t('Order summary')}</Typography>
                            <Stack direction="row" sx={{ mb: '12px', justifyContent: 'space-between', gap: '16px', alignItems: 'center' }}>
                                <Typography variant="body2" color="text.secondary">{t('Items')}</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{items.reduce((sum, item) => sum + Number(item.qty || 0), 0)}</Typography>
                            </Stack>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '12px', alignItems: 'center' }}>
                                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                                    {t('Subtotal')}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, textAlign: 'right', overflowWrap: 'normal' }}>
                                    {formatMoney(subtotal)}
                                </Typography>
                            </Box>
                            <Divider sx={{ my: 2 }} />
                            <Stack direction="row" sx={{ mb: '20px', justifyContent: 'space-between', gap: '16px', alignItems: 'center' }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{t('Total')}</Typography>
                                <Typography variant="h6" color="primary.main" sx={{ fontWeight: 800 }}>{formatMoney(subtotal)}</Typography>
                            </Stack>
                            <Button
                                fullWidth
                                variant="contained"
                                size="large"
                                disabled={hasUnavailableItems}
                                sx={{ minHeight: 46, fontWeight: 700, borderRadius: '8px' }}
                                onClick={() => {
                                    if (!auth?.user) {
                                        router.visit(routeWithBase('/login', app_base));
                                        return;
                                    }
                                    router.visit(routeWithBase('/checkout', app_base));
                                }}
                            >
                                {t(auth?.user ? 'Proceed to checkout' : 'Log in to checkout')}
                            </Button>
                        </Paper>
                    </Box>
                )}
            </Container>

            <Footer />
            <MobileBottomNavSpacer />
            <MobileBottomNav />
        </Box>
    );
}
