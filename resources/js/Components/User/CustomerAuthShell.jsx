import { Link, usePage } from '@/spa/router';
import { ArrowBackRounded, MusicNoteRounded } from '@mui/icons-material';
import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { routeWithBase } from '@/Utils/url';
import { getMusicStoreColors, musicGradientForTheme } from './musicStoreDesign';

export default function CustomerAuthShell({ title, subtitle, children }) {
    const theme = useTheme();
    const colors = getMusicStoreColors(theme);
    const { app_base, app_settings } = usePage().props;
    const appName = app_settings?.app_name || 'Music Store';

    return (
        <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: musicGradientForTheme(theme), py: { xs: '20px', sm: '32px' } }}>
            <Container maxWidth="xs">
                <Paper elevation={0} sx={{ p: { xs: '20px', sm: '24px' }, borderRadius: 3, bgcolor: 'rgba(255,253,248,.96)', border: `1px solid ${alpha(colors.amber, .32)}`, boxShadow: '0 24px 70px rgba(23,19,18,.24)', backdropFilter: 'blur(18px)' }}>
                    <Stack alignItems="center" spacing="10px" sx={{ textAlign: 'center', mb: '20px' }}>
                        {app_settings?.logo_url ? (
                            <Box component="img" src={app_settings.logo_url} alt={appName} sx={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 2, bgcolor: 'white' }} />
                        ) : (
                            <Box sx={{ width: 56, height: 56, display: 'grid', placeItems: 'center', borderRadius: 2, bgcolor: alpha(colors.rosin, .1), color: colors.rosin }}><MusicNoteRounded sx={{ fontSize: 32 }} /></Box>
                        )}
                        <Box>
                            <Typography variant="h4" sx={{ fontSize: { xs: '1.35rem', sm: '1.5rem' }, fontWeight: 700, color: colors.ink }}>{title}</Typography>
                            {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: '8px', lineHeight: 1.65 }}>{subtitle}</Typography>}
                        </Box>
                    </Stack>
                    {children}
                    <Button component={Link} href={routeWithBase('/', app_base)} startIcon={<ArrowBackRounded />} sx={{ mt: '16px', width: '100%', color: 'text.secondary' }}>
                        Back to shop
                    </Button>
                </Paper>
            </Container>
        </Box>
    );
}
