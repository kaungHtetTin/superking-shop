import AdminLayout from '@/Layouts/AdminLayout';
import DeleteUserForm from './Partials/DeleteUserForm';
import LogoutForm from './Partials/LogoutForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';
import { Head, Link, usePage } from '@/spa/router';
import { Avatar, Box, Button, Chip, Container, Paper, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MOBILE_BOTTOM_NAV_HEIGHT } from '@/Components/User/MobileBottomNav';
import { routeWithBase, storageUrl } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import Footer from '@/Components/User/Footer';
import { storefrontBackgroundSx } from '@/Components/User/musicStoreDesign';
import { useEffect, useState } from 'react';
import Icon from '@/Components/Admin/icons';
import { PanelHeading } from '@/Components/Admin/shared';
import { AdminFlash } from '@/Components/Admin/AdminFlash';

export default function Edit({ auth, mustVerifyEmail, status, profileSuccess }) {
    const theme = useTheme();
    const { url, props } = usePage();
    const { app_base, app_url, is_super_admin } = props;
    const t = usePhraseTranslation();
    const isAdminContext = typeof url === 'string' && url.includes('/admin');
    const [adminSection, setAdminSection] = useState(status === 'password-updated' ? 'security' : 'general');
    const adminRoleLabel = auth?.user?.role_label || String(auth?.user?.role || 'admin').replaceAll('_', ' ');

    useEffect(() => {
        if (!isAdminContext || typeof window === 'undefined') return;
        const current = new URL(window.location.href);
        if (!current.searchParams.has('saved')) return;
        current.searchParams.delete('saved');
        window.history.replaceState({}, '', `${current.pathname}${current.search}${current.hash}`);
    }, [isAdminContext, status]);

    const inner = (
        <>
            <Head title={t('Profile')} />
            {isAdminContext ? (
                <div className="profile-settings-page">
                <AdminFlash flash={{ success: status === 'password-updated' ? t('Password updated successfully.') : profileSuccess }} />
                <div className="settings-workspace profile-settings-workspace">
                    <aside className="settings-section-nav" aria-label={t('Profile sections')}>
                        <div className="settings-nav-heading">
                            <p className="eyebrow">{t('Account')}</p>
                            <strong>{t(adminRoleLabel)}</strong>
                        </div>
                        {[
                            { id: 'general', label: 'General', description: 'Personal information', icon: 'user' },
                            { id: 'security', label: 'Security', description: 'Password and access', icon: 'lock' },
                            { id: 'danger', label: 'Account actions', description: 'Delete account', icon: 'trash' },
                        ].filter((section) => section.id !== 'danger' || is_super_admin).map((section) => (
                            <button key={section.id} type="button" className={adminSection === section.id ? 'active' : ''} onClick={() => setAdminSection(section.id)} aria-current={adminSection === section.id ? 'page' : undefined}>
                                <span className="settings-nav-icon"><Icon name={section.icon} size={15} /></span>
                                <span><strong>{t(section.label)}</strong><small>{t(section.description)}</small></span>
                            </button>
                        ))}
                        <div className="settings-nav-divider" />
                        {(auth?.user?.permissions || []).includes('settings.manage') && <Link href={routeWithBase('/admin/settings', app_base)}>
                            <span className="settings-nav-icon"><Icon name="settings" size={15} /></span>
                            <span><strong>{t('Application settings')}</strong><small>{t('General, branding and contacts')}</small></span>
                        </Link>}
                    </aside>
                    <section className="settings-work-surface">
                        {adminSection === 'general' && <div className="settings-section-content profile-settings-content">
                            <PanelHeading eyebrow={t('General')} title={t('Edit profile')} />
                            <p className="settings-section-description">{t('Update your name, email address, and profile photo.')}</p>
                            <UpdateProfileInformationForm mustVerifyEmail={mustVerifyEmail} status={status} showHeading={false} />
                        </div>}
                        {adminSection === 'security' && <div className="settings-section-content profile-settings-content">
                            <PanelHeading eyebrow={t('Security')} title={t('Update password')} />
                            <p className="settings-section-description">{t('Use a strong, unique password to protect your administrator account.')}</p>
                            <UpdatePasswordForm showHeading={false} />
                        </div>}
                        {is_super_admin && adminSection === 'danger' && <div className="settings-section-content profile-settings-content">
                            <PanelHeading eyebrow={t('Account actions')} title={t('Delete account')} />
                            <p className="settings-section-description">{t('Permanently remove this account and its access. This action cannot be undone.')}</p>
                            <DeleteUserForm showHeading={false} />
                        </div>}
                    </section>
                </div>
                </div>
            ) : (
                <Stack spacing={{ xs: '16px', md: '20px' }}>
                    <Paper variant="outlined" sx={{ p: { xs: '18px', sm: '24px' }, borderRadius: 3 }}>
                        <UpdateProfileInformationForm mustVerifyEmail={mustVerifyEmail} status={status} className="max-w-xl" />
                    </Paper>
                    <Paper variant="outlined" sx={{ p: { xs: '18px', sm: '24px' }, borderRadius: 3 }}>
                        <UpdatePasswordForm className="max-w-xl" />
                    </Paper>
                    <Paper variant="outlined" sx={{ p: { xs: '18px', sm: '24px' }, borderRadius: 3 }}>
                        <LogoutForm />
                    </Paper>
                </Stack>
            )}
        </>
    );

    if (isAdminContext) {
        return (
            <AdminLayout title={t('Profile settings')} eyebrow={t('Account')}>
                {inner}
            </AdminLayout>
        );
    }

    return (
        <Box
            className="user-storefront"
            sx={{
                ...storefrontBackgroundSx(theme),
                minHeight: '100dvh',
                pb: {
                    xs: `calc(${MOBILE_BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px) + 12px)`,
                    md: 4,
                },
            }}
        >
            <Navbar />
            <Container maxWidth="md" sx={{ pt: { xs: '20px', md: '28px' }, pb: { xs: '28px', md: '40px' } }}>
                <Paper elevation={0} sx={{ p: { xs: '18px', sm: '24px' }, mb: { xs: '20px', md: '24px' }, borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: '0 12px 32px rgba(15,23,42,.05)' }}>
                    <Stack direction="row" spacing={{ xs: '14px', sm: '18px' }}  sx={{ alignItems: "center", ...({}) }}>
                        <Avatar
                            src={auth?.user?.avatar ? storageUrl(auth.user.avatar, app_url) : undefined}
                            sx={{ width: { xs: 56, sm: 64 }, height: { xs: 56, sm: 64 }, bgcolor: 'primary.main', fontWeight: 700, border: '3px solid', borderColor: 'background.paper', boxShadow: '0 6px 18px rgba(15,23,42,.12)' }}
                        >
                            {(auth?.user?.name || 'A').charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>{auth?.user?.name || t('My account')}</Typography>
                            <Typography variant="body2" color="text.secondary" noWrap>{auth?.user?.email}</Typography>
                            <Chip size="small" color={auth?.user?.email_verified_at ? 'success' : 'warning'} variant="outlined" label={t(auth?.user?.email_verified_at ? 'Verified' : 'Verification pending')} sx={{ mt: '8px' }} />
                        </Box>
                    </Stack>
                </Paper>
                <Stack direction="row"   sx={{ alignItems: "center", gap: "12px", flexWrap: "wrap", ...({ mb: '16px', width: '100%' }) }} >
                    <Typography variant="h5" sx={{ fontWeight: 700, flexShrink: 0 }}>
                        {t('My account')}
                    </Typography>
                    <Button
                        component={Link}
                        href={routeWithBase('/orders', app_base)}
                        variant="outlined"
                        size="small"
                        sx={{ fontWeight: 700, ml: 'auto', minWidth: { xs: 112, sm: 128 } }}
                    >
                        {t('My orders')}
                    </Button>
                </Stack>
                {inner}
            </Container>
            <Footer />
            <MobileBottomNav />
        </Box>
    );
}
