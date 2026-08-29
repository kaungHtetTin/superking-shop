import { useRef, useState } from 'react';
import { useForm, usePage } from '@/spa/router';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function DeleteUserForm({ className }) {
    const { url, props } = usePage();
    const t = usePhraseTranslation();
    const { app_base } = props;
    const isAdminContext = typeof url === 'string' && url.includes('/admin');
    const profileEndpoint = routeWithBase(isAdminContext ? '/admin/profile' : '/profile', app_base);
    const [confirmingUserDeletion, setConfirmingUserDeletion] = useState(false);
    const passwordInput = useRef();

    const {
        data,
        setData,
        delete: destroy,
        processing,
        reset,
        errors,
    } = useForm({
        password: '',
    });

    const confirmUserDeletion = () => {
        setConfirmingUserDeletion(true);
    };

    const deleteUser = (e) => {
        e.preventDefault();

        destroy(profileEndpoint, {
            preserveScroll: true,
            onSuccess: () => closeModal(),
            onError: () => passwordInput.current.focus(),
            onFinish: () => reset(),
        });
    };

    const closeModal = () => {
        setConfirmingUserDeletion(false);

        reset();
    };

    return (
        <Box component="section" className={className}>
            <Stack spacing="6px">
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {t('Delete Account')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t('Once your account is deleted, all resources and data will be permanently deleted.')}
                </Typography>
            </Stack>

            <Button color="error" variant="outlined" sx={{ mt: '16px' }} onClick={confirmUserDeletion}>
                {t('Delete Account')}
            </Button>

            <Dialog open={confirmingUserDeletion} onClose={closeModal} fullWidth maxWidth="sm">
                <DialogTitle sx={{ fontWeight: 700 }}>{t('Are you sure you want to delete your account?')}</DialogTitle>
                <Box component="form" onSubmit={deleteUser}>
                    <DialogContent sx={{ pt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {t('This action is permanent. Enter your password to confirm account deletion.')}
                        </Typography>
                        <TextField
                            id="password"
                            type="password"
                            name="password"
                            fullWidth
                            label={t('Password')}
                            inputRef={passwordInput}
                            autoFocus
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            error={Boolean(errors.password)}
                            helperText={errors.password}
                        />
                        <Alert severity="warning" variant="outlined" sx={{ mt: 2 }}>
                            {t('This cannot be undone.')}
                        </Alert>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={closeModal}>{t('Cancel')}</Button>
                        <Button type="submit" color="error" variant="contained" disabled={processing}>
                            {t('Delete Account')}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Box>
    );
}
