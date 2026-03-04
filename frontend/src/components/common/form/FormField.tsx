import { type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';

const inputBase =
  'w-full px-3 py-2 bg-[var(--control-input-bg)] border border-[var(--control-input-border)] rounded-lg text-[var(--control-input-text)] placeholder:text-[var(--control-input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--control-input-ring)] disabled:opacity-50';

interface FormFieldProps {
  label: string;
  id?: string;
  error?: string;
  hint?: string;
  children?: React.ReactNode;
}

export function FormFieldRoot({
  label,
  id,
  error,
  hint,
  children,
}: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--control-label-text)] mb-2"
      >
        {label}
      </label>
      {children}
      {hint && <p className="text-[var(--control-hint-text)] text-xs mt-1">{hint}</p>}
      {error && (
        <p className="text-[var(--control-error-text)] text-sm mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface InputFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string;
  id?: string;
  error?: string;
  hint?: string;
}

export function FormFieldInput({
  label,
  id,
  error,
  hint,
  ...inputProps
}: InputFieldProps) {
  const fid = id ?? `field-${label.replace(/\s/g, '-')}`;
  return (
    <FormFieldRoot label={label} id={fid} error={error} hint={hint}>
      <input id={fid} className={inputBase} {...inputProps} />
    </FormFieldRoot>
  );
}

interface SelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  label: string;
  id?: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
}

export function FormFieldSelect({
  label,
  id,
  error,
  hint,
  options,
  ...selectProps
}: SelectFieldProps) {
  const fid = id ?? `field-${label.replace(/\s/g, '-')}`;
  return (
    <FormFieldRoot label={label} id={fid} error={error} hint={hint}>
      <select id={fid} className={inputBase} {...selectProps}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FormFieldRoot>
  );
}
