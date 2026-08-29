import { useRef } from 'react';
import { useForm, usePage } from '@/spa/router';
import { Transition } from '@headlessui/react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function UpdatePasswordForm({ className }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const passwordInput = useRef();
    const currentPasswordInput = useRef();

    const { data, setData, errors, put, reset, processing, recentlySuccessful } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const updatePassword = (e) => {
        e.preventDefault();

        put(routeWithBase('/password', app_base), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: () => {
                if (errors.password) {
                    reset('password', 'password_confirmation');
                    passwordInput.current.focus();
                }

                if (errors.current_password) {
                    reset('current_password');
                    currentPasswordInput.current.focus();
                }
            },
        });
    };

    return (
        <Box component="section" className={className}>
            <Stack spacing="6px">
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {t('Update Password')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t('Ensure your account is using a long, random password to stay secure.')}
                </Typography>
            </Stack>

            <Box component="form" onSubmit={updatePassword} sx={{ mt: '20px' }}>
                <Stack spacing="16px">
                    <TextField
                        id="current_password"
                        type="password"
                        label={t('Current Password')}
                        fullWidth
                        inputRef={currentPasswordInput}
                        autoComplete="current-password"
                        value={data.current_password}
                        onChange={(e) => setData('current_password', e.target.value)}
                        error={Boolean(errors.current_password)}
                        helperText={errors.current_password}
                    />

                    <TextField
                        id="password"
                        type="password"
                        label={t('New Password')}
                        fullWidth
                        inputRef={passwordInput}
                        autoComplete="new-password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        error={Boolean(errors.password)}
                        helperText={errors.password}
                    />

                    <TextField
                        id="password_confirmation"
                        type="password"
                        label={t('Confirm Password')}
                        fullWidth
                        autoComplete="new-password"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                        error={Boolean(errors.password_confirmation)}
                        helperText={errors.password_confirmation}
                    />

                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <Button type="submit" variant="contained" disabled={processing}>
                            {t('Save')}
                        </Button>
                        <Transition show={recentlySuccessful} enterFrom="opacity-0" leaveTo="opacity-0" className="transition ease-in-out">
                            <Typography variant="body2" color="text.secondary">
                                {t('Saved.')}
                            </Typography>
                        </Transition>
                    </Stack>
                </Stack>
            </Box>
        </Box>
    );
}
