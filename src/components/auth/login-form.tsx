"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { loginAction } from "@/server/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { LOGIN_ERROR_TOAST_ID } from "@/lib/auth/toast-ids";

import { FormField } from "./form-field";
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

  const errorMessage = state.formError ?? callbackError;

  useEffect(() => {
    if (!errorMessage) return;
    toast.error("Sign-in failed", {
      id: LOGIN_ERROR_TOAST_ID,
      description: errorMessage,
      duration: 8000,
    });
    return () => {
      toast.dismiss(LOGIN_ERROR_TOAST_ID);
    };
  }, [errorMessage]);

  useEffect(() => {
    if (!state.fieldErrors) return;
    formRef.current
      ?.querySelector<HTMLInputElement>('[aria-invalid="true"]')
      ?.focus();
  }, [state.fieldErrors]);

  return (
    <div className="flex flex-col gap-6">
      <form
        ref={formRef}
        action={formAction}
        noValidate
        className="flex flex-col gap-5"
      >
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
      <p className="border-t border-line pt-6 text-center text-sm leading-6 text-ink-secondary">
        No account yet?{" "}
        <Link
          href="/register"
          className="rounded-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:text-primary-hover hover:decoration-current focus-ring motion-reduce:transition-none"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
