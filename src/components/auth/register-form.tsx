"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { registerAction } from "@/server/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/schemas";
import { REGISTER_ERROR_TOAST_ID } from "@/lib/auth/toast-ids";

import { CheckCircleIcon } from "./auth-icons";
import { FormField } from "./form-field";
import { SubmitButton } from "./submit-button";

const INITIAL_STATE: AuthFormState = {};

export function RegisterForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(registerAction, INITIAL_STATE);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.formError) return;
    toast.error("Could not create account", {
      id: REGISTER_ERROR_TOAST_ID,
      description: state.formError,
      duration: 8000,
    });
    return () => {
      toast.dismiss(REGISTER_ERROR_TOAST_ID);
    };
  }, [state.formError]);

  useEffect(() => {
    if (!state.fieldErrors) return;
    formRef.current
      ?.querySelector<HTMLInputElement>('[aria-invalid="true"]')
      ?.focus();
  }, [state.fieldErrors]);

  if (state.success) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl bg-success-soft px-4 py-4 text-sm leading-6 text-success-soft-ink text-pretty"
      >
        <CheckCircleIcon className="mt-0.5 size-5 shrink-0" />
        <p>{state.success}</p>
      </div>
    );
  }

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
          hint={`Use at least ${PASSWORD_MIN_LENGTH} characters.`}
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
        <SubmitButton
          pending={pending}
          label="Create account"
          pendingLabel="Creating account…"
        />
      </form>
      <p className="border-t border-line pt-6 text-center text-sm leading-6 text-ink-secondary">
        Already have an account?{" "}
        <Link
          href="/login"
          className="rounded-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:text-primary-hover hover:decoration-current focus-ring motion-reduce:transition-none"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
