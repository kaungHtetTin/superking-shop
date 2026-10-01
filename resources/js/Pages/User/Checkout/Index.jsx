import React, { useMemo, useRef, useState } from 'react';
import { Link, useForm, usePage } from '@/spa/router';
import axios from 'axios';
import {
    Alert,
    Box,
    Button,
    Container,
    Divider,
    FormHelperText,
    IconButton,
    Paper,
    Stack,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Typography,
} from '@mui/material';
import { AccountBalanceWallet, CloudUpload, ContentCopyRounded, Image as ImageIcon } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import BackLink from '@/Components/User/BackLink';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { routeWithBase } from '@/Utils/url';
import { useCartStore } from '@/stores/cartStore';
import { formatMoney } from '@/Utils/pricing';
import {
    eyebrowSxForTheme,
    getMusicStoreColors,
    sectionShellSxForTheme,
    storefrontBackgroundSx,
} from '@/Components/User/musicStoreDesign';
import { usePhraseTranslation } from '@/Utils/i18n';

const steps = ['Shipping', 'Payment proof', 'Review'];

export default function CheckoutIndex({ shop, loyalty, paymentMethods = [] }) {
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);
    const sectionShellSx = sectionShellSxForTheme(theme);
    const { app_base, auth } = usePage().props;
    const t = usePhraseTranslation();
    const items = useCartStore((s) => s.items);
    const clearCart = useCartStore((s) => s.clear);
    const [activeStep, setActiveStep] = useState(0);
    const [proofPreview, setProofPreview] = useState(null);
    const [quote, setQuote] = useState(null);
    const [quoteError, setQuoteError] = useState(null);
    const [quoteLoading, setQuoteLoading] = useState(true);
    const fileInputRef = useRef(null);

    const { data, setData, post, processing, errors, reset, transform, setError, clearErrors } = useForm({
        lines: [],
        receiver_name: auth?.user?.name ?? '',
        receiver_phone: auth?.user?.phone ?? '',
        shipping_address: auth?.user?.default_address ?? '',
        order_notes: '',
        payment_method_id: paymentMethods[0]?.id || '',
        payment_proof: null,
        coupon_code: '',
        redeem_points: 0,
    });

    const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price * i.qty, 0), [items]);
    const shipping = useMemo(() => {
        const min = shop?.free_shipping_minimum ?? 0;
        if (subtotal >= min) return 0;
        return shop?.shipping_flat ?? 0;
    }, [subtotal, shop]);
    const loyaltyEnabled = Boolean(loyalty?.isEnabled ?? true);
    const pointValue = useMemo(
        () => (loyaltyEnabled ? Math.round((Number(data.redeem_points || 0) * (loyalty?.redeemCurrencyPerPoint ?? 0.01)) * 100) / 100 : 0),
        [data.redeem_points, loyalty, loyaltyEnabled],
    );
    const total = quote?.final ?? Math.round((subtotal + shipping - pointValue) * 100) / 100;
    const selectedPaymentMethod = useMemo(
        () => paymentMethods.find((method) => String(method.id) === String(data.payment_method_id)) || null,
        [paymentMethods, data.payment_method_id],
    );
    const checkoutError = useMemo(() => {
        const preferredFields = [
            'lines',
            'receiver_name',
            'receiver_phone',
            'shipping_address',
            'order_notes',
            'payment_method_id',
            'payment_proof',
            'coupon_code',
            'redeem_points',
            'inventory',
            'order',
            'quantity',
        ];

        return preferredFields
            .map((field) => errors[field])
            .find(Boolean)
            || Object.values(errors).find(Boolean)
            || t('Please fix the errors and try again.');
    }, [errors, t]);

    React.useEffect(() => {
        if (items.length === 0) {
            window.location.assign(routeWithBase('/cart', app_base));
        }
    }, [items.length, app_base]);

    React.useEffect(() => {
        if (!data.payment_method_id && paymentMethods.length > 0) {
            setData('payment_method_id', paymentMethods[0].id);
        }
    }, [paymentMethods, data.payment_method_id]);

    React.useEffect(() => {
        if (items.length === 0) return undefined;
        let cancelled = false;
        setQuoteLoading(true);
        setQuote(null);
        const timer = window.setTimeout(() => {
            axios
                .post(routeWithBase('/checkout/quote', app_base), {
                    lines: items.map((i) => ({ product_unit_id: i.unitId, quantity: i.qty })),
                    coupon_code: data.coupon_code || null,
                    redeem_points: loyaltyEnabled ? Number(data.redeem_points || 0) : 0,
                })
                .then(({ data: quoted }) => {
                    if (cancelled) return;
                    setQuote(quoted);
                    setQuoteError(null);
                })
                .catch((error) => {
                    if (cancelled) return;
                    setQuote(null);
                    const responseErrors = error.response?.data?.errors;
                    setQuoteError(
                        Object.entries(responseErrors || {}).some(([key]) => key.startsWith('lines.') && key.endsWith('product_unit_id'))
                            ? t('An item in your cart is no longer available. Return to your cart and remove or reselect its selling unit.')
                            :
                        responseErrors?.coupon_code?.[0] ||
                            responseErrors?.redeem_points?.[0] ||
                            responseErrors?.lines?.[0] ||
                            Object.values(responseErrors || {}).flat()[0] || 'Could not calculate this discount.',
                    );
                }).finally(() => { if (!cancelled) setQuoteLoading(false); });
        }, 300);

        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [items, data.coupon_code, data.redeem_points, app_base]);

    const handleProofChange = (e) => {
        const file = e.target.files?.[0] ?? null;

        if (file && file.size > 10 * 1024 * 1024) {
            e.target.value = '';
            setData('payment_proof', null);
            setError('payment_proof', t('The payment screenshot is too large. Please upload an image no larger than 10 MB.'));
            if (proofPreview) URL.revokeObjectURL(proofPreview);
            setProofPreview(null);
            return;
        }

        clearErrors('payment_proof');
        setData('payment_proof', file);
        if (proofPreview) URL.revokeObjectURL(proofPreview);
        setProofPreview(file ? URL.createObjectURL(file) : null);
    };

    const canNext = () => {
        if (activeStep === 0) {
            return data.receiver_name.trim() && data.receiver_phone.trim() && data.shipping_address.trim();
        }
        if (activeStep === 1) {
            return Boolean(data.payment_method_id) && Boolean(data.payment_proof);
        }
        return true;
    };

    const handlePlaceOrder = () => {
        if (processing || quoteLoading || quoteError || !quote) return;
        transform((formData) => ({
            ...formData,
            lines: items.map((i) => ({ product_unit_id: i.unitId, quantity: i.qty, is_preorder: Boolean(i.isPreorder) })),
            redeem_points: loyaltyEnabled ? formData.redeem_points : 0,
        }));
        post(routeWithBase('/checkout', app_base), {
            preserveScroll: true,
            forceFormData: true,
            onError: (submissionErrors) => {
                const fields = Object.keys(submissionErrors);
                const shippingFields = ['receiver_name', 'receiver_phone', 'shipping_address', 'order_notes', 'coupon_code', 'redeem_points'];
                const paymentFields = ['payment_method_id', 'payment_method', 'payment_proof'];

                if (fields.some((field) => shippingFields.includes(field))) {
                    setActiveStep(0);
                } else if (fields.some((field) => paymentFields.includes(field))) {
                    setActiveStep(1);
                } else {
                    setActiveStep(2);
                }

                window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
            },
            onSuccess: () => {
                clearCart();
                reset();
                if (proofPreview) URL.revokeObjectURL(proofPreview);
                setProofPreview(null);
            },
        });
    };

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
            <UserBrandHead title="Checkout" />
            <Navbar />

            <Container maxWidth="lg" sx={{ mt: { xs: '16px', md: '24px' }, pb: { xs: '24px', md: '32px' } }}>
                <BackLink href={routeWithBase('/cart', app_base)}>
                    {t('Back to cart')}
                </BackLink>

                <Typography sx={{ ...eyebrowSxForTheme(theme), mb: 0.5 }}>
                    {t('Secure checkout')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 2, color: musicColors.ink }}>
                    {t('Finish your order')}
                </Typography>

                <Paper elevation={0} sx={{ ...sectionShellSx, px: { xs: 1.5, sm: 2.5 }, py: 1.5, mb: 2, borderRadius: 2.5 }}>
                    <Stepper activeStep={activeStep} sx={{ '& .MuiStepLabel-label': { fontSize: { xs: '0.7rem', sm: '0.82rem' }, fontWeight: 700 }, '& .MuiStepConnector-line': { borderColor: 'divider' } }}>
                        {steps.map((label) => <Step key={label}><StepLabel>{t(label)}</StepLabel></Step>)}
                    </Stepper>
                </Paper>

                {Object.keys(errors).length > 0 && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {checkoutError}
                    </Alert>
                )}

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: { xs: '16px', md: '20px' }, alignItems: 'start' }}>
                <Paper elevation={0} sx={{ ...sectionShellSx, p: { xs: '16px', sm: '24px' }, borderRadius: 2.5 }}>
                    {activeStep === 0 && (
                        <Stack spacing="16px">
                            <Box><Typography variant="h6" sx={{ fontWeight: 800 }}>{t('Delivery details')}</Typography><Typography variant="body2" color="text.secondary">{t('Enter the contact and address for this order.')}</Typography></Box>
                            <TextField
                                label={t('Full name')}
                                value={data.receiver_name}
                                onChange={(e) => setData('receiver_name', e.target.value)}
                                error={!!errors.receiver_name}
                                helperText={errors.receiver_name}
                                fullWidth
                                required
                            />
                            <TextField
                                label={t('Phone')}
                                value={data.receiver_phone}
                                onChange={(e) => setData('receiver_phone', e.target.value)}
                                error={!!errors.receiver_phone}
                                helperText={errors.receiver_phone}
                                fullWidth
                                required
                            />
                            <TextField
                                label={t('Shipping address')}
                                value={data.shipping_address}
                                onChange={(e) => setData('shipping_address', e.target.value)}
                                error={!!errors.shipping_address}
                                helperText={errors.shipping_address}
                                fullWidth
                                required
                                multiline
                                minRows={3}
                            />
                            <TextField
                                label={t('Order notes (optional)')}
                                value={data.order_notes}
                                onChange={(e) => setData('order_notes', e.target.value)}
                                fullWidth
                                multiline
                                minRows={2}
                            />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                <TextField
                                    label={t('Coupon code')}
                                    value={data.coupon_code}
                                    onChange={(e) => setData('coupon_code', e.target.value.toUpperCase())}
                                    error={!!errors.coupon_code}
                                    helperText={errors.coupon_code}
                                    fullWidth
                                />
                                {loyaltyEnabled && (
                                    <TextField
                                        label={`${t('Redeem points')} (${loyalty?.points ?? 0} ${t('available')})`}
                                        type="number"
                                        value={data.redeem_points}
                                        onChange={(e) => setData('redeem_points', Math.max(0, Number(e.target.value || 0)))}
                                        error={!!errors.redeem_points}
                                        helperText={errors.redeem_points || `${loyalty?.tier ?? 'Bronze'} ${t('tier')}`}

                                        fullWidth
                                     slotProps={{ htmlInput: {
                                            min: 0,
                                            max: loyalty?.points ?? 0,
                                            step: 1,
                                        } }}/>
                                )}
                            </Stack>
                            {!loyaltyEnabled && <Alert severity="info">{t('Point rewards are currently disabled.')}</Alert>}
                            {quoteError && <Alert severity="warning">{t(quoteError)}</Alert>}
                        </Stack>
                    )}

                    {activeStep === 1 && (
                        <Stack spacing="16px">
                            <Box><Typography variant="h6" sx={{ fontWeight: 800 }}>{t('Payment')}</Typography><Typography variant="body2" color="text.secondary">{t('Choose an account and attach your transfer confirmation.')}</Typography></Box>
                            {paymentMethods.length === 0 ? (
                                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                                    {t('No payment methods are available right now. Please contact support before placing an order.')}
                                </Alert>
                            ) : (
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.25 }}>
                                    {paymentMethods.map((method) => {
                                        const selected = String(data.payment_method_id) === String(method.id);

                                        return (
                                            <Paper
                                                key={method.id}
                                                component="button"
                                                type="button"
                                                elevation={0}
                                                onClick={() => setData('payment_method_id', method.id)}
                                                sx={{
                                                    textAlign: 'left',
                                                    p: '16px',
                                                    borderRadius: 2,
                                                    border: '1px solid',
                                                    borderColor: selected ? 'primary.main' : 'divider',
                                                    bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : 'background.paper',
                                                    cursor: 'pointer',
                                                    color: 'inherit',
                                                    '&:hover': { borderColor: 'primary.main' },
                                                }}
                                            >
                                                <Stack direction="row" spacing={1.25}  sx={{ alignItems: "center", ...({}) }}>
                                                    <Box
                                                        sx={{
                                                            width: 48,
                                                            height: 48,
                                                            borderRadius: 1.5,
                                                            border: '1px solid',
                                                            borderColor: 'divider',
                                                            display: 'grid',
                                                            placeItems: 'center',
                                                            overflow: 'hidden',
                                                            flexShrink: 0,
                                                            bgcolor: 'white',
                                                        }}
                                                    >
                                                        {method.icon_url ? (
                                                            <Box component="img" src={method.icon_url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <AccountBalanceWallet color="primary" fontSize="small" />
                                                        )}
                                                    </Box>
                                                    <Box sx={{ minWidth: 0, flex: 1 }}>
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
                                                    <IconButton
                                                        aria-label={t('Copy account number')}
                                                        onClick={(event) => { event.stopPropagation(); navigator.clipboard?.writeText(String(method.account_no || '')); }}
                                                        sx={{ width: 40, height: 40, color: 'primary.main', flexShrink: 0 }}
                                                    ><ContentCopyRounded sx={{ fontSize: 20 }} /></IconButton>
                                                </Stack>
                                            </Paper>
                                        );
                                    })}
                                </Box>
                            )}
                            {errors.payment_method_id && <FormHelperText error>{errors.payment_method_id}</FormHelperText>}
                            <Alert severity="info" sx={{ borderRadius: 2 }}>
                                <Typography component="ol" variant="body2" sx={{ m: 0, pl: '20px', '& li + li': { mt: '4px' } }}>
                                    <li>{t('Send the order total to the selected account.')}</li>
                                    <li>{t('Save a clear successful-transfer screenshot.')}</li>
                                    <li>{t('Upload it below for verification.')}</li>
                                </Typography>
                            </Alert>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                {t('Transaction screenshot (required)')}
                            </Typography>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                hidden
                                onChange={handleProofChange}
                            />
                            <Button
                                variant="outlined"
                                startIcon={<CloudUpload />}
                                onClick={() => fileInputRef.current?.click()}
                                fullWidth
                                sx={{ minHeight: 96, py: '16px', fontWeight: 700, borderStyle: 'dashed', borderWidth: 2 }}
                            >
                                {t(data.payment_proof ? 'Change screenshot' : 'Upload screenshot')}
                            </Button>
                            {errors.payment_proof && <FormHelperText error>{errors.payment_proof}</FormHelperText>}
                            {proofPreview && (
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 1,
                                        borderRadius: 2,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                    }}
                                >
                                    <Box
                                        component="img"
                                        src={proofPreview}
                                        alt={t('Payment proof preview')}
                                        sx={{
                                            width: 72,
                                            height: 72,
                                            objectFit: 'cover',
                                            borderRadius: 1,
                                            flexShrink: 0,
                                        }}
                                    />
                                    <Stack sx={{ minWidth: 0 }}>
                                        <Stack direction="row" spacing={0.5}  sx={{ alignItems: "center", ...({}) }}>
                                            <ImageIcon fontSize="small" color="primary" />
                                            <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                                                {data.payment_proof?.name}
                                            </Typography>
                                        </Stack>
                                        <Typography variant="caption" color="text.secondary">
                                            {t('JPG, PNG or WebP - max 10 MB')}
                                        </Typography>
                                        <Button color="error" size="small" sx={{ alignSelf: 'flex-start', mt: '4px', minHeight: 36, px: 0 }} onClick={() => { if (proofPreview) URL.revokeObjectURL(proofPreview); setProofPreview(null); setData('payment_proof', null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                                            {t('Remove')}
                                        </Button>
                                    </Stack>
                                </Paper>
                            )}
                        </Stack>
                    )}

                    {activeStep === 2 && (
                        <Stack spacing="16px">
                            <Box><Typography variant="h6" sx={{ fontWeight: 800 }}>{t('Review order')}</Typography><Typography variant="body2" color="text.secondary">{t('Check your items and payment details before submitting.')}</Typography></Box>
                            {quoteError && (
                                <Alert severity="warning">
                                    {t(quoteError)}
                                </Alert>
                            )}
                            {items.map((line) => (
                                <Stack key={line.unitId} direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                                    <Box sx={{ minWidth: 0, pr: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                            {line.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {line.unitName} x {line.qty}
                                        </Typography>
                                        {line.isPreorder && (
                                            <Typography variant="caption" color="warning.main" display="block" sx={{ fontWeight: 700 }}>
                                                {t('Pre-order')}
                                            </Typography>
                                        )}
                                        {line.flashSale && (
                                            <Typography variant="caption" color="error.main" display="block" sx={{ fontWeight: 700 }}>
                                                {t('Flash Sale')}
                                            </Typography>
                                        )}
                                    </Box>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                        {formatMoney(line.price * line.qty)}
                                    </Typography>
                                </Stack>
                            ))}
                            <Divider />
                            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: '16px' }}>
                                <Typography variant="body2">{t('Subtotal')}</Typography>
                                <Typography variant="body2">{formatMoney(quote?.regular_subtotal ?? subtotal)}</Typography>
                            </Stack>
                            {Number(quote?.flash_discount || 0) > 0 && <Stack direction="row" sx={{ justifyContent: 'space-between', gap: '16px' }}><Typography variant="body2" color="primary">{t('Flash sale discount')}</Typography><Typography variant="body2" color="primary">-{formatMoney(quote.flash_discount)}</Typography></Stack>}
                            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: '16px' }}>
                                <Typography variant="body2">{t('Shipping')}</Typography>
                                <Typography variant="body2">
                                    {Number(quote?.shipping ?? shipping) === 0 ? t('Free') : formatMoney(quote?.shipping ?? shipping)}
                                </Typography>
                            </Stack>
                            {(quote?.coupon_discount > 0 || quote?.points_value > 0) && (
                                <>
                                    {quote?.coupon_discount > 0 && (
                            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: '16px' }}>
                                            <Typography variant="body2">{t('Coupon')} {quote.coupon_code}</Typography>
                                            <Typography variant="body2" color="success.main">
                                                -{formatMoney(quote.coupon_discount)}
                                            </Typography>
                                        </Stack>
                                    )}
                                    {quote?.points_value > 0 && (
                            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: '16px' }}>
                                            <Typography variant="body2">{t('Points')} ({quote.redeemed_points})</Typography>
                                            <Typography variant="body2" color="success.main">
                                                -{formatMoney(quote.points_value)}
                                            </Typography>
                                        </Stack>
                                    )}
                                </>
                            )}
                            <Divider />
                            {selectedPaymentMethod && (
                                <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', gap: '16px' }}>
                                    <Typography variant="body2">{t('Payment account')}</Typography>
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                            {selectedPaymentMethod.banking_service}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {selectedPaymentMethod.account_name} - {selectedPaymentMethod.account_no}
                                        </Typography>
                                    </Box>
                                </Stack>
                            )}
                            <Divider />
                            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: '16px' }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                    {t('Total to pay')}
                                </Typography>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                    {formatMoney(total)}
                                </Typography>
                            </Stack>
                            {proofPreview && (
                                <Typography variant="caption" color="success.main" sx={{ fontWeight: 700 }}>
                                    {t('Payment screenshot attached')}
                                </Typography>
                            )}
                        </Stack>
                    )}

                    <Typography variant="subtitle1" sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'space-between', mt: '16px', fontWeight: 700 }}>
                        <span>{t('Total')}</span><span>{formatMoney(total)}</span>
                    </Typography>
                    <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1.5}  sx={{ justifyContent: "space-between", ...({ mt: '20px', pt: 2, borderTop: '1px solid', borderColor: 'divider' }) }}>
                        <Button
                            disabled={activeStep === 0}
                            onClick={() => setActiveStep((s) => s - 1)}
                            variant="outlined"
                            fullWidth
                            sx={{ maxWidth: { sm: 160 } }}
                        >
                            {t('Back')}
                        </Button>
                        {activeStep < steps.length - 1 ? (
                            <Button
                                variant="contained"
                                disabled={!canNext()}
                                onClick={() => setActiveStep((s) => s + 1)}
                                fullWidth
                                sx={{ maxWidth: { sm: 200 }, fontWeight: 700 }}
                            >
                                {t('Continue')}
                            </Button>
                        ) : (
                            <Button
                                variant="contained"
                                onClick={handlePlaceOrder}
                                disabled={processing || quoteLoading || !!quoteError || !quote || items.length === 0 || !data.payment_method_id || !data.payment_proof}
                                fullWidth
                                sx={{ maxWidth: { sm: 240 }, fontWeight: 700 }}
                            >
                                {t(processing ? 'Submitting...' : 'Submit order')}
                            </Button>
                        )}
                    </Stack>
                </Paper>
                <Paper elevation={0} sx={{ ...sectionShellSx, p: '20px', position: { md: 'sticky' }, top: { md: 88 }, borderRadius: 2.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: '16px' }}>{t('Order summary')}</Typography>
                    <Stack spacing="10px">
                        {items.map((line) => <Stack key={line.unitId} direction="row"  spacing="12px" sx={{ justifyContent: "space-between", ...({}) }}><Typography variant="body2" sx={{ minWidth: 0 }}>{line.name} × {line.qty}</Typography><Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatMoney(line.price * line.qty)}</Typography></Stack>)}
                        <Divider />
                        <Stack direction="row" sx={{ justifyContent: 'space-between', gap: '12px' }}><Typography variant="body2">{t('Subtotal')}</Typography><Typography variant="body2">{formatMoney(quote?.regular_subtotal ?? subtotal)}</Typography></Stack>
                        {Number(quote?.flash_discount || 0) > 0 && <Stack direction="row" sx={{ justifyContent: 'space-between', gap: '12px' }}><Typography variant="body2" color="primary">{t('Flash sale discount')}</Typography><Typography variant="body2" color="primary">-{formatMoney(quote.flash_discount)}</Typography></Stack>}
                        {Number(quote?.coupon_discount || 0) > 0 && <Stack direction="row" sx={{ justifyContent: 'space-between', gap: '12px' }}><Typography variant="body2">{t('Coupon')}</Typography><Typography variant="body2">-{formatMoney(quote.coupon_discount)}</Typography></Stack>}
                        {Number(quote?.points_value || 0) > 0 && <Stack direction="row" sx={{ justifyContent: 'space-between', gap: '12px' }}><Typography variant="body2">{t('Points')}</Typography><Typography variant="body2">-{formatMoney(quote.points_value)}</Typography></Stack>}
                        <Stack direction="row" sx={{ justifyContent: 'space-between', gap: '12px' }}><Typography variant="body2">{t('Shipping')}</Typography><Typography variant="body2">{Number(quote?.shipping ?? shipping) === 0 ? t('Free') : formatMoney(quote?.shipping ?? shipping)}</Typography></Stack>
                        <Stack direction="row"  sx={{ justifyContent: "space-between", ...({}) }}><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t('Total')}</Typography><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatMoney(total)}</Typography></Stack>
                    </Stack>
                </Paper>
                </Box>
            </Container>

            <Footer />
            <MobileBottomNavSpacer />
            <MobileBottomNav />
        </Box>
    );
}
