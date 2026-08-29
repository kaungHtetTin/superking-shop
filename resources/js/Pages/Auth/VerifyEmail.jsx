import CustomerAuthShell from '@/Components/User/CustomerAuthShell';
import { Head, Link, useForm, usePage } from '@/spa/router';
import { Alert, Button, Stack } from '@mui/material';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function VerifyEmail({ status }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const { post, processing } = useForm({});
    const submit = (event) => { event.preventDefault(); post(routeWithBase('/email/verification-notification', app_base)); };
    return <CustomerAuthShell title={t('Verify your email')} subtitle={t('Open the verification link we sent to your email address. If it did not arrive, request another below.')}>
        <Head title={t('Email Verification')} />
        <form onSubmit={submit}><Stack spacing="16px">
            {status === 'verification-link-sent' && <Alert severity="success">{t('A new verification link has been sent to your email address.')}</Alert>}
            <Button fullWidth type="submit" variant="contained" size="large" disabled={processing}>{t(processing ? 'Sending...' : 'Resend verification email')}</Button>
            <Button component={Link} href={routeWithBase('/logout', app_base)} method="post" as="button" fullWidth color="inherit">{t('Log out')}</Button>
        </Stack></form>
    </CustomerAuthShell>;
}
