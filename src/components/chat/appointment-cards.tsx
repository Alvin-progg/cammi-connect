"use client";

import { useState } from "react";

import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { formatManilaDate, formatManilaTime } from "@/lib/appointments/format";
import { manilaDateOf } from "@/lib/chat/booking";
import type { ChatMessagePayload } from "@/lib/chat/schemas";

import {
  BUTTON_BASE,
  GHOST_BUTTON,
  SummaryRow,
  type CardProps,
} from "./booking-cards";

export type AppointmentPayload = Extract<
  ChatMessagePayload,
  { kind: "appointments" | "cancel_confirmation" | "cancel_result" }
>;

const APPOINTMENT_KINDS = new Set<ChatMessagePayload["kind"]>([
  "appointments",
  "cancel_confirmation",
  "cancel_result",
]);

export function isAppointmentPayload(payload: ChatMessagePayload): payload is AppointmentPayload {
  return APPOINTMENT_KINDS.has(payload.kind);
}

const DANGER_BUTTON = `${BUTTON_BASE} border-danger bg-danger text-danger-ink hover:bg-danger-hover`;
const CANCEL_ROW_BUTTON = `${BUTTON_BASE} border-line-strong bg-surface text-danger hover:bg-danger-soft`;

function formatWhen(start: string): string {
  return `${formatManilaDate(manilaDateOf(start))} · ${formatManilaTime(start)}`;
}

/**
 * Appointment cards shown under an assistant reply (AI-APT-001 S4). Values
 * come from the server payload, built from the patient's own appointment
 * rows; cards send back only the appointment ID, which the server re-reads
 * with the session's patient ID.
 */
export function AppointmentCard({
  payload,
  ...props
}: CardProps & { payload: AppointmentPayload }) {
  switch (payload.kind) {
    case "appointments":
      return <AppointmentsList payload={payload} {...props} />;
    case "cancel_confirmation":
      return <CancelConfirmation payload={payload} {...props} />;
    case "cancel_result":
      return <CancelResult payload={payload} />;
  }
}

function AppointmentsList({
  payload,
  interactive,
  busy,
  onEvent,
}: CardProps & { payload: Extract<AppointmentPayload, { kind: "appointments" }> }) {
  return (
    <div className="mt-3">
      <ul aria-label="Upcoming appointments" className="space-y-2">
        {payload.items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="break-words text-sm font-semibold text-ink">{item.doctorName}</p>
                <AppointmentStatusBadge status={item.status} />
              </div>
              {item.departmentName ? (
                <p className="break-words text-sm text-ink-muted">{item.departmentName}</p>
              ) : null}
              <p className="mt-1 text-sm text-ink-secondary">
                <time dateTime={item.start}>{formatWhen(item.start)}</time> ·{" "}
                {item.durationMinutes} min
              </p>
            </div>
            <button
              type="button"
              disabled={!interactive || busy}
              aria-label={`Cancel appointment with ${item.doctorName} on ${formatWhen(item.start)}`}
              onClick={() => onEvent({ type: "request_cancellation", appointmentId: item.id })}
              className={CANCEL_ROW_BUTTON}
            >
              Cancel
            </button>
          </li>
        ))}
      </ul>
      {interactive ? null : (
        <p className="mt-2 text-xs text-ink-muted">This list is from earlier in the chat.</p>
      )}
    </div>
  );
}

function CancelConfirmation({
  payload,
  interactive,
  busy,
  onEvent,
}: CardProps & { payload: Extract<AppointmentPayload, { kind: "cancel_confirmation" }> }) {
  const [choice, setChoice] = useState<"cancel" | "keep" | null>(null);
  const disabled = !interactive || busy || choice !== null;
  const pendingCancel = busy && choice === "cancel";

  return (
    <div className="mt-3 rounded-lg border border-line bg-surface-muted p-3">
      <dl className="space-y-1.5 text-sm">
        <SummaryRow term="Doctor">{payload.doctorName}</SummaryRow>
        <SummaryRow term="Date">{formatManilaDate(manilaDateOf(payload.start))}</SummaryRow>
        <SummaryRow term="Time">{formatManilaTime(payload.start)} (Asia/Manila)</SummaryRow>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          aria-busy={pendingCancel || undefined}
          onClick={() => {
            setChoice("cancel");
            onEvent({ type: "confirm_cancellation", appointmentId: payload.appointmentId });
          }}
          className={DANGER_BUTTON}
        >
          {pendingCancel ? "Cancelling…" : "Yes, cancel it"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setChoice("keep")}
          className={GHOST_BUTTON}
        >
          Keep appointment
        </button>
      </div>
      {choice === "keep" ? (
        <p className="mt-2 text-xs text-ink-muted">Your appointment was kept.</p>
      ) : null}
      {interactive ? null : (
        <p className="mt-2 text-xs text-ink-muted">This request is from earlier in the chat.</p>
      )}
    </div>
  );
}

function CancelResult({
  payload,
}: {
  payload: Extract<AppointmentPayload, { kind: "cancel_result" }>;
}) {
  return (
    <div className="mt-3 rounded-lg border border-line bg-surface-muted p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Appointment cancelled</p>
        <AppointmentStatusBadge status="cancelled" />
      </div>
      <dl className="mt-2 space-y-1.5 text-sm">
        <SummaryRow term="Doctor">{payload.doctorName}</SummaryRow>
        <SummaryRow term="Date">{formatManilaDate(manilaDateOf(payload.start))}</SummaryRow>
        <SummaryRow term="Time">{formatManilaTime(payload.start)} (Asia/Manila)</SummaryRow>
      </dl>
    </div>
  );
}
