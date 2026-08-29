import { useEffect } from 'react';
import CustomerAuthShell from '@/Components/User/CustomerAuthShell';
import { Head, useForm, usePage } from '@/spa/router';
import { Button, Stack, TextField } from '@mui/material';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function ConfirmPassword() {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const { data, setData, post, processing, errors, reset } = useForm({ password: '' });
    useEffect(() => () => reset('password'), []);
    const submit = (event) => { event.preventDefault(); post(routeWithBase('/confirm-password', app_base)); };
    return <CustomerAuthShell title={t('Confirm your password')} subtitle={t('For your security, enter your password before continuing.')}>
        <Head title={t('Confirm Password')} />
        <form onSubmit={submit}><Stack spacing="16px">
            <TextField autoFocus fullWidth type="password" label={t('Password')} value={data.password} onChange={(e) => setData('password', e.target.value)} error={Boolean(errors.password)} helperText={errors.password} autoComplete="current-password" />
            <Button fullWidth type="submit" variant="contained" size="large" disabled={processing}>{t(processing ? 'Confirming...' : 'Confirm')}</Button>
        </Stack></form>
    </CustomerAuthShell>;
}
