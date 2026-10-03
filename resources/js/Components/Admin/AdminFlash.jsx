import { formatErrorMessage } from '@/Utils/formatErrorMessage';
import { usePhraseTranslation } from '@/Utils/i18n';

export function AdminFlash({ flash, errors = {} }) {
    const t = usePhraseTranslation();
    const errorMsg = errors.order || errors.status || errors.product || Object.values(errors)[0];

    return (
        <>
            {flash?.success && <div className="flash success">{t(flash.success)}</div>}
            {flash?.error && <div className="flash error">{t(flash.error)}</div>}
            {errorMsg && <div className="flash error">{t(formatErrorMessage(errorMsg))}</div>}
        </>
    );
}
