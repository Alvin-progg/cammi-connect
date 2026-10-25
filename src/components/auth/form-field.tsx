import type { ChangeEvent } from "react";

export type FormFieldProps = {
  id: string;
  label: string;
  name: string;
  type: "email" | "password" | "text";
  autoComplete: string;
  /** Controlled fields keep their value across failed submits (e.g. email). */
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  error?: string[];
};

export function FormField({
  id,
  label,
  name,
  type,
  autoComplete,
  value,
  onChange,
  error,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="min-h-11 w-full rounded-lg border border-control-line bg-surface px-3 text-base text-ink placeholder:text-ink-muted focus-ring aria-[invalid=true]:border-danger"
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm leading-6 text-danger">
          {error[0]}
        </p>
      ) : null}
    </div>
  );
}
