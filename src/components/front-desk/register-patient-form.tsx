"use client";

import { useActionState } from "react";

import { CONTROL_CLASS as KIT_CONTROL_CLASS } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { registerPatientAction, type BookingFormState } from "@/server/front-desk/actions";

const IDLE_STATE: BookingFormState = { status: "idle" };

const FIELD_LABEL_CLASS = "text-sm font-medium text-ink";
const CONTROL_CLASS = `mt-1.5 ${KIT_CONTROL_CLASS}`;

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
        <Button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? "Registering…" : "Register patient"}
        </Button>
      </div>
    </form>
  );
}
