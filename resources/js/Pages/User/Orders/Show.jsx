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
import { Close, CreditScoreOutlined, EventOutlined } from '@mui/icons-material';
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
    unpaid: 'error',
    partially_paid: 'warning',
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
    const creditBalance = Math.max(0, Number(order.final_amount) - Number(order.paid_amount || 0));
    const placedDate = new Date(order.created_at);
    const placedLabel = Number.isNaN(placedDate.getTime()) ? '—' : placedDate.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const panelSx = { p: { xs: '16px', sm: '24px' }, borderRadius: '10px', border: '1px solid', borderColor: 'divider', minWidth: 0 };
    const amountRowSx = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '16px', alignItems: 'baseline', '& > :last-child': { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } };

    return (
        <Box className="user-storefront storefront-purchase" sx={{ ...storefrontBackgroundSx(theme), minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <UserBrandHead title={`Order ${order.order_number}`} />
            <Navbar />

            <Container maxWidth="lg" sx={{ mt: { xs: '16px', md: '24px' }, pb: { xs: '24px', md: '32px' } }}>
                <BackLink href={routeWithBase('/orders', app_base)}>
                    {t('All orders')}
                </BackLink>
                <Stack direction="row" useFlexGap spacing="10px" sx={{ mb: '20px', flexWrap: 'wrap' }}>
                    <Button component={Link} href={routeWithBase('/products', app_base)} variant="outlined">{t('Continue shopping')}</Button>
                    <Button component={Link} href={routeWithBase('/chat', app_base)} variant="outlined">{t('Contact support')}</Button>
                </Stack>

                {flash?.success && (
                    <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                        {t(flash.success)}
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

                <Paper elevation={0} sx={{ ...panelSx, mb: '20px' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing="16px" sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                {order.order_number}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {t('Placed')} · {placedLabel}
                            </Typography>
                        </Box>
                        <Stack direction="row" useFlexGap spacing="8px" sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                            <Chip
                                size="small"
                                label={`${t('Order')}: ${t(orderStatusLabels[order.status] || order.status)}`}
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

                    <Stack direction="row" sx={{ mb: '24px', mt: '20px', alignItems: 'flex-start', overflowX: 'auto', pb: '4px' }}>
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
                        {t('Ship to')}
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
                                {t('Notes')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                {order.order_notes}
                            </Typography>
                        </>
                    )}
                </Paper>

                {Number(order.credit_amount) > 0 && (
                    <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2.5, border: '1px solid', borderColor: creditBalance > 0 ? 'warning.light' : 'success.light', mb: 2, bgcolor: creditBalance > 0 ? 'rgba(237,108,2,.035)' : 'rgba(46,125,50,.035)' }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }}  spacing={2} sx={{ justifyContent: "space-between", ...({}) }}>
                            <Stack direction="row" spacing={1.25}>
                                <Box sx={{ width: 42, height: 42, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: creditBalance > 0 ? 'warning.light' : 'success.light', color: creditBalance > 0 ? 'warning.dark' : 'success.dark' }}><CreditScoreOutlined /></Box>
                                <Box><Typography sx={{ fontWeight: 800 }}>{t('Credit payment')}</Typography><Typography variant="body2" color="text.secondary">{t('Paid')} {formatMoney(order.paid_amount || 0)} · {t('Total')} {formatMoney(order.final_amount)}</Typography></Box>
                            </Stack>
                            <Box sx={{ textAlign: { sm: 'right' } }}><Typography variant="caption" color="text.secondary">{t('Balance due')}</Typography><Typography variant="h6" sx={{ fontWeight: 900, color: creditBalance > 0 ? 'warning.dark' : 'success.main' }}>{formatMoney(creditBalance)}</Typography></Box>
                        </Stack>
                        {creditBalance > 0 && <Stack direction="row" spacing={0.75}  sx={{ alignItems: "center", ...({ mt: 1.5 }) }}><EventOutlined sx={{ fontSize: 18, color: 'warning.dark' }} /><Typography variant="body2" sx={{ fontWeight: 700 }}>{t('Due date')}: {order.credit_due_date || '-'}</Typography></Stack>}
                        <Button component={Link} href={routeWithBase('/my-credit', app_base)} size="small" sx={{ mt: 1 }}>{t('View my credit history')} →</Button>
                    </Paper>
                )}

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 340px' }, gap: '20px', alignItems: 'start' }}>
                <Paper elevation={0} sx={panelSx}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                        {t('Items')}
                    </Typography>
                    <Stack spacing={2}>
                        {order.items.map((item) => (
                            <Box key={item.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '56px minmax(0, 1fr)', sm: '64px minmax(0, 1fr) auto' }, gap: '12px', alignItems: 'start', pb: '16px', borderBottom: '1px solid', borderColor: 'divider' }}>
                                <Box component="img" src={item.product?.primary_image?.image_url || (item.product?.primary_image?.image_path ? storageUrl(item.product.primary_image.image_path, app_url) : routeWithBase('/images/product-default.png', app_base))} alt="" sx={{ width: { xs: 56, sm: 64 }, height: { xs: 56, sm: 64 }, objectFit: 'contain', borderRadius: '8px', bgcolor: 'grey.100' }} />
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                        {item.product?.name}
                                    </Typography>
                                    <Typography variant="caption" color="primary.main" sx={{ display: 'block', fontWeight: 700 }}>
                                        {t('Selling unit')}: {item.unit_name || item.unit?.name || t('unit')}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {t('Qty')} {Number(item.quantity)} · {formatMoney(item.unit_price)} {t('each')}
                                    </Typography>
                                    {item.promotion_snapshot?.flash_sale_id && <Typography variant="caption" color="primary" sx={{ display: 'block', mt: '4px', fontWeight: 700 }}>{t('Flash Sale')}</Typography>}
                                    {Number(item.foc_quantity || 0) > 0 && (
                                        <Typography variant="caption" color="info.main" sx={{ display: 'block', fontWeight: 700 }}>
                                            {t('FOC')}: {item.foc_quantity} {item.foc_unit?.name || t('unit')}
                                        </Typography>
                                    )}
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 800, textAlign: 'right', gridColumn: { xs: 2, sm: 'auto' }, whiteSpace: 'nowrap' }}>
                                    {formatMoney(item.total_price)}
                                </Typography>
                            </Box>
                        ))}
                    </Stack>
                </Paper>
                <Paper elevation={0} sx={{ ...panelSx, position: { md: 'sticky' }, top: 88 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: '20px' }}>{t('Order summary')}</Typography>
                    <Stack spacing={0.75}>
                        <Box sx={amountRowSx}>
                            <Typography variant="body2">{t('Subtotal')}</Typography>
                            <Typography variant="body2">{formatMoney(order.total_amount)}</Typography>
                        </Box>
                        {Number(order.discount_amount || 0) > 0 && <Box sx={amountRowSx}><Typography variant="body2">{t('Discount')}</Typography><Typography variant="body2" color="primary">-{formatMoney(order.discount_amount)}</Typography></Box>}
                        <Box sx={amountRowSx}>
                            <Typography variant="body2">{t('Shipping')}</Typography>
                            <Typography variant="body2">{formatMoney(order.shipping_fee)}</Typography>
                        </Box>
                        <Divider sx={{ my: '12px' }} />
                        <Box sx={amountRowSx}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                {t('Total')}
                            </Typography>
                            <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 800 }}>
                                {formatMoney(order.final_amount)}
                            </Typography>
                        </Box>
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
                </Box>
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
