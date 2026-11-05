import type { ReactNode } from "react";

import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { AppointmentTimeline } from "@/components/appointments/appointment-timeline";
import { formatManilaDateTime } from "@/lib/appointments/format";
import type { MonitoringDetails } from "@/lib/appointments/monitoring";
import { BOOKING_SOURCE_LABELS, formatRequestId } from "@/lib/front-desk/requests";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
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

/**
 * Read-only appointment details for administrators (ADM-09). Contact details
 * appear here, not in the list. There are no actions: status changes belong
 * to the front desk (D3).
 */
export function MonitoringDetailsView({ appointment }: { appointment: MonitoringDetails }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section id="appointment" title="Appointment">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Appointment ID">
            <span className="font-mono text-xs">{formatRequestId(appointment.id)}</span>
          </Field>
          <Field label="Status">
            <AppointmentStatusBadge status={appointment.status} />
          </Field>
          <Field label="Doctor">{appointment.doctorName}</Field>
          <Field label="Department">{appointment.departmentName ?? "No department"}</Field>
          <Field label="Specialty">{appointment.specialtyName ?? "Not specified"}</Field>
          <Field label="Scheduled">
            {`${formatManilaDateTime(appointment.scheduledAt)} · ${appointment.durationMinutes} minutes`}
          </Field>
          <Field label="Booked via">{BOOKING_SOURCE_LABELS[appointment.bookingSource]}</Field>
          <Field label="Created">{formatManilaDateTime(appointment.createdAt)}</Field>
          <Field label="Created by">{appointment.createdByName ?? "Unknown"}</Field>
          <Field label="Confirmed by">
            {appointment.confirmedByName
              ? appointment.confirmedAt
                ? `${appointment.confirmedByName} · ${formatManilaDateTime(appointment.confirmedAt)}`
                : appointment.confirmedByName
              : "Not confirmed"}
          </Field>
          {appointment.rejectionReason ? (
            <Field label="Rejection reason">{appointment.rejectionReason}</Field>
          ) : null}
          {appointment.cancellationReason ? (
            <Field label="Cancellation reason">{appointment.cancellationReason}</Field>
          ) : null}
        </dl>
      </Section>

      <Section id="patient" title="Patient">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">{appointment.patientName}</Field>
          <Field label="Patient ID">
            <span className="font-mono text-xs">{appointment.patientId}</span>
          </Field>
          <Field label="Email">{appointment.patientEmail ?? "Not provided"}</Field>
          <Field label="Phone">{appointment.patientPhone ?? "Not provided"}</Field>
          <Field label="Reason for visit">{appointment.reason ?? "No reason given."}</Field>
        </dl>
      </Section>

      <Section id="history" title="Status history">
        <AppointmentTimeline history={appointment.history} showStatusChange />
      </Section>
    </div>
  );
}
