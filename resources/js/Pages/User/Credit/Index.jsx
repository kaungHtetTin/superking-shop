import React from 'react';
import { Link, router, usePage } from '@/spa/router';
import {
    Alert,
    Box,
    Button,
    Chip,
    Container,
    Divider,
    LinearProgress,
    Pagination,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import {
    AccountBalanceWalletOutlined,
    CreditScoreOutlined,
    EventOutlined,
    HistoryOutlined,
    ReceiptLongOutlined,
    WarningAmberOutlined,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import BackLink from '@/Components/User/BackLink';
import Footer from '@/Components/User/Footer';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Navbar from '@/Components/User/Navbar';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { storefrontBackgroundSx } from '@/Components/User/musicStoreDesign';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';
import { routeWithBase } from '@/Utils/url';

const typeLabels = {
    sale: 'Credit purchase',
    payment: 'Payment received',
    reversal: 'Reversal',
    refund: 'Refund',
    adjustment: 'Adjustment',
};

const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const summaryCards = (summary, t) => [
    { label: t('Outstanding balance'), value: formatMoney(summary.balance), Icon: AccountBalanceWalletOutlined, color: 'primary.main' },
    { label: t('Credit limit'), value: formatMoney(summary.limit), Icon: CreditScoreOutlined, color: 'primary.main' },
    { label: t('Available credit'), value: formatMoney(summary.available), Icon: CreditScoreOutlined, color: 'success.main' },
    { label: t('Overdue amount'), value: formatMoney(summary.overdue), Icon: WarningAmberOutlined, color: Number(summary.overdue) > 0 ? 'error.main' : 'text.secondary' },
];

export default function CreditIndex({ creditSummary = {}, creditOrders = {}, creditTransactions = {}, filters = {} }) {
    const theme = useTheme();
    const t = usePhraseTranslation();
    const { app_base } = usePage().props;
    const usedPercent = Number(creditSummary.limit) > 0
        ? Math.max(0, Math.min(100, (Number(creditSummary.balance) / Number(creditSummary.limit)) * 100))
        : 0;

    const navigate = (changes = {}) => {
        const params = { invoice: filters.invoice || 'all', invoice_page: creditOrders.current_page || 1, history_page: creditTransactions.current_page || 1, ...changes };
        if (params.invoice === 'all') delete params.invoice;
        router.get(routeWithBase('/my-credit', app_base), params, { preserveScroll: false, preserveState: true });
    };

    return (
        <Box className="user-storefront storefront-purchase" sx={{ ...storefrontBackgroundSx(theme), minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <UserBrandHead title="My credit" />
            <Navbar />

            <Container maxWidth="lg" sx={{ mt: { xs: '20px', md: '28px' }, pb: '40px', flex: 1 }}>
                <BackLink href={routeWithBase('/profile', app_base)}>{t('Back to profile')}</BackLink>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: '16px', mb: '24px', gap: '16px', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' } }}>
                    <Box>
                        <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>{t('My credit')}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('View your store credit balance, due dates and payment history.')}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}><Chip
                        label={t(creditSummary.status === 'active' ? 'Credit active' : creditSummary.status === 'suspended' ? 'Credit suspended' : 'Credit not enabled')}
                        color={creditSummary.status === 'active' ? 'success' : creditSummary.status === 'suspended' ? 'warning' : 'default'}
                        variant="outlined"
                    />
                    <Button component="a" href={routeWithBase('/my-credit/statement', app_base)} variant="outlined">{t('Download statement PDF')}</Button>
                    </Box>
                </Stack>

                {Number(creditSummary.overdue) > 0 && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {t('You have overdue credit. Please contact the store to arrange payment.')}
                    </Alert>
                )}

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: '16px', mb: '24px' }}>
                    {summaryCards(creditSummary, t).map(({ label, value, Icon, color }) => (
                            <Paper key={label} elevation={0} sx={{ p: '20px', minWidth: 0, border: '1px solid', borderColor: 'divider' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', mb: '12px' }}>
                                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                                    <Box sx={{ display: 'grid', placeItems: 'center', width: 40, height: 40, flexShrink: 0, borderRadius: '8px', bgcolor: alpha(theme.palette.primary.main, 0.07) }}><Icon sx={{ color }} /></Box>
                                </Box>
                                <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', overflowWrap: 'anywhere' }}>{value}</Typography>
                            </Paper>
                    ))}
                </Box>

                <Paper elevation={0} sx={{ p: '24px', mb: '24px', border: '1px solid', borderColor: 'divider' }}>
                    <Stack direction="row" sx={{ mb: '12px', justifyContent: 'space-between', gap: '16px' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{t('Credit used')}</Typography>
                        <Typography variant="body2" color="text.secondary">{Math.round(usedPercent)}%</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={usedPercent} color={usedPercent >= 90 ? 'error' : 'primary'} sx={{ height: 8, borderRadius: 4, bgcolor: 'grey.100' }} />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        {t('Standard due period')}: {creditSummary.terms_days || 0} {t('days')}
                    </Typography>
                </Paper>

                <Paper elevation={0} sx={{ p: { xs: '20px', sm: '24px' }, mb: '24px', border: '1px solid', borderColor: 'divider' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: '20px', justifyContent: 'space-between', gap: '16px', alignItems: { sm: 'center' } }}>
                        <Stack direction="row" spacing={1}  sx={{ alignItems: "center", ...({}) }}><ReceiptLongOutlined color="primary" /><Box><Typography variant="h6" sx={{ fontWeight: 800 }}>{t('Outstanding invoices')}</Typography><Typography variant="caption" color="text.secondary">{creditOrders.total || 0} {t('open invoices')}</Typography></Box></Stack>
                        <Stack direction="row" spacing={0.75}>
                            <Button size="small" variant={(filters.invoice || 'all') === 'all' ? 'contained' : 'outlined'} onClick={() => navigate({ invoice: 'all', invoice_page: 1 })}>{t('All')}</Button>
                            <Button size="small" variant={filters.invoice === 'overdue' ? 'contained' : 'outlined'} onClick={() => navigate({ invoice: 'overdue', invoice_page: 1 })}>{t('Overdue')}</Button>
                        </Stack>
                    </Stack>
                    {(creditOrders.data || []).length === 0 ? (
                        <Box sx={{ py: '32px', textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}><ReceiptLongOutlined sx={{ fontSize: 36, color: 'primary.main', mb: '12px' }} /><Typography color="text.secondary">{t('You have no outstanding credit invoices.')}</Typography></Box>
                    ) : (
                        <Stack spacing={1.25}>
                            {creditOrders.data.map((order) => (
                                <Box key={order.id} sx={{ p: 1.5, border: '1px solid', borderColor: order.is_overdue ? 'error.light' : 'divider', borderRadius: 2, bgcolor: order.is_overdue ? 'rgba(211,47,47,.025)' : 'background.paper', transition: 'border-color .18s, transform .18s', '&:hover': { borderColor: order.is_overdue ? 'error.main' : 'primary.light', transform: 'translateY(-1px)' } }}>
                                    <Stack direction={{ xs: 'column', sm: 'row' }}  spacing={1} sx={{ justifyContent: "space-between", ...({}) }}>
                                        <Box>
                                            <Typography sx={{ fontWeight: 800 }}>{order.receipt_number || order.order_number}</Typography>
                                            <Stack direction="row" spacing={0.75}   sx={{ alignItems: "center", flexWrap: "wrap", ...({}) }}>
                                                <EventOutlined sx={{ fontSize: 16, color: 'text.secondary' }} />
                                                <Typography variant="caption" color={order.is_overdue ? 'error.main' : 'text.secondary'}>
                                                    {t('Due date')}: {formatDate(order.due_date)}
                                                </Typography>
                                                {order.is_overdue && <Chip size="small" color="error" label={t('Overdue')} />}
                                            </Stack>
                                        </Box>
                                        <Box sx={{ textAlign: { sm: 'right' } }}>
                                            <Typography variant="caption" color="text.secondary">{t('Balance due')}</Typography>
                                            <Typography sx={{ fontWeight: 800, color: order.is_overdue ? 'error.main' : 'text.primary' }}>{formatMoney(order.outstanding)}</Typography>
                                        </Box>
                                    </Stack>
                                    <Divider sx={{ my: 1 }} />
                                    <Stack direction="row"   sx={{ justifyContent: "space-between", alignItems: "center", ...({}) }}>
                                        <Typography variant="caption" color="text.secondary">
                                            {t('Paid')} {formatMoney(order.paid_amount)} / {formatMoney(order.final_amount)}
                                        </Typography>
                                        <Button size="small" component={Link} href={routeWithBase(`/orders/${order.id}`, app_base)}>
                                            {t('View receipt')}
                                        </Button>
                                    </Stack>
                                </Box>
                            ))}
                        </Stack>
                    )}
                    {creditOrders.last_page > 1 && <Stack  sx={{ alignItems: "center", ...({ mt: 2 }) }}><Pagination count={creditOrders.last_page} page={creditOrders.current_page} onChange={(_e, page) => navigate({ invoice_page: page })} color="primary" size="small" /></Stack>}
                </Paper>

                <Paper elevation={0} sx={{ p: { xs: '20px', sm: '24px' }, border: '1px solid', borderColor: 'divider' }}>
                    <Stack direction="row" spacing={1}  sx={{ alignItems: "center", ...({ mb: 1.5 }) }}>
                        <HistoryOutlined color="primary" />
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>{t('Credit history')}</Typography>
                    </Stack>
                    {(creditTransactions.data || []).length === 0 ? (
                        <Box sx={{ py: '32px', textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}><HistoryOutlined sx={{ fontSize: 36, color: 'primary.main', mb: '12px' }} /><Typography color="text.secondary">{t('No credit transactions yet.')}</Typography></Box>
                    ) : (
                        <Stack divider={<Divider flexItem />}>
                            {creditTransactions.data.map((transaction) => (
                                <Stack key={transaction.id} direction={{ xs: 'column', sm: 'row' }}  spacing={1} sx={{ justifyContent: "space-between", ...({ py: 1.25 }) }}>
                                    <Box>
                                        <Typography sx={{ fontWeight: 700 }}>{t(typeLabels[transaction.type] || transaction.type)}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {formatDate(transaction.created_at)} · {transaction.reference || transaction.transaction_number}
                                        </Typography>
                                        {transaction.order && (
                                            <Button size="small" component={Link} href={routeWithBase(`/orders/${transaction.order.id}`, app_base)} sx={{ ml: 1 }}>
                                                {transaction.order.order_number}
                                            </Button>
                                        )}
                                    </Box>
                                    <Box sx={{ textAlign: { sm: 'right' } }}>
                                        <Typography sx={{ fontWeight: 800, color: Number(transaction.amount) > 0 ? 'warning.main' : 'success.main' }}>
                                            {Number(transaction.amount) > 0 ? '+' : '-'}{formatMoney(Math.abs(Number(transaction.amount)))}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {t('Balance')}: {formatMoney(transaction.balance_after)}
                                        </Typography>
                                    </Box>
                                </Stack>
                            ))}
                        </Stack>
                    )}

                    {creditTransactions.last_page > 1 && (
                        <Stack  sx={{ alignItems: "center", ...({ mt: 2 }) }}>
                            <Pagination count={creditTransactions.last_page} page={creditTransactions.current_page} onChange={(_e, page) => navigate({ history_page: page })} color="primary" />
                        </Stack>
                    )}
                </Paper>

                <Alert severity="info" sx={{ mt: '24px', bgcolor: alpha(theme.palette.primary.main, 0.06), color: 'text.secondary', '& .MuiAlert-icon': { color: 'primary.main' } }}>
                    {t('Credit purchases and repayments are handled by store staff. Contact the store if any record is incorrect.')}
                </Alert>
            </Container>

            <Footer />
            <MobileBottomNavSpacer />
            <MobileBottomNav />
        </Box>
    );
}
