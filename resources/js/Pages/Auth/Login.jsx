import { Head, Link, useForm, usePage } from '@/spa/router';
import React, { useEffect } from 'react';
import { routeWithBase } from '@/Utils/url';
import {
    Box,
    Alert,
    Button,
    Checkbox,
    FormControlLabel,
    IconButton,
    InputAdornment,
    Stack,
    TextField,
    Typography,
    Container,
    Paper,
    Divider,
} from '@mui/material';
import {
    Email as EmailIcon,
    Lock as LockIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Google as GoogleIcon,
    AdminPanelSettings,
    GraphicEq,
    Headphones,
    MusicNote,
    Piano,
    ArrowBackRounded,
} from '@mui/icons-material';
import { alpha, darken, useTheme } from '@mui/material/styles';
import { eyebrowSx, getMusicStoreColors, musicGradientForTheme } from '@/Components/User/musicStoreDesign';
import PwaHeadTags from '@/Components/User/PwaHeadTags';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function Login({ status, error, isAdminLogin = false, googleAuthAvailable = false }) {
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);
    const { url, props } = usePage();
    const { app_base, app_settings } = props;
    const isAdmin = isAdminLogin || (typeof url === 'string' && url.includes('/admin/login'));
    const [showPassword, setShowPassword] = React.useState(false);
    const t = usePhraseTranslation();

    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    useEffect(() => {
        return () => {
            reset('password');
        };
    }, []);

    const submit = (e) => {
        e.preventDefault();
        const action = isAdmin ? routeWithBase('/admin/login', app_base) : routeWithBase('/login', app_base);
        post(action);
    };

    const appName = app_settings?.app_name || 'the music shop';
    const adminGradient = `radial-gradient(circle at 18% 20%, ${alpha(musicColors.amber, 0.28)} 0, transparent 24%), radial-gradient(circle at 82% 10%, ${alpha(musicColors.rosin, 0.34)} 0, transparent 28%), linear-gradient(135deg, ${musicColors.coal} 0%, ${darken(musicColors.rosin, 0.45)} 52%, #11100f 100%)`;
    const adminFieldSx = {
        '& .MuiOutlinedInput-root': {
            minHeight: 40,
            bgcolor: '#fff',
            borderRadius: 1.5,
            transition: 'box-shadow 160ms ease, background-color 160ms ease',
            '&.Mui-focused': {
                boxShadow: `0 0 0 3px ${alpha(musicColors.rosin, 0.12)}`,
            },
        },
        '& .MuiInputBase-input': {
            py: 1.1,
        },
    };

    const adminForm = (
        <Box
            sx={{
                minHeight: '100dvh',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                py: { xs: 2, sm: 3, md: 4 },
                background: adminGradient,
                color: 'white',
            }}
        >
            <Head title={t('Admin Login')} />

            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.1,
                    backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 62px, rgba(255,255,255,0.42) 62px 63px), repeating-linear-gradient(0deg, transparent 0 34px, rgba(255,255,255,0.22) 34px 35px)',
                    pointerEvents: 'none',
                }}
            />
            <Piano
                sx={{
                    position: 'absolute',
                    left: { xs: -48, md: 54 },
                    bottom: { xs: -38, md: 38 },
                    fontSize: { xs: 180, md: 250 },
                    color: alpha(musicColors.amber, 0.2),
                    transform: 'rotate(-9deg)',
                    pointerEvents: 'none',
                }}
            />
            <GraphicEq
                sx={{
                    position: 'absolute',
                    right: { xs: -18, md: 84 },
                    top: { xs: 36, md: 74 },
                    fontSize: { xs: 96, md: 140 },
                    color: alpha('#ffffff', 0.14),
                    pointerEvents: 'none',
                }}
            />

            <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, px: { xs: 2, sm: 3 } }}>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.08fr) minmax(360px, 0.92fr)' },
                        gap: { xs: 2, md: 6 },
                        alignItems: 'center',
                        minWidth: 0,
                    }}
                >
                    <Box sx={{ display: { xs: 'none', md: 'block' }, maxWidth: 540 }}>
                        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 4 }}>
                            <Box
                                sx={{
                                    width: 42,
                                    height: 42,
                                    display: 'grid',
                                    placeItems: 'center',
                                    borderRadius: 1.75,
                                    bgcolor: alpha('#fff', 0.1),
                                    border: `1px solid ${alpha('#fff', 0.16)}`,
                                    overflow: 'hidden',
                                }}
                            >
                                {app_settings?.logo_url ? (
                                    <Box component="img" src={app_settings.logo_url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain', bgcolor: '#fff' }} />
                                ) : (
                                    <MusicNote sx={{ color: musicColors.amber, fontSize: 24 }} />
                                )}
                            </Box>
                            <Box>
                                <Typography sx={{ fontWeight: 800, lineHeight: 1.15 }}>{appName}</Typography>
                                <Typography sx={{ ...eyebrowSx, color: alpha('#fff', 0.58), mt: 0.25 }}>
                                    {t('Staff console')}
                                </Typography>
                            </Box>
                        </Stack>

                        <Typography sx={{ ...eyebrowSx, color: musicColors.amber, mb: 1.25 }}>
                            {t('Store operations')}
                        </Typography>
                        <Typography
                            variant="h2"
                            sx={{
                                fontWeight: 800,
                                lineHeight: 1.02,
                                letterSpacing: '-0.035em',
                                fontSize: { md: '3.75rem', lg: '4.15rem' },
                                mb: 2.25,
                            }}
                        >
                            {t('Keep the store in tune.')}
                        </Typography>
                        <Typography sx={{ color: alpha('#fff', 0.72), fontWeight: 500, lineHeight: 1.7, maxWidth: 460 }}>
                            {t('Manage instruments, inventory, orders, and customer requests from the staff console.')}
                        </Typography>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                gap: 1,
                                mt: 3.5,
                                maxWidth: 430,
                                '@media (max-height: 720px)': { display: 'none' },
                            }}
                        >
                            {[
                                { label: 'Catalog', Icon: Piano },
                                { label: 'Inventory', Icon: GraphicEq },
                                { label: 'Orders', Icon: MusicNote },
                                { label: 'Support', Icon: Headphones },
                            ].map(({ label, Icon }) => (
                                <Stack
                                    key={label}
                                    direction="row"
                                    spacing={0.75}
                                    alignItems="center"
                                    sx={{
                                        px: 1.5,
                                        py: 1.1,
                                        borderRadius: 1.5,
                                        border: `1px solid ${alpha('#fff', 0.16)}`,
                                        bgcolor: alpha('#fff', 0.07),
                                        color: alpha('#fff', 0.9),
                                    }}
                                >
                                    <Icon sx={{ fontSize: 18, color: musicColors.amber }} />
                                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                        {t(label)}
                                    </Typography>
                                </Stack>
                            ))}
                        </Box>
                    </Box>

                    <Paper
                        elevation={0}
                        sx={{
                            justifySelf: { xs: 'stretch', md: 'end' },
                            width: '100%',
                            maxWidth: { xs: '100%', sm: 410 },
                            minWidth: 0,
                            boxSizing: 'border-box',
                            mx: { xs: 'auto', md: 0 },
                            p: { xs: 2.5, sm: 3 },
                            borderRadius: 2.5,
                            bgcolor: 'rgba(255, 253, 248, 0.96)',
                            color: musicColors.ink,
                            border: `1px solid ${alpha(musicColors.amber, 0.32)}`,
                            boxShadow: '0 30px 90px rgba(0,0,0,0.36)',
                            backdropFilter: 'blur(20px)',
                        }}
                    >
                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ textAlign: 'left', mb: 2.5 }}>
                            <Box
                                sx={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 2,
                                    display: 'grid',
                                    placeItems: 'center',
                                    color: musicColors.rosin,
                                    bgcolor: alpha(musicColors.rosin, 0.1),
                                    border: `1px solid ${alpha(musicColors.rosin, 0.18)}`,
                                }}
                            >
                                <AdminPanelSettings sx={{ fontSize: 29 }} />
                            </Box>
                            <Box>
                                <Typography variant="h4" sx={{ fontWeight: 800, color: musicColors.ink, lineHeight: 1.1, fontSize: '1.35rem' }}>
                                    {t('Welcome back')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontWeight: 600 }}>
                                    {t('Sign in with your staff account')}
                                </Typography>
                            </Box>
                        </Stack>

                        {status && (
                            <Alert severity="success" sx={{ mb: 2, py: 0.25, alignItems: 'center' }}>
                                {status}
                            </Alert>
                        )}

                        {error && (
                            <Alert severity="error" sx={{ mb: 2, py: 0.25, alignItems: 'center' }}>
                                {error}
                            </Alert>
                        )}

                        <form onSubmit={submit}>
                            <Stack spacing={1.4}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label={t('Email')}
                                    name="email"
                                    type="email"
                                    autoComplete="username"
                                    autoFocus
                                    required
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    error={!!errors.email}
                                    helperText={errors.email}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <EmailIcon sx={{ color: musicColors.rosin, opacity: 0.78 }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={adminFieldSx}
                                />

                                <TextField
                                    fullWidth
                                    size="small"
                                    label={t('Password')}
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    error={!!errors.password}
                                    helperText={errors.password}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <LockIcon sx={{ color: musicColors.rosin, opacity: 0.78 }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    edge="end"
                                                    aria-label={t(showPassword ? 'Hide password' : 'Show password')}
                                                >
                                                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={adminFieldSx}
                                />

                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, minHeight: 36 }}>
                                    <FormControlLabel
                                        sx={{ mr: 0 }}
                                        control={
                                            <Checkbox
                                                name="remember"
                                                checked={data.remember}
                                                onChange={(e) => setData('remember', e.target.checked)}
                                                size="small"
                                                sx={{ color: musicColors.rosin, '&.Mui-checked': { color: musicColors.rosin } }}
                                            />
                                        }
                                        label={<Typography variant="body2" sx={{ fontWeight: 600 }}>{t('Remember me')}</Typography>}
                                    />
                                    <Link href={routeWithBase('/forgot-password', app_base)} style={{ textDecoration: 'none' }}>
                                        <Typography variant="body2" sx={{ color: musicColors.rosin, fontWeight: 700 }}>
                                            {t('Forgot?')}
                                        </Typography>
                                    </Link>
                                </Box>

                                <Button
                                    fullWidth
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    disabled={processing}
                                    sx={{
                                        minHeight: 40,
                                        py: 1,
                                        fontSize: '0.9rem',
                                        fontWeight: 800,
                                        bgcolor: musicColors.rosin,
                                        color: 'white',
                                        boxShadow: `0 12px 28px ${alpha(musicColors.rosin, 0.26)}`,
                                        '&:hover': { bgcolor: darken(musicColors.rosin, 0.08) },
                                    }}
                                >
                                    {t(processing ? 'Logging in...' : 'Enter admin')}
                                </Button>
                            </Stack>
                        </form>

                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2, fontWeight: 600 }}>
                            {t('Authorized staff access only')}
                        </Typography>
                    </Paper>
                </Box>
            </Container>
        </Box>
    );

    if (isAdmin) {
        return adminForm;
    }

    return (
        <Box sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: musicGradientForTheme(theme),
            py: { xs: '20px', sm: '32px' },
        }}>
            <Head title={t('Log in')}>
                <PwaHeadTags />
            </Head>

            <Container maxWidth="xs">
                <Paper elevation={0} sx={{
                    p: { xs: '24px', sm: '28px' },
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 253, 248, 0.92)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(244, 194, 103, 0.26)',
                    boxShadow: '0 24px 70px rgba(23,19,18,0.24)',
                    textAlign: 'center',
                }}>
                    {app_settings?.logo_url && <Box component="img" src={app_settings.logo_url} alt={appName} sx={{ width: 56, height: 56, objectFit: 'contain', mx: 'auto', mb: '16px', borderRadius: 2, bgcolor: 'white' }} />}
                    <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', sm: '1.7rem' }, color: musicColors.ink, mb: 1 }}>
                        {t('Welcome to')} {appName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: '24px' }}>
                        {t('Log in to save instruments, track orders, and chat with the shop team.')}
                    </Typography>

                    {status && (
                        <Typography color="success.main" sx={{ mb: 3, fontWeight: 500 }}>
                            {status}
                        </Typography>
                    )}

                    {error && (
                        <Typography color="error.main" sx={{ mb: 3, fontWeight: 600 }}>
                            {error}
                        </Typography>
                    )}

                    <form onSubmit={submit}>
                        <Stack spacing="16px">
                            <TextField
                                fullWidth
                                label={t('Email or phone')}
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                error={!!errors.email}
                                helperText={errors.email}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <EmailIcon color="primary" sx={{ opacity: 0.7 }} />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{ bgcolor: 'white', borderRadius: 2 }}
                            />

                            <TextField
                                fullWidth
                                label={t('Password')}
                                type={showPassword ? 'text' : 'password'}
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                error={!!errors.password}
                                helperText={errors.password}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <LockIcon color="primary" sx={{ opacity: 0.7 }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                                {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{ bgcolor: 'white', borderRadius: 2 }}
                            />

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            name="remember"
                                            checked={data.remember}
                                            onChange={(e) => setData('remember', e.target.checked)}
                                            color="primary"
                                        />
                                    }
                                    label={<Typography variant="body2">{t('Remember me')}</Typography>}
                                />
                                <Link href={routeWithBase('/forgot-password', app_base)} style={{ textDecoration: 'none' }}>
                                    <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
                                        {t('Forgot?')}
                                    </Typography>
                                </Link>
                            </Box>

                            <Button
                                fullWidth
                                type="submit"
                                variant="contained"
                                size="large"
                                disabled={processing}
                                sx={{ py: 1.5, fontSize: '1rem' }}
                            >
                                {t(processing ? 'Logging in...' : 'Sign In')}
                            </Button>
                        </Stack>
                    </form>

                    <>
                        {googleAuthAvailable && <>
                        <Box sx={{ my: '24px' }}>
                            <Divider>
                                <Typography variant="caption" color="text.secondary">
                                    {t('OR CONTINUE WITH')}
                                </Typography>
                            </Divider>
                        </Box>

                        <Button
                            fullWidth
                            component="a"
                            href={routeWithBase('/auth/google', app_base)}
                            variant="outlined"
                            startIcon={<GoogleIcon />}
                            sx={{
                                borderColor: '#ddd',
                                color: 'text.primary',
                                '&:hover': { borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.05) },
                            }}
                        >
                            Google
                        </Button>
                        </>}

                        <Typography variant="body2" color="text.secondary" sx={{ mt: '24px' }}>
                            {t("Don't have an account?")}{' '}
                            <Link href={routeWithBase('/register', app_base)} style={{ textDecoration: 'none' }}>
                                <Typography component="span" variant="body2" color="primary" sx={{ fontWeight: 700 }}>
                                    {t('Sign Up')}
                                </Typography>
                            </Link>
                        </Typography>
                    </>
                    <Button component={Link} href={routeWithBase('/', app_base)} startIcon={<ArrowBackRounded />} sx={{ mt: '16px', color: 'text.secondary' }}>{t('Back to shop')}</Button>
                </Paper>
            </Container>
        </Box>
    );
}
