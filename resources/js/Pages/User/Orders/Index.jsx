import React, { useEffect, useState } from 'react';
import { Link, router, usePage } from '@/spa/router';
import { Box, Button, Chip, Container, InputAdornment, MenuItem, Pagination, Paper, Skeleton, Stack, TextField, Typography } from '@mui/material';
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
const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

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
        <Box className="user-storefront storefront-purchase" sx={{ ...storefrontBackgroundSx(theme), minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <UserBrandHead title="My orders" /><Navbar />
            <Container maxWidth="lg" sx={{ mt: { xs: '20px', md: '28px' }, pb: '40px', flex: 1 }}>
                <BackLink href={routeWithBase('/products', app_base)}>{t('Back to shop')}</BackLink>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: '24px', mt: '16px', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: '16px' }}>
                    <Box><Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>{t('My orders')}</Typography><Typography variant="body2" color="text.secondary">{t('Track purchases, payments and delivery in one place.')}</Typography></Box>
                    <Button component={Link} href={routeWithBase('/my-credit', app_base)} variant="outlined" startIcon={<CreditScoreOutlined />}>{t('My credit')}</Button>
                </Stack>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: '16px', mb: '24px' }}>
                    {stats.map(({ label, value, Icon }) => <Paper key={label} elevation={0} sx={{ p: '20px', border: '1px solid', borderColor: 'divider' }}><Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}><Box><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h5" sx={{ fontWeight: 800, mt: '4px' }}>{value}</Typography></Box><Box sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: alpha(theme.palette.primary.main, 0.07) }}><Icon sx={{ color: 'primary.main' }} /></Box></Box></Paper>)}
                </Box>
                <Paper component="form" onSubmit={submitSearch} elevation={0} sx={{ p: '20px', mb: '24px', border: '1px solid', borderColor: 'divider' }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                        <TextField fullWidth size="small" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search order or receipt number')} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} />
                        <TextField select size="small" label={t('Order status')} value={filters.status || 'all'} onChange={(e) => navigate({ status: e.target.value, page: 1 })} sx={{ minWidth: { md: 170 } }}>{['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((value) => <MenuItem key={value} value={value}>{t(value === 'all' ? 'All statuses' : value)}</MenuItem>)}</TextField>
                        <TextField select size="small" label={t('Payment')} value={filters.payment || 'all'} onChange={(e) => navigate({ payment: e.target.value, page: 1 })} sx={{ minWidth: { md: 180 } }}>{['all', 'unpaid', 'partially_paid', 'pending_review', 'paid', 'rejected'].map((value) => <MenuItem key={value} value={value}>{t(value === 'all' ? 'All payments' : paymentLabels[value])}</MenuItem>)}</TextField>
                        <Button type="submit" variant="contained" sx={{ minWidth: 100 }}>{t('Search')}</Button>
                    </Stack>
                </Paper>
                {loading ? <Box sx={{ display: 'grid', gap: '16px' }}>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rounded" height={190} />)}</Box> : orders.data.length === 0 ? (
                    <Paper elevation={0} sx={{ p: { xs: 4, sm: 6 }, borderRadius: 2.5, border: '1px dashed', borderColor: 'divider', textAlign: 'center' }}><ReceiptLongRounded sx={{ fontSize: 52, color: 'primary.main', mb: 1 }} /><Typography variant="h6" sx={{ fontWeight: 800 }}>{t(filters.search || filters.status !== 'all' || filters.payment !== 'all' ? 'No matching orders' : 'No orders yet')}</Typography><Typography color="text.secondary" sx={{ mb: 2 }}>{t('Try changing the filters or continue shopping.')}</Typography><Button variant="contained" component={Link} href={routeWithBase('/products', app_base)}>{t('Start shopping')}</Button></Paper>
                ) : <Box sx={{ display: 'grid', gap: '16px' }}>{orders.data.map((order) => {
                    const itemCount = order.items_count ?? (order.items || []).length;
                    const balance = Math.max(0, Number(order.final_amount) - Number(order.paid_amount || 0));
                    return <Paper key={order.id} component={Link} href={routeWithBase(`/orders/${order.id}`, app_base)} elevation={0} sx={{ p: { xs: '20px', md: '24px' }, minWidth: 0, display: 'block', color: 'inherit', textDecoration: 'none', border: '1px solid', borderColor: 'divider', transition: 'border-color .18s', '&:hover': { borderColor: 'primary.main' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '3px' } }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '12px' }}><Box><Typography sx={{ fontWeight: 800 }}>{order.receipt_number || order.order_number}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: '4px' }}>{formatDate(order.created_at)}</Typography></Box><Typography sx={{ fontWeight: 800, fontSize: '1.125rem', whiteSpace: 'nowrap' }}>{formatMoney(order.final_amount)}</Typography></Box>
                        <Stack direction="row" spacing={0.75}  useFlexGap sx={{ flexWrap: "wrap", ...({ my: 1.5 }) }}><Chip size="small" label={t(order.status)} color={statusColor[order.status] || 'default'} /><Chip size="small" label={t(paymentLabels[order.payment_status] || order.payment_status)} color={paymentStatusColor[order.payment_status] || 'default'} variant="outlined" />{balance > 0 && Number(order.credit_amount) > 0 && <Chip size="small" icon={<CreditScoreOutlined />} label={`${t('Due')} ${formatMoney(balance)}`} color="warning" variant="outlined" />}</Stack>
                        <Stack direction="row" spacing={1}  sx={{ alignItems: "center", ...({ mb: 1 }) }}><Inventory2Outlined sx={{ fontSize: 17, color: 'text.secondary' }} /><Typography variant="body2" color="text.secondary">{itemCount} {t('items')}</Typography></Stack>
                        {(order.items || []).slice(0, 2).map((item) => <Typography key={item.id} variant="body2" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere', mt: '4px' }}>{item.product?.name || t('Product')} · {Number(item.quantity)} {item.unit_name || item.unit?.name || t('unit')}</Typography>)}
                        {itemCount > 2 && <Typography variant="caption" color="primary.main">+{itemCount - 2} {t('more items')}</Typography>}<Typography variant="button" color="primary.main" sx={{ display: 'block', mt: 1.5, fontWeight: 800 }}>{t('View details')} →</Typography>
                    </Paper>;
                })}</Box>}
                {orders.last_page > 1 && <Stack spacing={1}  sx={{ alignItems: "center", ...({ mt: 3 }) }}><Pagination count={orders.last_page} page={orders.current_page} onChange={(_e, page) => navigate({ page })} color="primary" /><Typography variant="caption">{t('Showing')} {orders.from}–{orders.to} {t('of')} {orders.total}</Typography></Stack>}
            </Container>
            <Footer /><MobileBottomNavSpacer /><MobileBottomNav />
        </Box>
    );
}
