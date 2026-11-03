"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatManilaTime } from "@/lib/appointments/format";
import { bookForPatientAction, type BookingFormState } from "@/server/front-desk/actions";

const IDLE_STATE: BookingFormState = { status: "idle" };


/**
 * Picks a slot, reviews, and books a confirmed appointment for the patient
 * (SPEC-frontdesk §7 steps 6–8). `slots` comes from the doctor's real
 * availability; the database re-checks the chosen slot. The staff member is
 * taken from the session on the server, never from this form.
 */
export function BookingForm({
  patientId,
  patientName,
  doctorId,
  doctorName,
  specialtyId,
  dateLabel,
  slots,
}: {
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  specialtyId: string | null;
  dateLabel: string;
  slots: readonly { start: string; end: string }[];
}) {
  const [state, formAction, pending] = useActionState(bookForPatientAction, IDLE_STATE);
  const [chosenStart, setChosenStart] = useState<string | null>(null);

  if (slots.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No free slots on this date. Choose another date.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="doctorId" value={doctorId} />
      <input type="hidden" name="specialtyId" value={specialtyId ?? ""} />
      <fieldset>
        <legend className="text-sm font-medium text-ink">Time</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {slots.map((slot) => (
            <label
              key={slot.start}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink pressable hover:bg-surface-muted has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
            >
              <input
                type="radio"
                name="scheduledAt"
                value={slot.start}
                required
                checked={chosenStart === slot.start}
                onChange={() => setChosenStart(slot.start)}
                className="size-4 accent-primary"
              />
              {formatManilaTime(slot.start)}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor="booking-reason" className="mt-4 block text-sm font-medium text-ink">
        Reason for visit (optional)
      </label>
      <textarea
        id="booking-reason"
        name="reason"
        rows={3}
        maxLength={500}
        className="mt-1 w-full rounded-lg border border-control-line bg-surface px-3 py-2 text-base text-ink focus-ring"
      />
      <section
        aria-labelledby="booking-review-title"
        className="mt-5 rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm"
      >
        <h3 id="booking-review-title" className="font-medium text-ink">
          Review
        </h3>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-ink-muted">Patient</dt>
          <dd className="text-ink">{patientName}</dd>
          <dt className="text-ink-muted">Doctor</dt>
          <dd className="text-ink">{doctorName}</dd>
          <dt className="text-ink-muted">When</dt>
          <dd className="text-ink">
            {chosenStart
              ? `${dateLabel}, ${formatManilaTime(chosenStart)}`
              : `${dateLabel} · Choose a time`}
          </dd>
        </dl>
        <p className="mt-2 text-ink-muted">
          The appointment is confirmed as soon as it is booked.
        </p>
      </section>
      {state.status === "error" ? (
        <p role="alert" className="mt-3 text-sm text-danger-soft-ink">
          {state.message}
        </p>
      ) : null}
      <div className="mt-5">
        <Button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? "Booking…" : "Book and confirm"}
        </Button>
      </div>
    </form>
  );
}
