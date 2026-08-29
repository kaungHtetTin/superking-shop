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

export default function Edit({ auth, mustVerifyEmail, status }) {
    const theme = useTheme();
    const { url, props } = usePage();
    const { app_base, app_url } = props;
    const t = usePhraseTranslation();
    const isAdminContext = typeof url === 'string' && url.includes('/admin');

    const inner = (
        <>
            <Head title={t('Profile')} />
            {isAdminContext ? (
                <div className="stack-sm">
                    <section className="panel glass">
                        <UpdateProfileInformationForm mustVerifyEmail={mustVerifyEmail} status={status} className="max-w-xl" />
                    </section>
                    <section className="panel glass">
                        <UpdatePasswordForm className="max-w-xl" />
                    </section>
                    <section className="panel glass">
                        <DeleteUserForm className="max-w-xl" />
                    </section>
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
                    <Paper variant="outlined" sx={{ p: { xs: '18px', sm: '24px' }, borderRadius: 3, borderColor: 'rgba(211,47,47,.28)', bgcolor: 'rgba(211,47,47,.035)' }}>
                        <DeleteUserForm className="max-w-xl" />
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
            sx={{
                ...storefrontBackgroundSx(theme),
                minHeight: '100dvh',
                pt: { xs: '20px', md: '32px' },
                pb: {
                    xs: `calc(${MOBILE_BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px) + 12px)`,
                    md: 4,
                },
            }}
        >
            <Navbar />
            <Container maxWidth="md" sx={{ pb: { xs: '28px', md: '40px' } }}>
                <Paper elevation={0} sx={{ p: { xs: '18px', sm: '24px' }, mb: { xs: '20px', md: '24px' }, borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: '0 12px 32px rgba(15,23,42,.05)' }}>
                    <Stack direction="row" spacing={{ xs: '14px', sm: '18px' }} alignItems="center">
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
                <Stack direction="row" alignItems="center" gap="12px" sx={{ mb: '16px', width: '100%' }} flexWrap="wrap">
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
