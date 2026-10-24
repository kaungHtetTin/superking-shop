import { useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { router, usePage } from '@/spa/router';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function VoucherEditDialog({ open, order, onClose, onSaved }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const makeData = () => ({
        receiver_name: order?.receiver_name || order?.user?.name || '',
        receiver_phone: order?.receiver_phone || order?.user?.phone || '',
        order_notes: order?.order_notes || '',
        payment_references: Object.fromEntries((order?.payments || []).map((payment) => [payment.id, payment.payment_details?.reference || ''])),
    });
    const [data, setData] = useState(makeData);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setData(makeData());
            setErrors({});
        }
    }, [open, order?.id]);

    const submit = (event) => {
        event.preventDefault();
        setSaving(true);
        setErrors({});
        router.patch(routeWithBase(`/admin/orders/${order.id}/voucher`, app_base), data, {
            preserveScroll: true,
            onSuccess: (response) => {
                onClose();
                onSaved?.(response);
                window.dispatchEvent(new CustomEvent('admin:notice', { detail: { message: t(response?.message || 'Voucher details updated.'), type: 'success' } }));
                router.reload({ preserveScroll: true, showSkeleton: false });
            },
            onError: setErrors,
            onFinish: () => setSaving(false),
        });
    };

    return <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={submit}>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                <span>{t('Edit voucher')}{order?.order_number ? ` — ${order.order_number}` : ''}</span>
                <IconButton size="small" onClick={onClose} disabled={saving}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={1.5} sx={{ pt: 0.5 }}>
                    {errors.voucher && <Alert severity="error">{t(errors.voucher)}</Alert>}
                    <TextField required autoFocus size="small" label={t('Customer name')} value={data.receiver_name}
                        onChange={(event) => setData((current) => ({ ...current, receiver_name: event.target.value }))}
                        error={Boolean(errors.receiver_name)} helperText={errors.receiver_name} fullWidth />
                    <TextField size="small" label={t('Customer phone')} value={data.receiver_phone}
                        onChange={(event) => setData((current) => ({ ...current, receiver_phone: event.target.value }))}
                        error={Boolean(errors.receiver_phone)} helperText={errors.receiver_phone} fullWidth />
                    {(order?.payments || []).filter((payment) => (payment.tender_type || payment.method) === 'mmqr').map((payment) => (
                        <TextField key={payment.id} size="small" label={`${t('MMQR transaction reference')} · ${Number(payment.amount || 0).toLocaleString()} MMK`}
                            value={data.payment_references?.[payment.id] || ''}
                            onChange={(event) => setData((current) => ({ ...current, payment_references: { ...current.payment_references, [payment.id]: event.target.value } }))}
                            inputProps={{ maxLength: 100 }} fullWidth />
                    ))}
                    <TextField size="small" label={t('Receipt note')} value={data.order_notes}
                        onChange={(event) => setData((current) => ({ ...current, order_notes: event.target.value }))}
                        error={Boolean(errors.order_notes)} helperText={errors.order_notes} multiline minRows={3} fullWidth />
                    <Alert severity="info">{t('This updates voucher details only. Items, totals, stock, and payment amounts do not change.')}</Alert>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button type="button" variant="outlined" onClick={onClose} disabled={saving}>{t('Cancel')}</Button>
                <Button type="submit" variant="contained" disabled={saving}>{t(saving ? 'Saving...' : 'Save voucher')}</Button>
            </DialogActions>
        </Box>
    </Dialog>;
}
