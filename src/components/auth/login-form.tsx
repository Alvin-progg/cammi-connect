"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { loginAction } from "@/server/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

import { FormField } from "./form-field";

const INITIAL_STATE: AuthFormState = {};

export function LoginForm({
  next,
  callbackError,
}: {
  next?: string;
  callbackError?: string;
}) {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL_STATE);
  const [email, setEmail] = useState("");
  const summaryRef = useRef<HTMLParagraphElement>(null);

  const formError = state.formError ?? callbackError;
  const hasFieldErrors = Boolean(state.fieldErrors);
  const hasError = Boolean(formError) || hasFieldErrors;

  useEffect(() => {
    if (hasError) {
      summaryRef.current?.focus();
    }
  }, [hasError]);

  useEffect(() => {
    if (!state.formError) return;
    toast.error("Sign-in failed", {
      id: "login-error",
      description: state.formError,
      duration: 8000,
    });
    return () => {
      toast.dismiss("login-error");
    };
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      {formError ? (
        <p
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm leading-6 text-danger-soft-ink"
        >
          {formError}
        </p>
      ) : null}
      {hasFieldErrors && !formError ? (
        <p
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm leading-6 text-danger-soft-ink"
        >
          There was a problem with your submission. Fix the highlighted fields and
          try again.
        </p>
      ) : null}
      <form action={formAction} noValidate className="flex flex-col gap-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <p className="text-sm leading-6 text-ink-muted">All fields are required.</p>
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
        {/* Uncontrolled: React resets it after the action so a failed submit
            never leaves the password in the DOM. */}
        <FormField
          id="password"
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          error={state.fieldErrors?.password}
        />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-primary bg-primary px-4 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="text-sm leading-6 text-ink-secondary">
        No account yet?{" "}
        <Link
          href="/register"
          className="rounded-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-ring"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
