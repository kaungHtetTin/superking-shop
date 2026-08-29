import { useEffect } from 'react';
import CustomerAuthShell from '@/Components/User/CustomerAuthShell';
import PwaHeadTags from '@/Components/User/PwaHeadTags';
import { Head, useForm, usePage } from '@/spa/router';
import { Button, Stack, TextField } from '@mui/material';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function ResetPassword({ token, email }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const { data, setData, post, processing, errors, reset } = useForm({ token, email, password: '', password_confirmation: '' });
    useEffect(() => () => reset('password', 'password_confirmation'), []);
    const submit = (event) => { event.preventDefault(); post(routeWithBase('/reset-password', app_base)); };
    return <CustomerAuthShell title={t('Choose a new password')} subtitle={t('Use at least eight characters and avoid a password you use elsewhere.')}>
        <Head title={t('Reset Password')}><PwaHeadTags /></Head>
        <form onSubmit={submit}><Stack spacing="16px">
            <TextField fullWidth type="email" label={t('Email address')} value={data.email} onChange={(e) => setData('email', e.target.value)} error={Boolean(errors.email)} helperText={errors.email} autoComplete="username" />
            <TextField autoFocus fullWidth type="password" label={t('New password')} value={data.password} onChange={(e) => setData('password', e.target.value)} error={Boolean(errors.password)} helperText={errors.password} autoComplete="new-password" />
            <TextField fullWidth type="password" label={t('Confirm new password')} value={data.password_confirmation} onChange={(e) => setData('password_confirmation', e.target.value)} error={Boolean(errors.password_confirmation)} helperText={errors.password_confirmation} autoComplete="new-password" />
            <Button fullWidth type="submit" variant="contained" size="large" disabled={processing}>{t(processing ? 'Updating...' : 'Reset password')}</Button>
        </Stack></form>
    </CustomerAuthShell>;
}
