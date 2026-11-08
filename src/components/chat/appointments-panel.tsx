import Link from "next/link";

import { StatusBadge } from "@/components/ui/badge";
import type { PatientAppointmentGroups } from "@/lib/appointments/patient";
import type { PatientAppointment } from "@/lib/appointments/types";
import { MANILA_TIME_ZONE } from "@/lib/appointments/filters";
import { formatManilaTime } from "@/lib/appointments/format";

import { CancelAppointmentButton } from "./cancel-appointment-button";
import { CalendarIcon } from "lucide-react";

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TIME_ZONE,
  month: "short",
});
const DAY_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TIME_ZONE,
  day: "numeric",
});
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TIME_ZONE,
  weekday: "long",
  year: "numeric",
});

function AppointmentCard({
  appointment,
  cancellable,
}: {
  appointment: PatientAppointment;
  cancellable: boolean;
}) {
  const start = new Date(appointment.scheduledAt);
  const whenLabel = `${WEEKDAY_FORMATTER.format(start)}, ${MONTH_FORMATTER.format(start)} ${DAY_FORMATTER.format(start)} · ${formatManilaTime(appointment.scheduledAt)}`;
  return (
    <li className="flex gap-4 rounded-xl border border-line bg-surface p-4 shadow-card">
      <div
        aria-hidden="true"
        className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-muted py-2"
      >
        <span className="text-xs font-medium uppercase text-ink-muted">
          {MONTH_FORMATTER.format(start)}
        </span>
        <span className="text-xl font-semibold tabular-nums text-ink">
          {DAY_FORMATTER.format(start)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{appointment.doctorName}</p>
            {appointment.departmentName ? (
              <p className="truncate text-sm text-ink-muted">{appointment.departmentName}</p>
            ) : null}
          </div>
          <StatusBadge status={appointment.status} />
        </div>
        <p className="mt-2 text-sm text-ink-secondary">
          <time dateTime={appointment.scheduledAt}>{whenLabel}</time>{" "}
          · {appointment.durationMinutes} min
        </p>
        {appointment.reason ? (
          <p className="mt-1 break-words text-sm text-ink-muted">{appointment.reason}</p>
        ) : null}
        {cancellable ? (
          <div className="mt-3">
            <CancelAppointmentButton
              appointmentId={appointment.id}
              doctorName={appointment.doctorName}
              whenLabel={whenLabel}
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}

function AppointmentSection({
  id,
  title,
  appointments,
  emptyText,
  cancellable,
}: {
  id: string;
  title: string;
  appointments: PatientAppointment[];
  emptyText: string;
  /** Upcoming appointments are requested or confirmed, so each can be cancelled. */
  cancellable: boolean;
}) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="text-xs font-medium uppercase tracking-wider text-ink-muted">
        {title}
      </h2>
      {appointments.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">{emptyText}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {appointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              cancellable={cancellable}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** The patient's appointments; upcoming ones can be cancelled (AI-APT-001 S4). */
export function AppointmentsPanel({ upcoming, past }: PatientAppointmentGroups) {
  const isEmpty = upcoming.length === 0 && past.length === 0;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">My Appointments</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Requested appointments are not confirmed until the doctor confirms them. Times are in
          Philippine time.
        </p>

        {isEmpty ? (
          <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed border-line-strong px-6 py-12 text-center">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-surface-muted text-ink-secondary">
              <CalendarIcon className="size-5" />
            </span>
            <p className="mt-4 text-base font-semibold text-ink">No appointments yet</p>
            <p className="mt-1 text-sm text-ink-muted">
              Ask the assistant to book one.
            </p>
            <Link
              href="/chat"
              className="focus-ring mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-surface px-5 text-sm font-medium text-ink shadow-card transition-colors hover:bg-surface-muted motion-reduce:transition-none"
            >
              Go to chat
            </Link>
          </div>
        ) : (
          <>
            <AppointmentSection
              id="appointments-upcoming"
              title="Upcoming"
              appointments={upcoming}
              emptyText="No upcoming appointments."
              cancellable
            />
            <AppointmentSection
              id="appointments-past"
              title="Past"
              appointments={past}
              emptyText="No past appointments."
              cancellable={false}
            />
          </>
        )}
      </div>
    </div>
  );
}
