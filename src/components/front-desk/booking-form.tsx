"use client";

import { useActionState, useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, DetailList } from "@/components/ui/card";
import { CONTROL_CLASS, Fieldset } from "@/components/ui/field";
import { formatManilaTime } from "@/lib/appointments/format";
import { bookForPatientAction, type BookingFormState } from "@/server/front-desk/actions";

import { SlotChips } from "./slot-chips";

const IDLE_STATE: BookingFormState = { status: "idle" };

/**
 * Picks a slot, reviews, and books a confirmed appointment for the patient
 * (SPEC-frontdesk §7 steps 6–8). `slots` comes from the doctor's real
 * availability; the database re-checks the chosen slot. The staff member is
 * taken from the session on the server, never from this form.
 *
 * Laid out as the reference: the steps on the left and a sticky summary with
 * the submit button on the right. The page's patient step and doctor/date
 * (GET) form render inside the left column, outside this POST form, so the
 * slot radios and reason join the form through the `form` attribute.
 */
export function BookingForm({
  patientId,
  patientName,
  doctorId,
  doctorName,
  specialtyId,
  dateLabel,
  slots,
  patientStep,
  doctorControl,
  noDoctorMessage = "Choose a doctor and a date, then show the free slots.",
}: {
  patientId: string;
  patientName: string;
  doctorId: string | null;
  doctorName: string | null;
  specialtyId: string | null;
  dateLabel: string;
  slots: readonly { start: string; end: string }[];
  patientStep?: ReactNode;
  doctorControl?: ReactNode;
  noDoctorMessage?: string;
}) {
  const formId = useId();
  const [state, formAction, pending] = useActionState(bookForPatientAction, IDLE_STATE);
  const [chosenStart, setChosenStart] = useState<string | null>(null);
  const canBook = doctorId !== null && slots.length > 0;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        {patientStep}
        <Fieldset legend="2 · Doctor and time">
          {doctorControl}
          {doctorId === null ? (
            <p className="text-sm text-ink-muted">{noDoctorMessage}</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-ink-muted">No free slots on this date. Choose another date.</p>
          ) : (
            <SlotChips
              legend={`Free times with ${doctorName} · ${dateLabel}`}
              name="scheduledAt"
              slots={slots}
              onSelect={setChosenStart}
              form={formId}
            />
          )}
        </Fieldset>
        {canBook ? (
          <Fieldset legend="3 · Visit details">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="booking-reason" className="text-sm font-medium text-ink">
                Reason for visit (optional)
              </label>
              <textarea
                id="booking-reason"
                name="reason"
                rows={3}
                maxLength={500}
                form={formId}
                className={`${CONTROL_CLASS} py-2 leading-6`}
              />
            </div>
          </Fieldset>
        ) : null}
      </div>

      <Card aria-labelledby="booking-review-title" className="shadow-card xl:sticky xl:top-6">
        <CardHeader id="booking-review-title" title="Review" />
        <DetailList
          termWidth="4.5rem"
          items={[
            ["Patient", patientName],
            ["Doctor", doctorName ?? "Not chosen"],
            [
              "When",
              chosenStart ? `${dateLabel}, ${formatManilaTime(chosenStart)}` : `${dateLabel} · Choose a time`,
            ],
            ["Source", "Front desk"],
          ]}
        />
        {canBook ? (
          <form id={formId} action={formAction} className="mt-5 flex flex-col gap-2">
            <input type="hidden" name="patientId" value={patientId} />
            <input type="hidden" name="doctorId" value={doctorId} />
            <input type="hidden" name="specialtyId" value={specialtyId ?? ""} />
            {state.status === "error" ? (
              <p role="alert" className="text-sm text-danger-soft-ink">
                {state.message}
              </p>
            ) : null}
            <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending || undefined}>
              {pending ? "Booking…" : "Book and confirm"}
            </Button>
          </form>
        ) : null}
        <p className="mt-2 text-center text-xs text-ink-muted">
          The appointment is confirmed as soon as it is booked.
        </p>
      </Card>
    </div>
  );
}
