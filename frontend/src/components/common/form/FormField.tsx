import { type InputHTMLAttributes, type SelectHTMLAttributes } from "react";

const inputBase =
  "w-full rounded-[clamp(0.4rem,1vw,0.5rem)] bg-[var(--control-input-bg)] px-[clamp(0.625rem,1.5vw,0.75rem)] py-[clamp(0.4rem,1vw,0.5rem)] text-[var(--control-input-text)] placeholder:text-[var(--control-input-placeholder)] border border-[var(--control-input-border)] shadow-[var(--neu-inset-shadow)] focus:outline-none focus:ring-2 focus:ring-[var(--control-input-ring)] disabled:opacity-50";

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
    <div data-oid="-:u35xb">
      <label
        htmlFor={id}
        className="mb-[clamp(0.4rem,1vw,0.5rem)] block text-[clamp(0.75rem,1.8vw,0.875rem)] font-medium text-[var(--control-label-text)]"
        data-oid="-czwnhi"
      >
        {label}
      </label>
      {children}
      {hint && (
        <p
          className="mt-[clamp(0.2rem,0.7vw,0.25rem)] text-[clamp(0.65rem,1.5vw,0.75rem)] text-[var(--control-hint-text)]"
          data-oid="h.lpxj_"
        >
          {hint}
        </p>
      )}
      {error && (
        <p
          className="mt-[clamp(0.2rem,0.7vw,0.25rem)] text-[clamp(0.75rem,1.8vw,0.875rem)] text-[var(--control-error-text)]"
          role="alert"
          data-oid="w_in_wi"
        >
          {error}
        </p>
      )}
    </div>
  );
}

interface InputFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
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
  const fid = id ?? `field-${label.replace(/\s/g, "-")}`;
  return (
    <FormFieldRoot
      label={label}
      id={fid}
      error={error}
      hint={hint}
      data-oid="y1-0095"
    >
      <input
        id={fid}
        className={inputBase}
        {...inputProps}
        data-oid="qcgty.1"
      />
    </FormFieldRoot>
  );
}

interface SelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> {
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
  const fid = id ?? `field-${label.replace(/\s/g, "-")}`;
  return (
    <FormFieldRoot
      label={label}
      id={fid}
      error={error}
      hint={hint}
      data-oid="o:mge42"
    >
      <select
        id={fid}
        className={inputBase}
        {...selectProps}
        data-oid="_k.h1ku"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} data-oid="sajjmfo">
            {o.label}
          </option>
        ))}
      </select>
    </FormFieldRoot>
  );
}
