"use client";

import Link from "next/link";
import { useState } from "react";

import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { formatManilaDate, formatManilaTime } from "@/lib/appointments/format";
import { manilaDateOf } from "@/lib/chat/booking";
import type { BookingEvent, ChatMessagePayload, DoctorOption } from "@/lib/chat/schemas";

import { CheckIcon, ChevronRightIcon } from "./icons";

export type BookingPayload = Extract<
  ChatMessagePayload,
  { kind: "specialty_options" | "doctor_options" | "slot_picker" | "booking_summary" | "booking_result" }
>;

const BOOKING_KINDS = new Set<ChatMessagePayload["kind"]>([
  "specialty_options",
  "doctor_options",
  "slot_picker",
  "booking_summary",
  "booking_result",
]);

export function isBookingPayload(payload: ChatMessagePayload): payload is BookingPayload {
  return BOOKING_KINDS.has(payload.kind);
}

type CardProps = {
  /** Only the latest assistant message's card accepts actions. */
  interactive: boolean;
  /** A chat request is in flight. */
  busy: boolean;
  onEvent: (event: BookingEvent) => void;
};

const BUTTON_BASE =
  "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none";
const PRIMARY_BUTTON = `${BUTTON_BASE} border-primary bg-primary text-primary-ink hover:bg-primary-hover`;
const SECONDARY_BUTTON = `${BUTTON_BASE} border-line-strong bg-surface text-primary hover:bg-primary-soft`;
const GHOST_BUTTON = `${BUTTON_BASE} border-transparent bg-transparent text-ink hover:bg-surface-muted`;

/**
 * Booking cards shown under an assistant reply (AI-APT-001 S3). Every value
 * comes from the server payload, which is built from database rows; cards
 * only send IDs back, and the server re-checks each one.
 */
export function BookingCard({ payload, ...props }: CardProps & { payload: BookingPayload }) {
  switch (payload.kind) {
    case "specialty_options":
      return <SpecialtyOptions specialties={payload.specialties} {...props} />;
    case "doctor_options":
      return <DoctorOptions doctors={payload.doctors} label="Doctors" {...props} />;
    case "slot_picker":
      return <SlotPicker payload={payload} {...props} />;
    case "booking_summary":
      return <BookingSummary payload={payload} {...props} />;
    case "booking_result":
      return <BookingResult payload={payload} />;
  }
}

function SpecialtyOptions({
  specialties,
  interactive,
  busy,
  onEvent,
}: CardProps & { specialties: { id: string; name: string }[] }) {
  return (
    <ul aria-label="Specialties" className="mt-3 flex flex-wrap gap-2">
      {specialties.map((specialty) => (
        <li key={specialty.id}>
          <button
            type="button"
            disabled={!interactive || busy}
            onClick={() => onEvent({ type: "select_specialty", specialtyId: specialty.id })}
            className={SECONDARY_BUTTON}
          >
            {specialty.name}
          </button>
        </li>
      ))}
    </ul>
  );
}

