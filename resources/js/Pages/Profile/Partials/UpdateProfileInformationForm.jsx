import { Link, useForm, usePage } from '@/spa/router';
import { Transition } from '@headlessui/react';
import {
    Alert,
    Avatar,
    Box,
    Button,
    ButtonBase,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { PhotoCamera } from '@mui/icons-material';
import { routeWithBase } from '@/Utils/url';
import { storageUrl } from '@/Utils/url';
import { useEffect, useState } from 'react';
import CropImageModal from '@/Components/Admin/CropImageModal';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function UpdateProfileInformation({ mustVerifyEmail, status, className }) {
    const { url, props } = usePage();
    const t = usePhraseTranslation();
    const { auth, app_base, app_url } = props;
    const user = auth?.user;
    const isAdminContext = typeof url === 'string' && url.includes('/admin');
    const profileEndpoint = routeWithBase(isAdminContext ? '/admin/profile' : '/profile', app_base);
    const avatarSrc = user?.avatar ? storageUrl(user.avatar, app_url) : undefined;

    const { data, setData, patch, post, transform, errors, processing, recentlySuccessful } = useForm({
        name: user?.name ?? '',
        email: user?.email ?? '',
        phone: user?.phone ?? '',
        default_address: user?.default_address ?? '',
        avatar: null,
    });
    const [croppingImage, setCroppingImage] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(avatarSrc);

    const submit = (e) => {
        e.preventDefault();
        if (data.avatar instanceof File) {
            // Multipart + PATCH can drop fields in some PHP setups; use POST method spoof.
            transform((form) => ({
                ...form,
                _method: 'patch',
            }));
            post(profileEndpoint, {
                preserveScroll: true,
                forceFormData: true,
                onFinish: () => transform((form) => form),
            });
            return;
        }

        patch(profileEndpoint, {
            preserveScroll: true,
        });
    };

    useEffect(() => {
        if (!(data.avatar instanceof File)) {
            setAvatarPreview(avatarSrc);
            return undefined;
        }
        const url = URL.createObjectURL(data.avatar);
        setAvatarPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [data.avatar, avatarSrc]);

    const openCropper = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setCroppingImage(reader.result);
        reader.readAsDataURL(file);
    };

    const handleCropComplete = (croppedBlob) => {
        const ext = (data.avatar?.type || 'image/jpeg').includes('png') ? 'png' : 'jpg';
        const cropped = new File([croppedBlob], `avatar-crop.${Date.now()}.${ext}`, {
            type: croppedBlob.type || 'image/jpeg',
        });
        setData('avatar', cropped);
        setCroppingImage(null);
    };

    if (!user) {
        return (
            <Box component="section" className={className}>
                <Alert severity="warning" variant="outlined">
                    {t('Please sign in again to manage your profile.')}
                </Alert>
            </Box>
        );
    }

    return (
        <Box component="section" className={className}>
            <Stack spacing="6px">
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {t('Profile Information')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t("Update your account's profile information and email address.")}
                </Typography>
            </Stack>

            <Box component="form" onSubmit={submit} sx={{ mt: '20px' }}>
                <Stack spacing="16px">
                    {!isAdminContext && (
                        <Stack spacing="8px">
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                {t('Profile photo')}
                            </Typography>
                            <ButtonBase
                                component="label"
                                focusRipple
                                sx={{
                                    width: '100%',
                                    maxWidth: 520,
                                    justifyContent: 'flex-start',
                                    alignItems: 'center',
                                    gap: { xs: '12px', sm: '16px' },
                                    p: '12px',
                                    border: '1px solid',
                                    borderColor: errors.avatar ? 'error.main' : 'divider',
                                    borderRadius: 2,
                                    bgcolor: 'background.paper',
                                    textAlign: 'left',
                                    transition: 'border-color .18s ease, background-color .18s ease, box-shadow .18s ease',
                                    '&:hover': {
                                        borderColor: 'primary.main',
                                        bgcolor: 'action.hover',
                                        boxShadow: '0 8px 24px rgba(15,23,42,.06)',
                                    },
                                    '&.Mui-focusVisible': {
                                        outline: '3px solid',
                                        outlineColor: 'primary.light',
                                        outlineOffset: 2,
                                    },
                                }}
                            >
                                <Box sx={{ position: 'relative', flexShrink: 0 }}>
                                    <Avatar
                                        src={avatarPreview}
                                        sx={{
                                            width: { xs: 72, sm: 84 },
                                            height: { xs: 72, sm: 84 },
                                            borderRadius: 2.5,
                                            bgcolor: 'primary.main',
                                            color: 'primary.contrastText',
                                            fontSize: '1.35rem',
                                            fontWeight: 700,
                                            border: '3px solid',
                                            borderColor: 'background.paper',
                                            boxShadow: '0 6px 18px rgba(15,23,42,.14)',
                                        }}
                                    >
                                        {user.name?.charAt(0)?.toUpperCase()}
                                    </Avatar>
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            right: -4,
                                            bottom: -4,
                                            width: 34,
                                            height: 34,
                                            display: 'grid',
                                            placeItems: 'center',
                                            borderRadius: '50%',
                                            bgcolor: 'primary.main',
                                            color: 'primary.contrastText',
                                            border: '3px solid',
                                            borderColor: 'background.paper',
                                            boxShadow: '0 4px 12px rgba(15,23,42,.18)',
                                        }}
                                    >
                                        <PhotoCamera sx={{ fontSize: 17 }} />
                                    </Box>
                                </Box>
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                        {t('Change profile photo')}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: '3px' }}>
                                        {t('Choose a clear square image. JPG, PNG, WebP or GIF, up to 4MB.')}
                                    </Typography>
                                    {data.avatar instanceof File && (
                                        <Typography
                                            variant="caption"
                                            color="primary"
                                            display="block"
                                            noWrap
                                            sx={{ mt: '5px', fontWeight: 600 }}
                                        >
                                            {t('Selected')}: {data.avatar.name}
                                        </Typography>
                                    )}
                                </Box>
                                <input
                                    type="file"
                                    name="avatar"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    hidden
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) {
                                            setData('avatar', f);
                                            openCropper(f);
                                        } else {
                                            setData('avatar', null);
                                        }
                                        e.target.value = '';
                                    }}
                                />
                            </ButtonBase>
                            {errors.avatar && (
                                <Typography variant="caption" color="error" display="block">
                                    {errors.avatar}
                                </Typography>
                            )}
                        </Stack>
                    )}

                    <TextField
                        id="name"
                        label={t('Name')}
                        fullWidth
                        required
                        autoComplete="name"
                        autoFocus={isAdminContext}
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        error={Boolean(errors.name)}
                        helperText={errors.name}
                    />

                    <TextField
                        id="email"
                        type="email"
                        label={t('Email')}
                        fullWidth
                        required
                        autoComplete="username"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        error={Boolean(errors.email)}
                        helperText={errors.email}
                    />

                    {!isAdminContext && (
                        <>
                            <TextField
                                id="phone"
                                label={t('Phone number')}
                                fullWidth
                                autoComplete="tel"
                                value={data.phone}
                                onChange={(e) => setData('phone', e.target.value)}
                                error={Boolean(errors.phone)}
                                helperText={errors.phone || t('Used for shipping and order updates.')}
                            />
                            <TextField
                                id="default_address"
                                label={t('Default shipping address')}
                                fullWidth
                                multiline
                                minRows={3}
                                value={data.default_address}
                                onChange={(e) => setData('default_address', e.target.value)}
                                error={Boolean(errors.default_address)}
                                helperText={errors.default_address || t('Prefills checkout. You can still edit each order.')}
                            />
                        </>
                    )}

                    {mustVerifyEmail && user.email_verified_at === null && (
                        <Stack spacing={1}>
                            <Alert severity="warning" variant="outlined">
                                {t('Your email address is unverified.')}
                            </Alert>
                            <Typography variant="body2">
                                <Link
                                    href={routeWithBase('/email/verification-notification', app_base)}
                                    method="post"
                                    as="button"
                                    className="text-sm text-primary-600 underline"
                                >
                                    {t('Re-send verification email')}
                                </Link>
                            </Typography>
                            {status === 'verification-link-sent' && (
                                <Alert severity="success" variant="outlined">
                                    {t('A new verification link has been sent to your email address.')}
                                </Alert>
                            )}
                        </Stack>
                    )}

                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <Button type="submit" variant="contained" disabled={processing}>
                            {t('Save')}
                        </Button>
                        <Transition
                            show={recentlySuccessful}
                            enterFrom="opacity-0"
                            leaveTo="opacity-0"
                            className="transition ease-in-out"
                        >
                            <Typography variant="body2" color="text.secondary">
                                {t('Saved.')}
                            </Typography>
                        </Transition>
                    </Stack>
                </Stack>
            </Box>
            <CropImageModal
                open={!!croppingImage}
                image={croppingImage}
                onCropComplete={handleCropComplete}
                onCancel={() => setCroppingImage(null)}
                aspect={1}
            />
        </Box>
    );
}
