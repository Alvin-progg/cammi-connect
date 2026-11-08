"use client";

import { useState, type ChangeEvent } from "react";

import { CircleAlertIcon, EyeIcon, EyeOffIcon } from "lucide-react";

import { Input, Label } from "@/components/ui/field";

import { useMascot } from "./mascot-stage";

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
  const { setPasswordRevealed } = useMascot();
  const isPassword = type === "password";
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div
      className="flex flex-col gap-1.5"
      data-mascot-field={name}
      data-mascot-secret={isPassword ? "true" : undefined}
    >
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={isPassword && revealed ? "text" : type}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={isPassword ? "h-11 pr-11 text-base sm:text-sm" : "h-11 text-base sm:text-sm"}
        />
        {isPassword ? (
          <button
            type="button"
            aria-controls={id}
            aria-pressed={revealed}
            onClick={() => {
              setRevealed(!revealed);
              setPasswordRevealed(name, !revealed);
            }}
            className="focus-ring absolute right-1 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink motion-reduce:transition-none"
          >
            {revealed ? (
              <EyeOffIcon aria-hidden="true" className="size-4.5" />
            ) : (
              <EyeIcon aria-hidden="true" className="size-4.5" />
            )}
            <span className="sr-only">
              {`${revealed ? "Hide" : "Show"} ${label.toLowerCase()}`}
            </span>
          </button>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-sm text-danger"
        >
          <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="sr-only">Error:</span>{" "}
          <span>{error[0]}</span>
        </p>
      ) : null}
    </div>
  );
}
