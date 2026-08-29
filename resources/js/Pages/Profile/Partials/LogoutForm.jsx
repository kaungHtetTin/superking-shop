import { useForm, usePage } from '@/spa/router';
import { Box, Button, Typography } from '@mui/material';
import { Logout as LogoutIcon } from '@mui/icons-material';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function LogoutForm() {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const { post, processing } = useForm({});

    return (
        <Box component="section">
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                {t('Session')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('Sign out on this device. Your cart and wishlist stay in the browser until you clear them.')}
            </Typography>
            <Button
                type="button"
                variant="outlined"
                color="inherit"
                startIcon={<LogoutIcon />}
                disabled={processing}
                onClick={() => post(routeWithBase('/logout', app_base))}
                sx={{ fontWeight: 700 }}
            >
                {t('Log out')}
            </Button>
        </Box>
    );
}
