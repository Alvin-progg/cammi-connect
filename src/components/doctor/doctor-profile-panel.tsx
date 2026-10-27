"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { toast } from "sonner";

import {
  updateDoctorProfileAction,
  type ProfileActionState,
} from "@/server/profiles/actions";

const IDLE_STATE: ProfileActionState = { status: "idle" };

export function ProfileContactForm({
  initialPhone,
  initialClinicNote,
}: {
  initialPhone: string;
  initialClinicNote: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateDoctorProfileAction,
    IDLE_STATE,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="profile-phone" className="text-sm font-medium text-ink">
          Contact number
        </label>
        <input
          id="profile-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={initialPhone}
          maxLength={32}
          placeholder="+63 43 555 0100"
          className="min-h-11 w-full rounded-lg border border-control-line bg-surface px-3 text-base text-ink placeholder:text-ink-muted focus-ring"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label
          htmlFor="profile-clinic-note"
          className="text-sm font-medium text-ink"
        >
          Clinic room / consultation note
        </label>
        <textarea
          id="profile-clinic-note"
          name="clinicNote"
          rows={3}
          maxLength={500}
          defaultValue={initialClinicNote}
          placeholder="e.g. Room 204, Outpatient Department"
          className="w-full rounded-lg border border-control-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-muted focus-ring"
        />
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-danger-soft-ink">
          {state.message}
        </p>
      ) : null}
      <div>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-primary bg-primary px-4 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
