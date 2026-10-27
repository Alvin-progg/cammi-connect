import Link from "next/link";

import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { AppointmentActions } from "@/components/doctor/appointment-actions";
import { toHistoryItems } from "@/components/doctor/history-items";
import {
  formatManilaShortDate,
  formatManilaTime,
} from "@/lib/appointments/format";
import type {
  AppointmentHistoryEntry,
  DoctorAppointment,
} from "@/lib/appointments/types";

export function AppointmentTable({
  appointments,
  historyMap,
  scheduleHint,
}: {
  appointments: DoctorAppointment[];
  historyMap: Map<string, AppointmentHistoryEntry[]>;
  scheduleHint: string;
}) {
  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 px-4 py-10 sm:px-6">
        <h3 className="text-lg font-semibold text-ink">
          No appointments for this period
        </h3>
        <p className="max-w-prose text-sm leading-6 text-ink-secondary">
          Try another date or status. Only appointments assigned to you are shown.
        </p>
        <Link
          href="/doctor"
          className="rounded-lg text-sm font-medium text-primary underline underline-offset-4 focus-ring hover:text-primary-hover"
        >
          Reset filters
        </Link>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Appointments for the selected period"
      tabIndex={0}
      className="overflow-x-auto focus-ring"
    >
      <table className="w-full min-w-[52rem] border-collapse text-left">
        <caption className="sr-only">
          Appointments for the selected period, in Asia/Manila time
        </caption>
        <thead className="bg-surface-muted">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 text-sm font-medium text-ink-secondary"
            >
              Date
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-sm font-medium text-ink-secondary"
            >
              Time
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-sm font-medium text-ink-secondary"
            >
              Patient
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-sm font-medium text-ink-secondary"
            >
              Reason
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-sm font-medium text-ink-secondary"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-sm font-medium text-ink-secondary"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((appointment) => (
            <tr
              key={appointment.id}
              className="border-t border-line transition-colors hover:bg-surface-muted motion-reduce:transition-none"
            >
              <td className="whitespace-nowrap px-4 py-3 text-sm text-ink-secondary">
                {formatManilaShortDate(appointment.scheduledAt)}
              </td>
              <th
                scope="row"
                className="whitespace-nowrap px-4 py-3 text-sm font-medium tabular-nums text-ink"
              >
                {formatManilaTime(appointment.scheduledAt)}
              </th>
              <td className="px-4 py-3 text-sm text-ink">
                {appointment.patientName}
              </td>
              <td className="px-4 py-3 text-sm text-ink-secondary">
                {appointment.reason ?? "No reason provided"}
              </td>
              <td className="px-4 py-3">
                <AppointmentStatusBadge status={appointment.status} />
              </td>
              <td className="px-4 py-3">
                <AppointmentActions
                  appointmentId={appointment.id}
                  status={appointment.status}
                  patientName={appointment.patientName}
                  scheduledAtLabel={`${formatManilaShortDate(appointment.scheduledAt)} · ${formatManilaTime(appointment.scheduledAt)}`}
                  scheduleHint={scheduleHint}
                  history={toHistoryItems(historyMap.get(appointment.id))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
