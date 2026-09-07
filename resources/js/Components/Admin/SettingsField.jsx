/** Native admin field adapter; customer forms continue using MUI TextField. */
export default function SettingsField({ id, label, inputRef, error, helperText, slotProps, fullWidth, ...props }) {
    const helpId = `${id}-help`;
    return <div className="form-field settings-account-field">
        <label htmlFor={id}>{label}{props.required && <span aria-hidden="true"> *</span>}</label>
        <div className="settings-input-with-action">
            <input {...props} id={id} ref={inputRef} aria-invalid={error || undefined} aria-describedby={helperText ? helpId : undefined} />
            {slotProps?.input?.endAdornment}
        </div>
        {helperText && <small id={helpId} className={error ? 'field-error' : 'muted'}>{helperText}</small>}
    </div>;
}
