import React, { useState } from 'react';
import { Link, useForm, usePage } from '@/spa/router';
import {
    Avatar,
    Box,
    Divider,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Typography,
} from '@mui/material';
import {
    ArticleOutlined,
    ChatBubbleOutlined,
    FavoriteBorder,
    HelpOutlineOutlined,
    KeyboardArrowDown,
    Login,
    Logout,
    Person,
    PersonAdd,
    ReceiptLong,
    Settings,
    ShoppingBag,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { routeWithBase, storageUrl } from '@/Utils/url';
import { useWishlistStore } from '@/stores/wishlistStore';
import { getMusicStoreColors } from '@/Components/User/musicStoreDesign';
import { useTranslation } from '@/Utils/i18n';

const menuPaperSx = (theme) => ({
    mt: 1,
    minWidth: { xs: 260, sm: 280 },
    maxWidth: 320,
    borderRadius: 2,
    overflow: 'visible',
    border: '1px solid',
    borderColor: alpha(theme.palette.primary.main, 0.12),
    boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.14)}, 0 4px 12px rgba(0,0,0,0.06)`,
    '&::before': {
        content: '""',
        display: 'block',
        position: 'absolute',
        top: 0,
        right: 20,
        width: 12,
        height: 12,
        bgcolor: 'background.paper',
        transform: 'translateY(-50%) rotate(45deg)',
        zIndex: 0,
        borderLeft: '1px solid',
        borderTop: '1px solid',
        borderColor: alpha(theme.palette.primary.main, 0.12),
    },
});

const menuItemSx = (theme) => ({
    py: 1.25,
    px: 2,
    mx: 1,
    my: 0.25,
    borderRadius: 1,
    fontSize: '0.875rem',
    fontWeight: 600,
    '&:hover': {
        bgcolor: alpha(theme.palette.primary.main, 0.08),
    },
});

const iconSx = { minWidth: 36, color: 'primary.main' };

function MenuLinkItem({ href, icon, label, secondary, badge, onClose }) {
    const theme = useTheme();

    return (
        <MenuItem
            component={Link}
            href={href}
            onClick={onClose}
            sx={menuItemSx(theme)}
        >
            <ListItemIcon sx={iconSx}>{icon}</ListItemIcon>
            <ListItemText
                primary={label}
                secondary={secondary}
                primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                secondaryTypographyProps={{ fontSize: '0.7rem' }}
            />
            {badge != null && badge > 0 && (
                <Box
                    component="span"
                    sx={{
                        ml: 1,
                        px: 0.75,
                        py: 0.15,
                        borderRadius: 1,
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        lineHeight: 1.4,
                    }}
                >
                    {badge > 99 ? '99+' : badge}
                </Box>
            )}
        </MenuItem>
    );
}

export default function ProfileMenu() {
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);
    const { app_base, app_url, auth, chat_unread_count, app_settings } = usePage().props;
    const appName = app_settings?.app_name || 'Harmony House';
    const wishCount = useWishlistStore((s) => s.count());
    const [anchorEl, setAnchorEl] = useState(null);
    const logoutForm = useForm({});
    const open = Boolean(anchorEl);
    const user = auth?.user;
    const t = useTranslation();

    const handleOpen = (e) => setAnchorEl(e.currentTarget);
    const handleClose = () => setAnchorEl(null);

    const handleLogout = () => {
        handleClose();
        logoutForm.post(routeWithBase('/logout', app_base));
    };

    return (
        <>
            <IconButton
                size="small"
                color="primary"
                onClick={handleOpen}
                aria-label={user ? t('storefront.account_menu', 'Account menu') : t('storefront.sign_in_menu', 'Sign in menu')}
                aria-controls={open ? 'profile-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                sx={{
                    p: user?.avatar ? '2px' : undefined,
                    borderRadius: 2,
                    border: open ? `1px solid ${alpha(theme.palette.primary.main, 0.35)}` : '1px solid transparent',
                    bgcolor: open ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
                    transition: 'border-color 0.2s, background-color 0.2s',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    {user?.avatar ? (
                        <Avatar
                            alt={user.name || ''}
                            src={storageUrl(user.avatar, app_url)}
                            sx={{
                                width: 30,
                                height: 30,
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
                            }}
                        />
                    ) : (
                        <Person sx={{ fontSize: '1.35rem' }} />
                    )}
                    <KeyboardArrowDown
                        sx={{
                            fontSize: '1rem',
                            opacity: 0.7,
                            display: { xs: 'none', sm: 'block' },
                            transform: open ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s',
                        }}
                    />
                </Box>
            </IconButton>

            <Menu
                id="profile-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: { sx: menuPaperSx(theme) },
                    list: { sx: { py: 1, position: 'relative', zIndex: 1 } },
                }}
            >
                {user ? (
                    <>
                        <Box
                            sx={{
                                px: 2,
                                pt: 1.5,
                                pb: 1.75,
                                mx: 1,
                                mb: 0.5,
                                borderRadius: 1.5,
                                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.light, 0.14)} 100%)`,
                            }}
                        >
                            <StackRow user={user} app_url={app_url} />
                        </Box>
                        <Divider sx={{ mx: 2, mb: 0.5, opacity: 0.6 }} />
                        <MenuLinkItem
                            href={routeWithBase('/profile', app_base)}
                            icon={<Settings fontSize="small" />}
                            label={t('storefront.profile_settings', 'Profile settings')}
                            onClose={handleClose}
                        />
                        <MenuLinkItem
                            href={routeWithBase('/orders', app_base)}
                            icon={<ReceiptLong fontSize="small" />}
                            label={t('storefront.my_orders', 'My orders')}
                            secondary={t('storefront.orders_hint', 'Track payments & delivery')}
                            onClose={handleClose}
                        />
                        <MenuLinkItem
                            href={routeWithBase('/wishlist', app_base)}
                            icon={<FavoriteBorder fontSize="small" />}
                            label={t('storefront.wishlist', 'Wishlist')}
                            badge={wishCount}
                            onClose={handleClose}
                        />
                        <MenuLinkItem
                            href={routeWithBase('/chat', app_base)}
                            icon={<ChatBubbleOutlined fontSize="small" />}
                            label={t('storefront.support_chat_label', 'Support chat')}
                            badge={chat_unread_count}
                            onClose={handleClose}
                        />
                        <MenuLinkItem
                            href={routeWithBase('/blogs', app_base)}
                            icon={<ArticleOutlined fontSize="small" />}
                            label={t('storefront.blog', 'Blog')}
                            secondary={t('storefront.blog_hint', 'Stories, tips & product guides')}
                            onClose={handleClose}
                        />
                        <MenuLinkItem
                            href={routeWithBase('/buying-guide', app_base)}
                            icon={<HelpOutlineOutlined fontSize="small" />}
                            label={t('storefront.buying_guide', 'Buying guide & help')}
                            onClose={handleClose}
                        />
                        <MenuLinkItem
                            href={routeWithBase('/products', app_base)}
                            icon={<ShoppingBag fontSize="small" />}
                            label={t('storefront.continue_shopping', 'Continue shopping')}
                            onClose={handleClose}
                        />
                        <Divider sx={{ mx: 2, my: 0.75, opacity: 0.6 }} />
                        <MenuItem onClick={handleLogout} sx={{ ...menuItemSx(theme), color: 'error.main' }} disabled={logoutForm.processing}>
                            <ListItemIcon sx={{ ...iconSx, color: 'error.main' }}>
                                <Logout fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary={logoutForm.processing ? t('storefront.signing_out', 'Signing out...') : t('storefront.log_out', 'Log out')}
                                primaryTypographyProps={{ fontWeight: 700, fontSize: '0.875rem' }}
                            />
                        </MenuItem>
                    </>
                ) : (
                    <>
                        <Box sx={{ px: 2.5, pt: 1.5, pb: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: musicColors.rosin }}>
                                {t('storefront.welcome_to', `Welcome to ${appName}`, { app: appName })}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                {t('storefront.guest_hint', 'Sign in to save gear, track orders, and chat with the shop team.')}
                            </Typography>
                        </Box>
                        <Divider sx={{ mx: 2, mb: 0.5, opacity: 0.6 }} />
                        <MenuLinkItem
                            href={routeWithBase('/login', app_base)}
                            icon={<Login fontSize="small" />}
                            label={t('storefront.sign_in', 'Sign in')}
                            onClose={handleClose}
                        />
                        <MenuLinkItem
                            href={routeWithBase('/register', app_base)}
                            icon={<PersonAdd fontSize="small" />}
                            label={t('storefront.create_account', 'Create account')}
                            onClose={handleClose}
                        />
                        <MenuLinkItem
                            href={routeWithBase('/blogs', app_base)}
                            icon={<ArticleOutlined fontSize="small" />}
                            label={t('storefront.blog', 'Blog')}
                            secondary={t('storefront.blog_hint', 'Stories, tips & product guides')}
                            onClose={handleClose}
                        />
                        <MenuLinkItem
                            href={routeWithBase('/buying-guide', app_base)}
                            icon={<HelpOutlineOutlined fontSize="small" />}
                            label={t('storefront.buying_guide', 'Buying guide & help')}
                            onClose={handleClose}
                        />
                        <MenuLinkItem
                            href={routeWithBase('/products', app_base)}
                            icon={<ShoppingBag fontSize="small" />}
                            label={t('storefront.browse_shop', 'Browse shop')}
                            onClose={handleClose}
                        />
                    </>
                )}
            </Menu>
        </>
    );
}

function StackRow({ user, app_url }) {
    const theme = useTheme();

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Avatar
                alt={user.name || ''}
                src={user.avatar ? storageUrl(user.avatar, app_url) : undefined}
                sx={{
                    width: 44,
                    height: 44,
                    bgcolor: 'primary.main',
                    fontWeight: 700,
                    fontSize: '1rem',
                    border: '2px solid rgba(255,255,255,0.9)',
                    boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.2)}`,
                }}
            >
                {!user.avatar && (user.name?.charAt(0)?.toUpperCase() || '?')}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                    {user.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {user.email}
                </Typography>
            </Box>
        </Box>
    );
}
