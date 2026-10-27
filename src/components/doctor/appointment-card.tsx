import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import {
  formatManilaShortDate,
  formatManilaTime,
} from "@/lib/appointments/format";
import type { DoctorAppointment } from "@/lib/appointments/types";

import {
  AppointmentActions,
  type AppointmentHistoryItem,
} from "./appointment-actions";
import { ClockIcon } from "./icons";

function patientInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "P";
}

/**
 * Kanban-style appointment card: patient, consultation reason, status and
 * duration pills, Manila date/time, and the quick/manage action controls.
 */
export function AppointmentCard({
  appointment,
  history,
  scheduleHint,
}: {
  appointment: DoctorAppointment;
  history: AppointmentHistoryItem[];
  scheduleHint: string;
}) {
  const scheduledLabel = `${formatManilaShortDate(appointment.scheduledAt)} · ${formatManilaTime(appointment.scheduledAt)}`;

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-line-strong motion-reduce:transition-none">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
        >
          {patientInitials(appointment.patientName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {appointment.patientName}
          </p>
          <p className="flex items-center gap-1 text-xs text-ink-muted">
            <ClockIcon className="size-3.5" />
            <time dateTime={appointment.scheduledAt}>{scheduledLabel}</time>
          </p>
        </div>
      </div>

      <p className="text-sm leading-6 text-ink-secondary">
        {appointment.reason ?? "General consultation"}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <AppointmentStatusBadge status={appointment.status} />
        <span className="inline-flex items-center rounded-full border border-line bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
          {appointment.durationMinutes} min
        </span>
      </div>

      <AppointmentActions
        appointmentId={appointment.id}
        status={appointment.status}
        patientName={appointment.patientName}
        scheduledAtLabel={scheduledLabel}
        scheduleHint={scheduleHint}
        history={history}
      />
    </article>
  );
}
