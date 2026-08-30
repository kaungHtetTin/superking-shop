import React, { useState } from 'react';
import { Link, usePage } from '@/spa/router';
import {
    Alert,
    Box,
    Button,
    Chip,
    Container,
    Dialog,
    DialogContent,
    Divider,
    IconButton,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import BackLink from '@/Components/User/BackLink';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { routeWithBase, storageUrl } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';
import { storefrontBackgroundSx } from '@/Components/User/musicStoreDesign';

const statusColor = {
    pending: 'warning',
    processing: 'info',
    shipped: 'primary',
    delivered: 'success',
    cancelled: 'default',
};

const orderStatusLabels = {
    pending: 'Pending',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
};

const paymentStatusColor = {
    pending_review: 'warning',
    paid: 'success',
    rejected: 'error',
};

export default function OrdersShow({ order, paymentStatusLabels = {} }) {
    const theme = useTheme();
    const { app_base, app_url, flash } = usePage().props;
    const t = usePhraseTranslation();
    const [proofLightbox, setProofLightbox] = useState(false);

    const paymentLabel = paymentStatusLabels[order.payment_status] || order.payment_status;
    const proofUrl = order.payment_proof_url || storageUrl(order.payment_proof_path, app_url);

    return (
        <Box className="user-storefront" sx={{ ...storefrontBackgroundSx(theme), minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <UserBrandHead title={`Order ${order.order_number}`} />
            <Navbar />

            <Container maxWidth="lg" sx={{ mt: { xs: '16px', md: '24px' }, pb: { xs: '24px', md: '32px' } }}>
                <BackLink href={routeWithBase('/orders', app_base)}>
                    {t('All orders')}
                </BackLink>
                <Stack direction="row" spacing="10px" flexWrap="wrap" sx={{ mb: '20px' }}>
                    <Button component={Link} href={routeWithBase('/products', app_base)} variant="outlined">{t('Continue shopping')}</Button>
                    <Button component={Link} href={routeWithBase('/chat', app_base)} variant="outlined">{t('Contact support')}</Button>
                </Stack>

                {flash?.success && (
                    <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                        {flash.success}
                    </Alert>
                )}

                {order.payment_status === 'rejected' && (
                    <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                            Payment not accepted
                        </Typography>
                        <Typography variant="body2">
                            {order.payment_rejection_reason ||
                                'Your payment could not be verified. Please place a new order with a valid transfer screenshot.'}
                        </Typography>
                    </Alert>
                )}

                {order.payment_status === 'pending_review' && (
                    <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                        Your payment screenshot is being reviewed. We will update this order once an admin confirms your transfer.
                    </Alert>
                )}

                <Paper elevation={0} sx={{ p: { xs: '16px', sm: '20px' }, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: '16px' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ sm: 'flex-start' }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                {order.order_number}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Placed {order.created_at}
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                            <Chip
                                size="small"
                                label={`Order: ${orderStatusLabels[order.status] || order.status}`}
                                color={statusColor[order.status] || 'default'}
                                variant="outlined"
                            />
                            <Chip
                                size="small"
                                label={`${t('Payment')}: ${t(paymentLabel)}`}
                                color={paymentStatusColor[order.payment_status] || 'default'}
                                variant="outlined"
                            />
                        </Stack>
                    </Stack>

                    <Divider sx={{ my: 2 }} />

                    <Stack direction="row" alignItems="flex-start" sx={{ mb: '20px', overflowX: 'auto', pb: '4px' }}>
                        {['Placed', 'Processing', 'Shipped', 'Delivered'].map((label, index) => {
                            const current = Math.max(0, ['pending', 'processing', 'shipped', 'delivered'].indexOf(order.status));
                            const active = order.status !== 'cancelled' && index <= current;
                            return <Box key={label} sx={{ flex: 1, minWidth: 88, position: 'relative', textAlign: 'center', '&:not(:last-child)::after': { content: '\"\"', position: 'absolute', top: 9, left: '58%', right: '-42%', height: 2, bgcolor: active && index < current ? 'primary.main' : 'divider' } }}>
                                <Box sx={{ width: 20, height: 20, borderRadius: '50%', mx: 'auto', mb: '6px', bgcolor: active ? 'primary.main' : 'grey.300', border: '4px solid white', boxShadow: '0 0 0 1px rgba(0,0,0,.1)', position: 'relative', zIndex: 1 }} />
                                <Typography variant="caption" sx={{ fontWeight: active ? 800 : 600, color: active ? 'text.primary' : 'text.secondary' }}>{t(label)}</Typography>
                            </Box>;
                        })}
                    </Stack>

                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                        Ship to
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                        {order.receiver_name} · {order.receiver_phone}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                        {order.shipping_address}
                    </Typography>

                    {order.order_notes && (
                        <>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2, mb: 0.5 }}>
                                Notes
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                {order.order_notes}
                            </Typography>
                        </>
                    )}
                </Paper>

                <Paper elevation={0} sx={{ p: { xs: '16px', sm: '20px' }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                        Items
                    </Typography>
                    <Stack spacing={2}>
                        {order.items.map((item) => (
                            <Stack key={item.id} direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                                <Box component="img" src={item.product?.primary_image?.image_url || (item.product?.primary_image?.image_path ? storageUrl(item.product.primary_image.image_path, app_url) : routeWithBase('/images/product-placeholder.svg', app_base))} alt="" sx={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 1.5, bgcolor: 'grey.100', flexShrink: 0 }} />
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                        {item.product?.name}
                                    </Typography>
                                    <Typography variant="caption" color="primary.main" sx={{ display: 'block', fontWeight: 700 }}>
                                        {t('Selling unit')}: {item.unit_name || item.unit?.name || t('unit')}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {t('Qty')} {item.quantity} · {formatMoney(item.unit_price)} {t('each')}
                                    </Typography>
                                    {Number(item.foc_quantity || 0) > 0 && (
                                        <Typography variant="caption" color="info.main" sx={{ display: 'block', fontWeight: 700 }}>
                                            {t('FOC')}: {item.foc_quantity} {item.foc_unit?.name || t('unit')}
                                        </Typography>
                                    )}
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    {formatMoney(item.total_price)}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                    <Divider sx={{ my: 2 }} />
                    <Stack spacing={0.75}>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">{t('Subtotal')}</Typography>
                            <Typography variant="body2">{formatMoney(order.total_amount)}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">{t('Shipping')}</Typography>
                            <Typography variant="body2">{formatMoney(order.shipping_fee)}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" sx={{ pt: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                Total
                            </Typography>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                {formatMoney(order.final_amount)}
                            </Typography>
                        </Stack>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                        {t('Payment')}: {t('Manual transfer')}{proofUrl ? ` ${t('(screenshot submitted)')}` : ''}
                    </Typography>

                    {proofUrl && (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                {t('Payment screenshot')}
                            </Typography>
                            <Box
                                component="button"
                                type="button"
                                onClick={() => setProofLightbox(true)}
                                aria-label={t('View payment screenshot')}
                                sx={{
                                    display: 'block',
                                    p: 0,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 1.5,
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    bgcolor: 'transparent',
                                    width: { xs: 96, sm: 120 },
                                    '&:hover': { opacity: 0.85 },
                                }}
                            >
                                <Box
                                    component="img"
                                    src={proofUrl}
                                    alt={t('Payment screenshot')}
                                    sx={{
                                        width: '100%',
                                        height: { xs: 72, sm: 80 },
                                        objectFit: 'cover',
                                        display: 'block',
                                    }}
                                />
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                {t('Tap to view full size')}
                            </Typography>
                        </Box>
                    )}
                </Paper>
            </Container>

            <Dialog open={proofLightbox} onClose={() => setProofLightbox(false)} maxWidth="lg" fullWidth>
                <DialogContent sx={{ p: 1, bgcolor: 'rgba(0,0,0,0.92)', position: 'relative' }}>
                    <IconButton
                        onClick={() => setProofLightbox(false)}
                        aria-label={t('Close')}
                        sx={{ position: 'absolute', right: 8, top: 8, color: 'white', zIndex: 1 }}
                    >
                        <Close />
                    </IconButton>
                    {proofUrl ? (
                        <Box
                            component="img"
                            src={proofUrl}
                            alt={t('Payment screenshot')}
                            sx={{ width: '100%', height: 'auto', display: 'block', borderRadius: 1 }}
                        />
                    ) : null}
                </DialogContent>
            </Dialog>

            <Footer />
            <MobileBottomNavSpacer />
            <MobileBottomNav />
        </Box>
    );
}
