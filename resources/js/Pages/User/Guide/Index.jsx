import React, { useMemo, useState } from 'react';
import { Link, usePage } from '@/spa/router';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Container,
    InputAdornment,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import {
    AccountCircleOutlined,
    ChatBubbleOutlined,
    CheckCircleOutlineOutlined,
    ChevronRight,
    ExpandMore,
    HelpOutlineOutlined,
    LocalShippingOutlined,
    LockOutlined,
    ManageSearch,
    MusicNoteOutlined,
    PaymentsOutlined,
    ReceiptLongOutlined,
    Search,
    ShoppingCartOutlined,
    TuneOutlined,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import Navbar from '@/Components/User/Navbar';
import Footer from '@/Components/User/Footer';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import UserBrandHead from '@/Components/User/UserBrandHead';
import {
    eyebrowSxForTheme,
    getMusicStoreColors,
    musicGradientForTheme,
    sectionShellSxForTheme,
    storefrontBackgroundSx,
} from '@/Components/User/musicStoreDesign';
import { usePhraseTranslation } from '@/Utils/i18n';
import { routeWithBase } from '@/Utils/url';

const purchaseSteps = [
    ['01', 'Find the right product', 'Browse categories, search by name, and use filters or sorting to narrow the catalog.'],
    ['02', 'Choose the selling unit', 'Open the product page, review specifications, then choose the unit and quantity you want to buy.'],
    ['03', 'Review your cart', 'Confirm each option, quantity, current price, promotion, and subtotal before checkout.'],
    ['04', 'Pay and track', 'Enter delivery details, upload payment proof, place the order, and follow its status in My orders.'],
];

const faqs = [
    {
        question: 'Do I need an account to shop?',
        answer: 'You can browse products, build a wishlist, and prepare a cart without signing in. An account is required to check out, view orders, write reviews, and use support chat.',
    },
    {
        question: 'Why did my cart or wishlist disappear?',
        answer: 'Cart and wishlist data are saved in the current browser. Clearing browser data, using private mode, or moving to another browser or device can remove or hide those saved items.',
    },
    {
        question: 'How do I know which item is in stock?',
        answer: 'Stock is maintained in each product’s base unit and converted for selling units. Choose a unit on the product page and check its displayed availability before adding it.',
    },
    {
        question: 'What payment proof can I upload?',
        answer: 'Upload one clear JPG, PNG, or WebP screenshot up to 10 MB. It should show the completed transfer, amount, date or time, and transaction reference where available.',
    },
    {
        question: 'Why is my payment still awaiting verification?',
        answer: 'Manual transfers are reviewed by the shop team. Keep your order number and check My orders for the latest payment and fulfillment status.',
    },
    {
        question: 'What should I do if payment is rejected?',
        answer: 'Read the rejection reason on the order page and contact support if anything is unclear. The current flow asks you to place a new order with a valid transfer screenshot.',
    },
    {
        question: 'Can I change an order after placing it?',
        answer: 'Contact support as soon as possible and include the order number. Changes are not guaranteed once payment review or fulfillment has started.',
    },
    {
        question: 'How is shipping calculated?',
        answer: 'The checkout summary calculates the current shipping fee from your cart and store settings. A free-shipping threshold may remove the fee when your eligible subtotal is high enough.',
    },
];

function GuideTopic({ topic, t }) {
    const theme = useTheme();
    const colors = getMusicStoreColors(theme);
    const Icon = topic.icon;

    return (
        <Paper
            component="section"
            id={topic.id}
            elevation={0}
            sx={{
                ...sectionShellSxForTheme(theme),
                p: { xs: '16px', sm: '20px' },
                scrollMarginTop: '104px',
            }}
        >
            <Stack direction="row" spacing="12px" alignItems="flex-start">
                <Box
                    sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1.5,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: alpha(colors.rosin, 0.1),
                        color: colors.rosin,
                        flexShrink: 0,
                    }}
                >
                    <Icon sx={{ fontSize: 21 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.08rem' }, fontWeight: 700, color: colors.ink }}>
                        {t(topic.title)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: '2px', lineHeight: 1.6 }}>
                        {t(topic.summary)}
                    </Typography>
                </Box>
            </Stack>

            <Stack spacing="10px" sx={{ mt: '16px' }}>
                {topic.items.map((item) => (
                    <Stack key={item} direction="row" spacing="9px" alignItems="flex-start">
                        <CheckCircleOutlineOutlined sx={{ color: colors.rosin, fontSize: 17, mt: '2px', flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ lineHeight: 1.55 }}>
                            {t(item)}
                        </Typography>
                    </Stack>
                ))}
            </Stack>

            {topic.note && (
                <Alert
                    icon={false}
                    severity="info"
                    sx={{ mt: '16px', py: '6px', px: '12px', borderRadius: 1.5, '& .MuiAlert-message': { py: 0 } }}
                >
                    <Typography variant="caption" sx={{ lineHeight: 1.5 }}>
                        <strong>{t('Good to know:')}</strong> {t(topic.note)}
                    </Typography>
                </Alert>
            )}
        </Paper>
    );
}

