import { useRef, useState } from 'react';
import { useForm, usePage } from '@/spa/router';
import { Box, Button, IconButton, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function UpdatePasswordForm({ className, showHeading = true }) {
    const { url, props } = usePage();
    const { app_base } = props;
    const t = usePhraseTranslation();
    const isAdminContext = typeof url === 'string' && url.includes('/admin');
    const passwordEndpoint = routeWithBase(isAdminContext ? '/admin/profile/password' : '/password', app_base);
    const passwordInput = useRef();
    const currentPasswordInput = useRef();
    const [passwordVisibility, setPasswordVisibility] = useState({
        current_password: false,
        password: false,
        password_confirmation: false,
    });
    const { data, setData, errors, put, reset, processing } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const updatePassword = (e) => {
        e.preventDefault();

        put(passwordEndpoint, {
            preserveScroll: true,
            onSuccess: (response) => {
                reset();
                setPasswordVisibility({ current_password: false, password: false, password_confirmation: false });
                if (isAdminContext && response?.status === 'password-updated') {
                    window.dispatchEvent(new CustomEvent('admin:notice', {
                        detail: { type: 'success', message: t('Password updated successfully.') },
                    }));
                }
            },
            onError: (nextErrors) => {
                if (nextErrors.password) {
                    reset('password', 'password_confirmation');
                    passwordInput.current?.focus();
                }

                if (nextErrors.current_password) {
                    reset('current_password');
                    currentPasswordInput.current?.focus();
                }
            },
        });
    };

    const visibilityControl = (field, label) => ({
        endAdornment: (
            <InputAdornment position="end">
                <IconButton
                    type="button"
                    edge="end"
                    size="small"
                    aria-label={t(passwordVisibility[field] ? `Hide ${label}` : `Show ${label}`)}
                    aria-pressed={passwordVisibility[field]}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setPasswordVisibility((current) => ({ ...current, [field]: !current[field] }))}
                >
                    {passwordVisibility[field] ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                </IconButton>
            </InputAdornment>
        ),
    });

    return (
        <Box component="section" className={className}>
            {showHeading && <Stack spacing="6px">
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {t('Update Password')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t('Ensure your account is using a long, random password to stay secure.')}
                </Typography>
            </Stack>}

            <Box component="form" onSubmit={updatePassword} sx={{ mt: showHeading ? '20px' : 0 }}>
                <Stack spacing={isAdminContext ? '12px' : '16px'}>
                    <TextField
                        id="current_password"
                        type={passwordVisibility.current_password ? 'text' : 'password'}
                        label={t('Current Password')}
                        fullWidth
                        inputRef={currentPasswordInput}
                        autoComplete="current-password"
                        value={data.current_password}
                        onChange={(e) => setData('current_password', e.target.value)}
                        error={Boolean(errors.current_password)}
                        helperText={errors.current_password}
                        slotProps={{ input: visibilityControl('current_password', 'current password') }}
                    />

                    <TextField
                        id="password"
                        type={passwordVisibility.password ? 'text' : 'password'}
                        label={t('New Password')}
                        fullWidth
                        inputRef={passwordInput}
                        autoComplete="new-password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        error={Boolean(errors.password)}
                        helperText={errors.password}
                        slotProps={{ input: visibilityControl('password', 'new password') }}
                    />

                    <TextField
                        id="password_confirmation"
                        type={passwordVisibility.password_confirmation ? 'text' : 'password'}
                        label={t('Confirm Password')}
                        fullWidth
                        autoComplete="new-password"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                        error={Boolean(errors.password_confirmation)}
                        helperText={errors.password_confirmation}
                        slotProps={{ input: visibilityControl('password_confirmation', 'password confirmation') }}
                    />

                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <Button type="submit" variant="contained" disabled={processing}>
                            {t('Save')}
                        </Button>
                    </Stack>
                </Stack>
            </Box>
        </Box>
    );
}
