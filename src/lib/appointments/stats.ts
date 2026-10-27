import {
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
} from "./status";
import { MANILA_TIME_ZONE } from "./filters";

export type DailyStatusCounts = {
  date: string;
  total: number;
  counts: Record<AppointmentStatus, number>;
};

export type AppointmentStatsSummary = {
  total: number;
  requested: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
  /** completed / (completed + cancelled + no_show), 0-100; null when no terminal appointments. */
  completionRate: number | null;
  days: DailyStatusCounts[];
  maxDayTotal: number;
};

const MANILA_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: MANILA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function manilaDateOfTimestamp(isoTimestamp: string): string {
  return MANILA_DATE_FORMATTER.format(new Date(isoTimestamp));
}

function emptyCounts(): Record<AppointmentStatus, number> {
  return {
    requested: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0,
  };
}

/**
 * Pure aggregation over the appointments the doctor is authorized to see.
 * Statistics are computed from authoritative rows only — never extrapolated.
 */
export function summarizeAppointments(
  appointments: { scheduledAt: string; status: AppointmentStatus }[],
): AppointmentStatsSummary {
  const totals = emptyCounts();
  const byDay = new Map<string, Record<AppointmentStatus, number>>();

  for (const appointment of appointments) {
    totals[appointment.status] += 1;
    const date = manilaDateOfTimestamp(appointment.scheduledAt);
    const dayCounts = byDay.get(date) ?? emptyCounts();
    dayCounts[appointment.status] += 1;
    byDay.set(date, dayCounts);
  }

  const days: DailyStatusCounts[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({
      date,
      counts,
      total: APPOINTMENT_STATUSES.reduce(
        (sum, status) => sum + counts[status],
        0,
      ),
    }));

  const terminal = totals.completed + totals.cancelled + totals.no_show;

  return {
    total: appointments.length,
    requested: totals.requested,
    confirmed: totals.confirmed,
    completed: totals.completed,
    cancelled: totals.cancelled,
    noShow: totals.no_show,
    completionRate:
      terminal === 0 ? null : Math.round((totals.completed / terminal) * 100),
    days,
    maxDayTotal: days.reduce((max, day) => Math.max(max, day.total), 0),
  };
}
