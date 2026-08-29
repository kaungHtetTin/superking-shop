import { formatErrorMessage } from '@/Utils/formatErrorMessage';

export function AdminFlash({ flash, errors = {} }) {
    const errorMsg = errors.order || errors.status || errors.product || Object.values(errors)[0];

    return (
        <>
            {flash?.success && <div className="flash success">{flash.success}</div>}
            {flash?.error && <div className="flash error">{flash.error}</div>}
            {errorMsg && <div className="flash error">{formatErrorMessage(errorMsg)}</div>}
        </>
    );
}