export default function BuyingGuide() {
    const theme = useTheme();
    const colors = getMusicStoreColors(theme);
    const { app_base, auth, app_settings } = usePage().props;
    const t = usePhraseTranslation();
    const [query, setQuery] = useState('');
    const appName = app_settings?.app_name || 'Harmony House';
    const supportHref = routeWithBase(auth?.user ? '/chat' : '/login', app_base);

    const topics = useMemo(() => [
        {
            id: 'choose',
            title: 'Choose an instrument with confidence',
            summary: 'Start with how and where you will use it, then compare the details that affect comfort, sound, and compatibility.',
            icon: MusicNoteOutlined,
            keywords: 'browse category beginner practice stage studio specifications dimensions accessories compatibility reviews',
            items: [
                'Choose your main use first: learning, home practice, live performance, recording, teaching, or a gift.',
                'Use categories, catalog search, filters, and sorting to compare suitable products without opening every item.',
                'Read the description and specifications for dimensions, materials, connections, power needs, included accessories, and intended player level.',
                'For electronic gear, check that ports, voltage, cables, adapters, software, and other equipment are compatible before ordering.',
                'Use customer reviews as extra context, and ask support when a technical detail is missing or unclear.',
            ],
            note: 'A lower price does not always mean a better beginner choice. Comfort, correct size, durability, and available support matter too.',
        },
        {
            id: 'options',
            title: 'Variants, SKUs, stock, and pre-orders',
            summary: 'The exact selectable option controls its price, stock, and quantity—not only the product name.',
            icon: TuneOutlined,
            keywords: 'selling unit conversion stock quantity availability flash sale',
            items: [
                'On the product page, select the exact model, finish, size, color, bundle, or other option shown in the selector.',
                'Check the price and available stock beside that option. Different SKUs of the same product may have different prices or availability.',
                'Set a quantity within the available limit. If the item is marked Pre-order, its fulfillment timing can differ from in-stock items.',
                'Flash-sale prices apply only while the promotion is active and may apply to selected SKUs rather than every option.',
                'Review your selected option again in the add-to-cart dialog and cart before continuing.',
            ],
            note: 'If an option becomes unavailable before checkout, return to the product page and choose an available alternative.',
        },
        {
            id: 'cart',
            title: 'Wishlist and shopping cart',
            summary: 'Save products for later or prepare exact selling units and quantities for checkout.',
            icon: ShoppingCartOutlined,
            keywords: 'wishlist favorite cart remove quantity subtotal saved browser device local',
            items: [
                'Use the heart button to add or remove a product from your wishlist. Open the wishlist from the header or account menu.',
                'Use Add to cart, select the selling units you want, adjust quantities, and confirm the selection.',
                'In the cart, verify the product, selling unit, unit price, quantity, line total, and subtotal. You can change quantity or remove a line.',
                'Cart and wishlist are saved in this browser. Use the same browser and device, and avoid clearing site data before ordering.',
                'The final checkout quote rechecks current price, discounts, stock, coupon, points, and shipping.',
            ],
            note: 'Saving an item does not reserve stock. Availability is confirmed again when the order is placed.',
        },
        {
            id: 'checkout',
            title: 'Checkout, coupons, points, and payment',
            summary: 'Checkout has three clear stages: Shipping, Payment proof, and Review.',
            icon: PaymentsOutlined,
            keywords: 'checkout shipping payment proof transfer screenshot coupon loyalty points free delivery receiver phone address',
            items: [
                'Sign in, then enter the receiver name, reachable phone number, complete shipping address, and optional order notes.',
                'Apply a valid coupon code if you have one. If loyalty points are enabled, enter the points you want to redeem and review the discount.',
                'Select one of the payment accounts displayed by the store and transfer the exact final amount to that account.',
                'Upload one clear JPG, PNG, or WebP payment screenshot up to 10 MB. Make sure the amount and transaction details are readable.',
                'On Review, check every item and cost before placing the order. Do not close the page while the order is submitting.',
            ],
            note: 'A submitted transfer is not marked paid immediately. Its payment status remains Awaiting verification until the shop reviews the screenshot.',
        },
        {
            id: 'orders',
            title: 'Orders, payment review, and delivery',
            summary: 'My orders is the reliable place to check each order after checkout.',
            icon: LocalShippingOutlined,
            keywords: 'order status pending processing shipped delivered cancelled payment awaiting verification paid rejected tracking delivery',
            items: [
                'Open My orders from the account menu or mobile navigation, then select an order to see its full details.',
                'Payment statuses are Awaiting verification, Paid, or Rejected. A rejection reason appears on the order detail page when provided.',
                'Fulfillment moves through Pending, Processing, Shipped, and Delivered. Cancelled orders stop progressing.',
                'The order page keeps the receiver details, items, totals, payment screenshot, and current progress together.',
                'When contacting support, provide the order number so the team can find the correct purchase quickly.',
            ],
            note: 'If a payment is rejected, review the reason before making another payment or placing the replacement order.',
        },
        {
            id: 'account',
            title: 'Account, profile, and reviews',
            summary: 'Keep your account accurate so checkout, updates, and future orders are easier.',
            icon: AccountCircleOutlined,
            keywords: 'account register login verify email forgot password profile photo phone address reviews delete logout language',
            items: [
                'Register with an email you can access, sign in, and complete email verification when requested.',
                'Use Forgot password on the login page if you cannot sign in. Never share a reset link, password, or one-time code.',
                'Profile settings let you update your photo, name, email, phone number, default address, and password.',
                'A saved phone and default address reduce typing at checkout; always confirm the final receiver details before ordering.',
                'Signed-in customers can add a rating and written review from an eligible product page.',
            ],
            note: 'Deleting an account is permanent. Review the warning carefully and keep any order information you may still need.',
        },
        {
            id: 'support',
            title: 'Support chat and shopping safety',
            summary: 'Ask the store team for product or order help while keeping your account and payment information safe.',
            icon: ChatBubbleOutlined,
            keywords: 'support chat image attachment security password otp payment account help language English Myanmar',
            items: [
                'Sign in to open Support chat. Send a clear message and, when useful, attach a relevant product or payment image.',
                'For order help, include the order number and explain the exact issue. Avoid sending the same request repeatedly.',
                'Only transfer to a payment account displayed in the website checkout. Confirm account details before sending money.',
                'Never send your password, password-reset link, card PIN, banking password, or one-time code in chat.',
                'Use the language selector in the header to switch the storefront between available languages.',
            ],
            note: 'Support can explain products and order status, but you remain responsible for confirming recipient, address, selected unit, and transfer amount.',
        },
    ], []);

    const normalizedQuery = query.trim().toLowerCase();
    const visibleTopics = normalizedQuery
        ? topics.filter((topic) => [topic.title, topic.summary, topic.keywords, ...topic.items, topic.note].join(' ').toLowerCase().includes(normalizedQuery))
        : topics;

    return (
        <Box className="user-storefront" sx={{ ...storefrontBackgroundSx(theme), minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <UserBrandHead title="Buying Guide & Help" />
            <Navbar />

            <Box sx={{ pt: { xs: '16px', md: '24px' }, pb: { xs: '28px', md: '40px' } }}>
                <Container maxWidth="lg">
                    <Paper
                        elevation={0}
                        sx={{
                            position: 'relative',
                            overflow: 'hidden',
                            p: { xs: '20px 16px', sm: '28px', md: '32px' },
                            borderRadius: 2,
                            color: '#fff',
                            background: musicGradientForTheme(theme),
                            '&::after': {
                                content: '""',
                                position: 'absolute',
                                width: 240,
                                height: 240,
                                borderRadius: '50%',
                                right: -90,
                                top: -110,
                                border: '36px solid rgba(255,255,255,0.07)',
                            },
                        }}
                    >
                        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 760 }}>
                            <Typography sx={{ ...eyebrowSxForTheme(theme), color: colors.amber, mb: '6px' }}>
                                {t('Customer help center')}
                            </Typography>
                            <Typography component="h1" variant="h3" sx={{ fontSize: { xs: '1.65rem', sm: '2rem', md: '2.25rem' }, fontWeight: 700, lineHeight: 1.15 }}>
                                {t('Buying Guide & Store Help')}
                            </Typography>
                            <Typography variant="body1" sx={{ mt: '10px', maxWidth: 680, color: 'rgba(255,255,255,0.84)', lineHeight: 1.65 }}>
                                {t(`Everything you need to choose the right gear, order safely, submit payment, track delivery, and use your ${appName} account.`)}
                            </Typography>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing="10px" sx={{ mt: '20px' }}>
                                <Button
                                    component={Link}
                                    href={routeWithBase('/products', app_base)}
                                    variant="contained"
                                    endIcon={<ChevronRight />}
                                    sx={{ bgcolor: colors.sheet, color: colors.ink, '&:hover': { bgcolor: alpha(colors.sheet, 0.9) } }}
                                >
                                    {t('Start shopping')}
                                </Button>
                                <Button
                                    component={Link}
                                    href={supportHref}
                                    variant="outlined"
                                    sx={{ borderColor: 'rgba(255,255,255,0.52)', color: '#fff', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}
                                >
                                    {t(auth?.user ? 'Contact support' : 'Sign in for support')}
                                </Button>
                            </Stack>
                        </Box>
                    </Paper>

                    <Box component="section" aria-labelledby="how-to-buy" sx={{ mt: { xs: '20px', md: '24px' } }}>
                        <Typography id="how-to-buy" variant="h5" sx={{ fontSize: { xs: '1.2rem', sm: '1.35rem' }, fontWeight: 700, color: colors.ink, mb: '12px' }}>
                            {t('How to buy in four steps')}
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: '12px' }}>
                            {purchaseSteps.map(([number, title, description]) => (
                                <Paper key={number} elevation={0} sx={{ ...sectionShellSxForTheme(theme), p: '16px' }}>
                                    <Typography sx={{ ...eyebrowSxForTheme(theme), mb: '6px' }}>{number}</Typography>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{t(title)}</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: '5px', lineHeight: 1.55 }}>{t(description)}</Typography>
                                </Paper>
                            ))}
                        </Box>
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '260px minmax(0, 1fr)' }, gap: { xs: '16px', md: '20px' }, alignItems: 'start', mt: { xs: '24px', md: '28px' } }}>
                        <Box component="nav" aria-label={t('Guide sections')} sx={{ position: { md: 'sticky' }, top: { md: 92 } }}>
                            <Paper elevation={0} sx={{ ...sectionShellSxForTheme(theme), p: '14px' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, px: '6px', mb: '8px' }}>{t('Jump to a topic')}</Typography>
                                <Stack spacing="2px">
                                    {topics.map((topic) => {
                                        const Icon = topic.icon;
                                        return (
                                            <Button
                                                key={topic.id}
                                                component="a"
                                                href={`#${topic.id}`}
                                                startIcon={<Icon sx={{ fontSize: 18 }} />}
                                                endIcon={<ChevronRight sx={{ fontSize: 17 }} />}
                                                sx={{ justifyContent: 'flex-start', color: 'text.primary', px: '8px', py: '7px', minHeight: 36, fontSize: '0.78rem', '& .MuiButton-endIcon': { ml: 'auto' } }}
                                            >
                                                {t(topic.title)}
                                            </Button>
                                        );
                                    })}
                                    <Button component="a" href="#faq" startIcon={<HelpOutlineOutlined sx={{ fontSize: 18 }} />} endIcon={<ChevronRight sx={{ fontSize: 17 }} />} sx={{ justifyContent: 'flex-start', color: 'text.primary', px: '8px', py: '7px', minHeight: 36, fontSize: '0.78rem', '& .MuiButton-endIcon': { ml: 'auto' } }}>
                                        {t('Common questions')}
                                    </Button>
                                </Stack>
                            </Paper>

                            <Paper elevation={0} sx={{ ...sectionShellSxForTheme(theme), p: '14px', mt: '12px' }}>
                                <Stack direction="row" spacing="8px" alignItems="center">
                                    <LockOutlined sx={{ fontSize: 18, color: colors.rosin }} />
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('Shop safely')}</Typography>
                                </Stack>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: '7px', lineHeight: 1.5 }}>
                                    {t('Use only payment accounts shown at checkout. Never share passwords, PINs, or one-time codes.')}
                                </Typography>
                            </Paper>
                        </Box>

                        <Box>
                            <TextField
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={t('Search this guide: stock, payment, delivery...')}
                                aria-label={t('Search buying guide')}
                                fullWidth
                                InputProps={{
                                    startAdornment: <InputAdornment position="start"><Search color="primary" /></InputAdornment>,
                                }}
                                sx={{ mb: '14px', '& .MuiOutlinedInput-root': { bgcolor: colors.sheet, borderRadius: 2 } }}
                            />

                            <Stack spacing="14px">
                                {visibleTopics.map((topic) => <GuideTopic key={topic.id} topic={topic} t={t} />)}
                            </Stack>

                            {visibleTopics.length === 0 && (
                                <Paper elevation={0} sx={{ ...sectionShellSxForTheme(theme), py: '36px', px: '20px', textAlign: 'center' }}>
                                    <ManageSearch sx={{ fontSize: 36, color: 'text.secondary' }} />
                                    <Typography variant="subtitle1" sx={{ mt: '8px', fontWeight: 700 }}>{t('No guide topic found')}</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: '4px' }}>{t('Try a shorter word, or clear the search to browse every topic.')}</Typography>
                                    <Button onClick={() => setQuery('')} sx={{ mt: '10px' }}>{t('Clear search')}</Button>
                                </Paper>
                            )}

                            {!normalizedQuery && (
                                <Paper component="section" id="faq" elevation={0} sx={{ ...sectionShellSxForTheme(theme), mt: '14px', p: { xs: '16px', sm: '20px' }, scrollMarginTop: '104px' }}>
                                    <Stack direction="row" spacing="10px" alignItems="center" sx={{ mb: '8px' }}>
                                        <HelpOutlineOutlined sx={{ color: colors.rosin }} />
                                        <Box>
                                            <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.08rem' }, fontWeight: 700 }}>{t('Common questions')}</Typography>
                                            <Typography variant="body2" color="text.secondary">{t('Quick answers for the issues customers ask about most.')}</Typography>
                                        </Box>
                                    </Stack>
                                    {faqs.map((item) => (
                                        <Accordion key={item.question} disableGutters elevation={0} sx={{ bgcolor: 'transparent', borderTop: '1px solid', borderColor: 'divider', '&::before': { display: 'none' } }}>
                                            <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 0, minHeight: 48, '& .MuiAccordionSummary-content': { my: '10px' } }}>
                                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{t(item.question)}</Typography>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ px: 0, pt: 0, pb: '14px' }}>
                                                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>{t(item.answer)}</Typography>
                                            </AccordionDetails>
                                        </Accordion>
                                    ))}
                                </Paper>
                            )}

                            <Paper elevation={0} sx={{ mt: '14px', p: { xs: '18px 16px', sm: '20px' }, borderRadius: 2, border: `1px solid ${alpha(colors.rosin, 0.18)}`, bgcolor: alpha(colors.rosin, 0.07) }}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing="14px" justifyContent="space-between" alignItems={{ sm: 'center' }}>
                                    <Box>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{t('Still need help?')}</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: '3px' }}>{t('The shop team can help with a product detail, payment review, or an existing order.')}</Typography>
                                    </Box>
                                    <Stack direction="row" spacing="8px" flexWrap="wrap">
                                        {auth?.user && (
                                            <Button component={Link} href={routeWithBase('/orders', app_base)} variant="outlined" startIcon={<ReceiptLongOutlined />}>
                                                {t('My orders')}
                                            </Button>
                                        )}
                                        <Button component={Link} href={supportHref} variant="contained" startIcon={<ChatBubbleOutlined />}>
                                            {t(auth?.user ? 'Contact support' : 'Sign in')}
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Paper>
                        </Box>
                    </Box>
                </Container>
            </Box>

            <MobileBottomNavSpacer />
            <Footer />
            <MobileBottomNav />
        </Box>
    );
}
