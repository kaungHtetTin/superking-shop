import React, { useEffect, useState } from 'react';
import { Link, router, usePage } from '@/spa/router';
import { Box, Button, Chip, Container, Grid, InputAdornment, MenuItem, Pagination, Paper, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { AccessTimeRounded, CheckCircleOutlineRounded, CreditScoreOutlined, Inventory2Outlined, ReceiptLongRounded, SearchRounded } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import BackLink from '@/Components/User/BackLink';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { storefrontBackgroundSx } from '@/Components/User/musicStoreDesign';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

const statusColor = { pending: 'warning', processing: 'info', shipped: 'primary', delivered: 'success', cancelled: 'default' };
const paymentStatusColor = { unpaid: 'error', partially_paid: 'warning', pending_review: 'warning', paid: 'success', rejected: 'error' };
const paymentLabels = { unpaid: 'Unpaid', partially_paid: 'Partially paid', pending_review: 'Awaiting verification', paid: 'Paid', rejected: 'Rejected' };

export default function OrdersIndex({ orders, filters = {}, orderStats = {} }) {
    const theme = useTheme();
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const [search, setSearch] = useState(filters.search || '');
    const [loading, setLoading] = useState(false);
    useEffect(() => setSearch(filters.search || ''), [filters.search]);

    const navigate = (changes = {}) => {
        const params = { search: filters.search || '', status: filters.status || 'all', payment: filters.payment || 'all', ...changes };
        Object.keys(params).forEach((key) => (!params[key] || params[key] === 'all') && delete params[key]);
        router.get(routeWithBase('/orders', app_base), params, { preserveScroll: false, preserveState: true, onStart: () => setLoading(true), onFinish: () => setLoading(false) });
    };
    const submitSearch = (event) => { event.preventDefault(); navigate({ search: search.trim(), page: 1 }); };
    const stats = [
        { label: t('All orders'), value: orderStats.all || 0, Icon: ReceiptLongRounded, color: 'primary.main' },
        { label: t('In progress'), value: orderStats.active || 0, Icon: AccessTimeRounded, color: 'info.main' },
        { label: t('Delivered'), value: orderStats.delivered || 0, Icon: CheckCircleOutlineRounded, color: 'success.main' },
        { label: t('Credit due'), value: orderStats.credit || 0, Icon: CreditScoreOutlined, color: 'warning.main' },
    ];

    return (
        <Box className="user-storefront" sx={{ ...storefrontBackgroundSx(theme), minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <UserBrandHead title="My orders" /><Navbar />
            <Container maxWidth="lg" sx={{ mt: { xs: 2, md: 3 }, pb: 4 }}>
                <BackLink href={routeWithBase('/products', app_base)}>{t('Back to shop')}</BackLink>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
                    <Box><Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>{t('My orders')}</Typography><Typography variant="body2" color="text.secondary">{t('Track purchases, payments and delivery in one place.')}</Typography></Box>
                    <Button component={Link} href={routeWithBase('/my-credit', app_base)} variant="outlined" startIcon={<CreditScoreOutlined />}>{t('My credit')}</Button>
                </Stack>
                <Grid container spacing={1.25} sx={{ mb: 2 }}>
                    {stats.map(({ label, value, Icon, color }) => <Grid item xs={6} md={3} key={label}><Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 2.5 }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h5" sx={{ fontWeight: 900 }}>{value}</Typography></Box><Box sx={{ width: 38, height: 38, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: alpha(theme.palette.primary.main, 0.07) }}><Icon sx={{ color }} /></Box></Stack></Paper></Grid>)}
                </Grid>
                <Paper component="form" onSubmit={submitSearch} elevation={0} sx={{ p: 1.5, mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2.5 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                        <TextField fullWidth size="small" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search order or receipt number')} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> }} />
                        <TextField select size="small" label={t('Order status')} value={filters.status || 'all'} onChange={(e) => navigate({ status: e.target.value, page: 1 })} sx={{ minWidth: { md: 170 } }}>{['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((value) => <MenuItem key={value} value={value}>{t(value === 'all' ? 'All statuses' : value)}</MenuItem>)}</TextField>
                        <TextField select size="small" label={t('Payment')} value={filters.payment || 'all'} onChange={(e) => navigate({ payment: e.target.value, page: 1 })} sx={{ minWidth: { md: 180 } }}>{['all', 'unpaid', 'partially_paid', 'pending_review', 'paid', 'rejected'].map((value) => <MenuItem key={value} value={value}>{t(value === 'all' ? 'All payments' : paymentLabels[value])}</MenuItem>)}</TextField>
                        <Button type="submit" variant="contained" sx={{ minWidth: 100 }}>{t('Search')}</Button>
                    </Stack>
                </Paper>
                {loading ? <Grid container spacing={1.5}>{Array.from({ length: 4 }).map((_, i) => <Grid item xs={12} md={6} key={i}><Skeleton variant="rounded" height={190} /></Grid>)}</Grid> : orders.data.length === 0 ? (
                    <Paper elevation={0} sx={{ p: { xs: 4, sm: 6 }, borderRadius: 2.5, border: '1px dashed', borderColor: 'divider', textAlign: 'center' }}><ReceiptLongRounded sx={{ fontSize: 52, color: 'primary.main', mb: 1 }} /><Typography variant="h6" sx={{ fontWeight: 800 }}>{t(filters.search || filters.status !== 'all' || filters.payment !== 'all' ? 'No matching orders' : 'No orders yet')}</Typography><Typography color="text.secondary" sx={{ mb: 2 }}>{t('Try changing the filters or continue shopping.')}</Typography><Button variant="contained" component={Link} href={routeWithBase('/products', app_base)}>{t('Start shopping')}</Button></Paper>
                ) : <Grid container spacing={1.5}>{orders.data.map((order) => {
                    const itemCount = order.items_count ?? (order.items || []).length;
                    const balance = Math.max(0, Number(order.final_amount) - Number(order.paid_amount || 0));
                    return <Grid item xs={12} md={6} key={order.id}><Paper component={Link} href={routeWithBase(`/orders/${order.id}`, app_base)} elevation={0} sx={{ p: 2, height: '100%', display: 'block', color: 'inherit', textDecoration: 'none', border: '1px solid', borderColor: 'divider', borderRadius: 2.5, transition: 'transform .18s, box-shadow .18s, border-color .18s', '&:hover': { transform: 'translateY(-2px)', borderColor: 'primary.light', boxShadow: `0 10px 28px ${alpha(theme.palette.primary.main, 0.10)}` } }}>
                        <Stack direction="row" justifyContent="space-between" spacing={1}><Box><Typography sx={{ fontWeight: 900 }}>{order.receipt_number || order.order_number}</Typography><Typography variant="caption" color="text.secondary">{order.created_at}</Typography></Box><Typography variant="h6" sx={{ fontWeight: 900 }}>{formatMoney(order.final_amount)}</Typography></Stack>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ my: 1.5 }}><Chip size="small" label={t(order.status)} color={statusColor[order.status] || 'default'} /><Chip size="small" label={t(paymentLabels[order.payment_status] || order.payment_status)} color={paymentStatusColor[order.payment_status] || 'default'} variant="outlined" />{balance > 0 && Number(order.credit_amount) > 0 && <Chip size="small" icon={<CreditScoreOutlined />} label={`${t('Due')} ${formatMoney(balance)}`} color="warning" variant="outlined" />}</Stack>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><Inventory2Outlined sx={{ fontSize: 17, color: 'text.secondary' }} /><Typography variant="body2" color="text.secondary">{itemCount} {t('items')}</Typography></Stack>
                        {(order.items || []).slice(0, 2).map((item) => <Typography key={item.id} variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{item.product?.name || t('Product')} · {item.quantity} {item.unit_name || item.unit?.name || t('unit')}</Typography>)}
                        {itemCount > 2 && <Typography variant="caption" color="primary.main">+{itemCount - 2} {t('more items')}</Typography>}<Typography variant="button" color="primary.main" sx={{ display: 'block', mt: 1.5, fontWeight: 800 }}>{t('View details')} →</Typography>
                    </Paper></Grid>;
                })}</Grid>}
                {orders.last_page > 1 && <Stack spacing={1} alignItems="center" sx={{ mt: 3 }}><Pagination count={orders.last_page} page={orders.current_page} onChange={(_e, page) => navigate({ page })} color="primary" /><Typography variant="caption">{t('Showing')} {orders.from}–{orders.to} {t('of')} {orders.total}</Typography></Stack>}
            </Container>
            <Footer /><MobileBottomNavSpacer /><MobileBottomNav />
        </Box>
    );
}
