"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { registerAction } from "@/server/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

import { FormField } from "./form-field";

const INITIAL_STATE: AuthFormState = {};

export function RegisterForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(registerAction, INITIAL_STATE);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const summaryRef = useRef<HTMLParagraphElement>(null);

  const hasFieldErrors = Boolean(state.fieldErrors);
  const hasError = Boolean(state.formError) || hasFieldErrors;

  useEffect(() => {
    if (hasError) {
      summaryRef.current?.focus();
    }
  }, [hasError]);

  if (state.success) {
    return (
      <p
        role="status"
        className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm leading-6 text-ink-secondary text-pretty"
      >
        {state.success}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {state.formError ? (
        <p
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm leading-6 text-danger-soft-ink"
        >
          {state.formError}
        </p>
      ) : null}
      {hasFieldErrors && !state.formError ? (
        <p
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm leading-6 text-danger-soft-ink"
        >
          There was a problem with your submission. Fix the highlighted fields and
          try again.
        </p>
      ) : null}
      <form action={formAction} noValidate className="flex flex-col gap-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <p className="text-sm leading-6 text-ink-muted">All fields are required.</p>
        <FormField
          id="full-name"
          label="Full name"
          name="fullName"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          error={state.fieldErrors?.fullName}
        />
        <FormField
          id="email"
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={state.fieldErrors?.email}
        />
        {/* Uncontrolled: React resets them after the action so a failed submit
            never leaves the passwords in the DOM. */}
        <FormField
          id="password"
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          error={state.fieldErrors?.password}
        />
        <FormField
          id="confirm-password"
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          error={state.fieldErrors?.confirmPassword}
        />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
        >
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="text-sm leading-6 text-ink-secondary">
        Already have an account?{" "}
        <Link
          href="/login"
          className="rounded-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-ring"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