function DoctorOptions({
  doctors,
  label,
  interactive,
  busy,
  onEvent,
}: CardProps & { doctors: DoctorOption[]; label: string }) {
  return (
    <ul aria-label={label} className="mt-3 space-y-2">
      {doctors.map((doctor) => {
        const details = [doctor.departmentName, doctor.specialties.join(", ")]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={doctor.id}>
            <button
              type="button"
              disabled={!interactive || busy}
              onClick={() => onEvent({ type: "select_doctor", doctorId: doctor.id })}
              aria-label={`Choose ${doctor.name}${details ? `, ${details}` : ""}`}
              className="focus-ring flex min-h-11 w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
            >
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-medium text-ink">{doctor.name}</span>
                {details ? (
                  <span className="block break-words text-xs text-ink-muted">{details}</span>
                ) : null}
              </span>
              <ChevronRightIcon className="size-4 shrink-0 text-ink-muted" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SlotPicker({
  payload,
  interactive,
  busy,
  onEvent,
}: CardProps & { payload: Extract<BookingPayload, { kind: "slot_picker" }> }) {
  const [pickedStart, setPickedStart] = useState<string | null>(null);
  const disabled = !interactive || busy;

  return (
    <div className="mt-3 space-y-4">
      {payload.days.map((day) => (
        <div key={day.date} role="group" aria-labelledby={`slots-${day.date}`}>
          <p id={`slots-${day.date}`} className="text-xs font-medium text-ink-secondary">
            {formatManilaDate(day.date)}
          </p>
          <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {day.slots.map((slot) => {
              const picked = slot.start === pickedStart;
              return (
                <li key={slot.start}>
                  <button
                    type="button"
                    aria-pressed={picked}
                    disabled={disabled}
                    onClick={() => {
                      setPickedStart(slot.start);
                      onEvent({ type: "select_slot", start: slot.start });
                    }}
                    className={`focus-ring inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-lg px-2 text-sm font-medium tabular-nums transition-colors disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none ${
                      picked
                        ? "border-2 border-primary bg-primary-soft text-ink"
                        : "border border-line-strong bg-surface text-ink hover:bg-primary-soft"
                    }`}
                  >
                    {picked ? <CheckIcon className="size-4 text-primary" /> : null}
                    {formatManilaTime(slot.start)}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {payload.days.length > 0 ? (
        <p className="text-xs text-ink-muted">Times are in Philippine time (Asia/Manila).</p>
      ) : null}

      {payload.nextFromDate ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (payload.nextFromDate) onEvent({ type: "more_slots", fromDate: payload.nextFromDate });
          }}
          className={SECONDARY_BUTTON}
        >
          Show later dates
        </button>
      ) : null}

      {payload.alternatives.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-ink-secondary">Other doctors</p>
          <DoctorOptions
            doctors={payload.alternatives}
            label="Other doctors"
            interactive={interactive}
            busy={busy}
            onEvent={onEvent}
          />
        </div>
      ) : null}
    </div>
  );
}

function SummaryRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-ink-muted">{term}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

function BookingSummary({
  payload,
  interactive,
  busy,
  onEvent,
}: CardProps & { payload: Extract<BookingPayload, { kind: "booking_summary" }> }) {
  const [confirming, setConfirming] = useState(false);
  const disabled = !interactive || busy;
  const pendingConfirm = busy && confirming;

  return (
    <div className="mt-3 rounded-lg border border-line bg-surface-muted p-3">
      <dl className="space-y-1.5 text-sm">
        <SummaryRow term="Doctor">{payload.doctorName}</SummaryRow>
        {payload.specialtyName ? (
          <SummaryRow term="Specialty">{payload.specialtyName}</SummaryRow>
        ) : null}
        <SummaryRow term="Date">{formatManilaDate(manilaDateOf(payload.start))}</SummaryRow>
        <SummaryRow term="Time">
          {formatManilaTime(payload.start)} – {formatManilaTime(payload.end)} (Asia/Manila)
        </SummaryRow>
        {payload.reason ? <SummaryRow term="Reason">{payload.reason}</SummaryRow> : null}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          aria-busy={pendingConfirm || undefined}
          onClick={() => {
            setConfirming(true);
            onEvent({ type: "confirm_booking" });
          }}
          className={PRIMARY_BUTTON}
        >
          {pendingConfirm ? "Booking…" : "Confirm booking"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onEvent({ type: "change_booking", field: "slot" })}
          className={SECONDARY_BUTTON}
        >
          Change time
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onEvent({ type: "change_booking", field: "doctor" })}
          className={GHOST_BUTTON}
        >
          Change doctor
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onEvent({ type: "cancel_booking" })}
          className={GHOST_BUTTON}
        >
          Stop booking
        </button>
      </div>
      {interactive ? null : (
        <p className="mt-2 text-xs text-ink-muted">This summary is from earlier in the chat.</p>
      )}
    </div>
  );
}

/** Never says "confirmed": the doctor still has to accept the request (design.md §6.3). */
function BookingResult({ payload }: { payload: Extract<BookingPayload, { kind: "booking_result" }> }) {
  return (
    <div className="mt-3 rounded-lg border border-line bg-surface-muted p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Request received</p>
        <AppointmentStatusBadge status="requested" />
      </div>
      <dl className="mt-2 space-y-1.5 text-sm">
        <SummaryRow term="Doctor">{payload.doctorName}</SummaryRow>
        <SummaryRow term="Date">{formatManilaDate(manilaDateOf(payload.start))}</SummaryRow>
        <SummaryRow term="Time">
          {formatManilaTime(payload.start)} – {formatManilaTime(payload.end)} (Asia/Manila)
        </SummaryRow>
      </dl>
      <p className="mt-2 text-xs text-ink-muted">Awaiting the doctor&apos;s confirmation.</p>
      <Link
        href="/chat?view=appointments"
        className="focus-ring mt-2 inline-block text-sm text-primary underline underline-offset-4 hover:text-primary-hover"
      >
        View my appointments
      </Link>
    </div>
  );
}
