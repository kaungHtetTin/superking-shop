import CustomerAuthShell from '@/Components/User/CustomerAuthShell';
import PwaHeadTags from '@/Components/User/PwaHeadTags';
import { Head, useForm, usePage } from '@/spa/router';
import { Alert, Button, Stack, TextField } from '@mui/material';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function ForgotPassword({ status }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const { data, setData, post, processing, errors } = useForm({ email: '' });
    const submit = (event) => { event.preventDefault(); post(routeWithBase('/forgot-password', app_base)); };

    return <CustomerAuthShell title={t('Reset your password')} subtitle={t('Enter your email and we will send you a secure password reset link.')}>
        <Head title={t('Forgot Password')}><PwaHeadTags /></Head>
        <form onSubmit={submit}>
            <Stack spacing="16px">
                {status && <Alert severity="success">{status}</Alert>}
                <TextField autoFocus fullWidth type="email" label={t('Email address')} value={data.email} onChange={(e) => setData('email', e.target.value)} error={Boolean(errors.email)} helperText={errors.email} autoComplete="email" />
                <Button fullWidth type="submit" variant="contained" size="large" disabled={processing}>{t(processing ? 'Sending...' : 'Email password reset link')}</Button>
            </Stack>
        </form>
    </CustomerAuthShell>;
}
