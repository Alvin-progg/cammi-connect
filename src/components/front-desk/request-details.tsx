import type { ReactNode } from "react";

import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import type { AppointmentAuditAction } from "@/lib/appointments/audit";
import { todayInManila } from "@/lib/appointments/filters";
import {
  formatManilaDateTime,
  formatManilaMediumDate,
  formatManilaTime,
} from "@/lib/appointments/format";
import type { BookingSource } from "@/lib/appointments/status";
import { SLOT_CHECK_LABELS, type SlotCheck } from "@/lib/front-desk/decisions";
import type { UserRole } from "@/lib/auth/roles";
import {
  formatRequestId,
  type RequestAuditEntry,
  type RequestDetails,
} from "@/lib/front-desk/requests";

const AUDIT_ACTION_LABELS: Record<AppointmentAuditAction, string> = {
  created: "Request submitted",
  confirmed: "Confirmed",
  rejected: "Rejected",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
  checked_in: "Checked in",
  completed: "Completed",
  no_show: "Marked as no-show",
};

const ROLE_LABELS: Record<UserRole, string> = {
  patient: "Patient",
  doctor: "Doctor",
  admin: "Administrator",
  front_desk: "Front desk",
};

const BOOKING_SOURCE_LABELS: Record<BookingSource, string> = {
  ai_chatbot: "Cami (AI assistant)",
  front_desk: "Front desk",
  other: "Other",
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-6"
    >
      <h2 id={headingId} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

function actorLabel(entry: RequestAuditEntry): string {
  if (!entry.actorName) {
    return "System";
  }
  return entry.actorRole
    ? `${entry.actorName} (${ROLE_LABELS[entry.actorRole]})`
    : entry.actorName;
}

/**
 * Everything staff need to evaluate a Cami request without repeating the
 * conversation (SPEC-frontdesk §5). The chat transcript itself is not shown
 * (FD-001 decision 2026-11-03).
 */
export function RequestDetailsView({
  request,
  slotCheck = null,
}: {
  request: RequestDetails;
  /** The pre-decision schedule check; null once the request is decided. */
  slotCheck?: SlotCheck | null;
}) {
  // todayInManila gives the Manila calendar date of any instant.
  const manilaDate = todayInManila(new Date(request.scheduledAt));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section id="patient" title="Patient">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">{request.patientName}</Field>
          <Field label="Email">{request.patientEmail ?? "Not provided"}</Field>
          <Field label="Phone">{request.patientPhone ?? "Not provided"}</Field>
        </dl>
      </Section>

      <Section id="appointment" title="Appointment">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Request ID">
            <span className="font-mono text-xs">{formatRequestId(request.id)}</span>
          </Field>
          <Field label="Status">
            <AppointmentStatusBadge status={request.status} />
          </Field>
          <Field label="Doctor">{request.doctorName}</Field>
          <Field label="Specialty">
            {request.specialtyNames.length > 0
              ? request.specialtyNames.join(", ")
              : "Not specified"}
          </Field>
          <Field label="Date">{formatManilaMediumDate(manilaDate)}</Field>
          <Field label="Time">
            {`${formatManilaTime(request.scheduledAt)} · ${request.durationMinutes} minutes`}
          </Field>
          {slotCheck ? (
            <Field label="Schedule check">
              <span className={slotCheck === "available" ? "text-success-soft-ink" : "text-danger-soft-ink"}>
                {SLOT_CHECK_LABELS[slotCheck]}
              </span>
            </Field>
          ) : null}
          <Field label="Booked via">{BOOKING_SOURCE_LABELS[request.bookingSource]}</Field>
          <Field label="Submitted">{formatManilaDateTime(request.createdAt)}</Field>
          {request.rejectionReason ? (
            <Field label="Rejection reason">{request.rejectionReason}</Field>
          ) : null}
          {request.cancellationReason ? (
            <Field label="Cancellation reason">{request.cancellationReason}</Field>
          ) : null}
        </dl>
      </Section>

      <Section id="provided" title="Patient-provided information">
        <p className="text-sm leading-6 text-ink">
          {request.reason ?? "No reason given."}
        </p>
        <p className="mt-3 text-xs text-ink-muted">
          Chat transcripts are not shared with front desk staff.
        </p>
      </Section>

      <Section id="history" title="Status history">
        {request.history.length === 0 ? (
          <p className="text-sm text-ink-muted">No status changes recorded.</p>
        ) : (
          <ol className="flex flex-col gap-4 border-l border-line pl-4">
            {request.history.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-ink">
                  {AUDIT_ACTION_LABELS[entry.action]}
                </span>
                <span className="text-xs text-ink-secondary">{actorLabel(entry)}</span>
                <time dateTime={entry.createdAt} className="text-xs text-ink-muted">
                  {formatManilaDateTime(entry.createdAt)}
                </time>
                {entry.action === "rescheduled" && entry.scheduledAt ? (
                  <span className="text-xs text-ink-secondary">
                    {`New time: ${formatManilaDateTime(entry.scheduledAt)}`}
                  </span>
                ) : null}
                {entry.reason ? (
                  <span className="text-xs text-ink-secondary">{`Reason: ${entry.reason}`}</span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
