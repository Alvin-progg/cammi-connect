"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { LinkButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/data";
import type { AuthFormState } from "@/lib/auth/form-state";
import { loginAction } from "@/server/auth/actions";

import { FormField } from "./form-field";
import { useMascot } from "./mascot-stage";
import { SubmitButton } from "./submit-button";

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
  const formRef = useRef<HTMLFormElement>(null);
  const { reportError } = useMascot();

  const errorMessage = state.formError ?? callbackError;

  // Redesign: a sign-in failure shows a destructive Alert above the fields
  // (same message for every failure) and the nurse reacts.
  useEffect(() => {
    if (errorMessage) reportError();
  }, [errorMessage, reportError]);

  useEffect(() => {
    if (!state.fieldErrors) return;
    reportError();
    formRef.current
      ?.querySelector<HTMLInputElement>('[aria-invalid="true"]')
      ?.focus();
  }, [state.fieldErrors, reportError]);

  return (
    <div className="flex flex-col gap-5.5">
      <form
        ref={formRef}
        action={formAction}
        noValidate
        className="flex flex-col gap-5"
      >
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {next ? <input type="hidden" name="next" value={next} /> : null}
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
        <SubmitButton pending={pending} label="Sign in" pendingLabel="Signing in…" />
      </form>
      <p className="flex items-center gap-3 text-xs text-ink-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        or
      </p>
      <LinkButton variant="outline" size="lg" href="/register" className="w-full">
        Create a patient account
      </LinkButton>
      <p className="text-center text-xs leading-[18px] text-ink-muted">
        Staff accounts are created by an administrator. Check your invite email to set your password.
      </p>
    </div>
  );
}
