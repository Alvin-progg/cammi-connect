import type { ReactNode } from "react";

import { StatusBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/data";
import { AppointmentTimeline } from "@/components/appointments/appointment-timeline";
import { todayInManila } from "@/lib/appointments/filters";
import {
  formatManilaDateTime,
  formatManilaMediumDate,
  formatManilaTime,
} from "@/lib/appointments/format";
import { SLOT_CHECK_LABELS, type SlotCheck } from "@/lib/front-desk/decisions";
import {
  BOOKING_SOURCE_LABELS,
  formatRequestId,
  type RequestDetails,
} from "@/lib/front-desk/requests";

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
      className="min-w-0 rounded-xl border border-line bg-surface p-6 shadow-soft"
    >
      <h2 id={headingId} className="text-lg font-semibold leading-7 text-ink">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** One term/value row of a two-column definition list (kit DetailList look). */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

const DETAIL_LIST = "grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm";

/**
 * The pre-decision schedule check, shown in the Decide card while a request
 * is pending.
 */
export function SlotCheckAlert({ slotCheck }: { slotCheck: SlotCheck }) {
  return (
    <Alert tone={slotCheck === "available" ? "success" : "danger"} title="Schedule check">
      {SLOT_CHECK_LABELS[slotCheck]}
    </Alert>
  );
}

/**
 * Everything staff need to evaluate a Cami request without repeating the
 * conversation (SPEC-frontdesk §5). The chat transcript itself is not shown
 * (FD-001 decision 2026-11-03).
 */
export function RequestDetailsView({ request }: { request: RequestDetails }) {
  // todayInManila gives the Manila calendar date of any instant.
  const manilaDate = todayInManila(new Date(request.scheduledAt));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
      <Section id="patient" title="Patient">
        <dl className={DETAIL_LIST}>
          <Field label="Name">{request.patientName}</Field>
          <Field label="Email">{request.patientEmail ?? "Not provided"}</Field>
          <Field label="Phone">{request.patientPhone ?? "Not provided"}</Field>
        </dl>
      </Section>

      <Section id="appointment" title="Appointment">
        <dl className={DETAIL_LIST}>
          <Field label="Request ID">
            <span className="font-mono text-xs">{formatRequestId(request.id)}</span>
          </Field>
          <Field label="Status">
            <StatusBadge status={request.status} />
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
      </div>

      <Section id="provided" title="Patient-provided information">
        <p className="text-sm leading-6 text-ink">
          {request.reason ?? "No reason given."}
        </p>
        <p className="mt-3 text-xs text-ink-muted">
          Chat transcripts are not shared with front desk staff.
        </p>
      </Section>

      <Section id="history" title="Status history">
        <AppointmentTimeline history={request.history} />
      </Section>
    </div>
  );
}
