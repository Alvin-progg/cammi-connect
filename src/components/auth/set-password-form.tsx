"use client";

import { useActionState } from "react";

import type { AuthFormState } from "@/lib/auth/form-state";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/schemas";
import { updatePasswordAction } from "@/server/auth/actions";

import { FormField } from "./form-field";
import { SubmitButton } from "./submit-button";

const INITIAL_STATE: AuthFormState = {};

/** New-password form for staff invites and password resets. */
export function SetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, INITIAL_STATE);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.formError ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-soft-ink">
          {state.formError}
        </p>
      ) : null}
      {/* Uncontrolled, so React clears them after the action and a failed
          submit never leaves the passwords in the DOM. */}
      <FormField
        id="password"
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint={`Use at least ${PASSWORD_MIN_LENGTH} characters.`}
        error={state.fieldErrors?.password}
      />
      <FormField
        id="confirm-password"
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton pending={pending} label="Set password" pendingLabel="Saving…" />
    </form>
  );
}
