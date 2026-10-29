"use client";

import { useState, type ChangeEvent } from "react";

import { AlertCircleIcon, EyeIcon, EyeOffIcon } from "./auth-icons";

export type FormFieldProps = {
  id: string;
  label: string;
  name: string;
  type: "email" | "password" | "text";
  autoComplete: string;
  /** Controlled fields keep their value across failed submits (e.g. email). */
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Help text shown under the label before the user submits. */
  hint?: string;
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
  hint,
  error,
}: FormFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={isPassword && revealed ? "text" : type}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`min-h-11 w-full rounded-lg border border-control-line bg-surface px-3 text-base text-ink transition-colors duration-150 placeholder:text-ink-muted focus:border-primary focus-ring motion-reduce:transition-none aria-[invalid=true]:border-danger [@media(hover:hover)]:hover:border-ink-muted ${
            isPassword ? "pr-12" : ""
          }`}
        />
        {isPassword ? (
          <button
            type="button"
            aria-controls={id}
            aria-pressed={revealed}
            onClick={() => setRevealed((current) => !current)}
            className="focus-ring absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:text-ink motion-reduce:transition-none"
          >
            {revealed ? (
              <EyeOffIcon className="size-5" />
            ) : (
              <EyeIcon className="size-5" />
            )}
            <span className="sr-only">
              {`${revealed ? "Hide" : "Show"} ${label.toLowerCase()}`}
            </span>
          </button>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="text-sm leading-6 text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-sm leading-6 text-danger"
        >
          <AlertCircleIcon className="mt-1 size-4 shrink-0" />
          <span className="sr-only">Error:</span>{" "}
          <span>{error[0]}</span>
        </p>
      ) : null}
    </div>
  );
}
