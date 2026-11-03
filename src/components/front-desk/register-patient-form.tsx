"use client";

import { useActionState } from "react";

import { registerPatientAction, type BookingFormState } from "@/server/front-desk/actions";

const IDLE_STATE: BookingFormState = { status: "idle" };

const FIELD_LABEL_CLASS = "text-sm font-medium text-ink";
const CONTROL_CLASS =
  "mt-1 min-h-11 w-full rounded-lg border border-control-line bg-surface px-3 text-base text-ink focus-ring";
const PRIMARY_BUTTON =
  "focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-primary bg-primary px-4 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none";

/**
 * Registers a walk-in or phone-in patient as a record with no login
 * (SPEC-frontdesk §7 step 2). On success the server continues to booking.
 */
export function RegisterPatientForm() {
  const [state, formAction, pending] = useActionState(registerPatientAction, IDLE_STATE);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <div>
        <label htmlFor="register-full-name" className={FIELD_LABEL_CLASS}>
          Full name
        </label>
        <input
          id="register-full-name"
          name="fullName"
          type="text"
          required
          maxLength={120}
          autoComplete="off"
          className={CONTROL_CLASS}
        />
      </div>
      <div>
        <label htmlFor="register-phone" className={FIELD_LABEL_CLASS}>
          Phone number
        </label>
        <input
          id="register-phone"
          name="phone"
          type="tel"
          required
          maxLength={32}
          autoComplete="off"
          className={CONTROL_CLASS}
        />
      </div>
      <p className="text-sm text-ink-muted">
        No CamiConnect login is created. The phone number is how the hospital reaches
        the patient.
      </p>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-danger-soft-ink">
          {state.message}
        </p>
      ) : null}
      <div>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className={PRIMARY_BUTTON}
        >
          {pending ? "Registering…" : "Register patient"}
        </button>
      </div>
    </form>
  );
}
