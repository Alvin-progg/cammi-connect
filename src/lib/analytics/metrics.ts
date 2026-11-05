import { MANILA_TIME_ZONE } from "@/lib/appointments/filters";
import { manilaDateOfTimestamp } from "@/lib/appointments/stats";
import type { AppointmentStatus } from "@/lib/appointments/status";

/**
 * The analytics metric layer (ADM-10). Every number on the admin analytics and
 * dashboard pages comes from these pure functions; the definitions are frozen
 * in docs/analytics-definitions.md. Keep the two in sync.
 */

/** One appointment plus the confirmation and cancellation evidence the metrics need. */
export type AnalyticsAppointment = {
  id: string;
  doctorId: string;
  doctorName: string;
  scheduledAt: string;
  scheduledEndAt: string;
  status: AppointmentStatus;
  confirmedAt: string | null;
  /** An `appointment_audit_logs` row moved this appointment to `confirmed`. */
  confirmedInAudit: boolean;
  /** `created_at` of the `cancelled` audit row: the cancellation date (D4, used by ADM-12). */
  cancelledAt: string | null;
};

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Two-hour Manila time buckets: "00–02" … "22–24". */
export const HOUR_BUCKETS = Array.from({ length: 12 }, (_, index) => {
  const pad = (hour: number) => String(hour).padStart(2, "0");
  return `${pad(index * 2)}–${pad(index * 2 + 2)}`;
});

/** Statuses counted in volume metrics: everything except `rejected`. */
export const VOLUME_STATUSES = [
  "requested",
  "confirmed",
  "cancelled",
  "checked_in",
  "completed",
  "no_show",
] as const satisfies readonly AppointmentStatus[];
export type VolumeStatus = (typeof VOLUME_STATUSES)[number];

/** These statuses can only be reached through a confirmed appointment. */
const ATTENDANCE_STATUSES: readonly AppointmentStatus[] = ["checked_in", "completed", "no_show"];
const DUE_STATUSES: readonly AppointmentStatus[] = [
  "confirmed",
  "checked_in",
  "completed",
  "no_show",
  "cancelled",
];

const WEEKDAY_HOUR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: MANILA_TIME_ZONE,
  weekday: "short",
  hour: "numeric",
  hourCycle: "h23",
});

export type DerivedAnalyticsRow = {
  schedDateMnl: string;
  schedMonth: string;
  weekday: Weekday;
  hourBucket: string;
  wasConfirmed: boolean;
  /** In the due cohort: the denominator of every rate. */
  isDue: boolean;
};

function isWeekday(value: string): value is Weekday {
  return WEEKDAYS.some((weekday) => weekday === value);
}

type TimeBuckets = Pick<DerivedAnalyticsRow, "schedDateMnl" | "schedMonth" | "weekday" | "hourBucket">;

/** Manila calendar date, month, weekday, and two-hour bucket of an appointment start. */
function bucketTime(scheduledAt: string): TimeBuckets {
  const parts = WEEKDAY_HOUR_FORMATTER.formatToParts(new Date(scheduledAt));
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  if (!isWeekday(weekday) || !Number.isInteger(hour)) {
    throw new RangeError("Unable to bucket the appointment time.");
  }
  const schedDateMnl = manilaDateOfTimestamp(scheduledAt);
  return {
    schedDateMnl,
    schedMonth: schedDateMnl.slice(0, 7),
    weekday,
    hourBucket: HOUR_BUCKETS[Math.floor(hour / 2)],
  };
}

export function deriveAnalyticsRow(row: AnalyticsAppointment, now: Date): DerivedAnalyticsRow {
  // Seed and pre-FD-001 rows reached attendance statuses without a recorded
  // confirmation, so the status itself is accepted as evidence.
  const wasConfirmed =
    row.confirmedAt !== null || row.confirmedInAudit || ATTENDANCE_STATUSES.includes(row.status);

  return {
    ...bucketTime(row.scheduledAt),
    wasConfirmed,
    isDue:
      wasConfirmed &&
      DUE_STATUSES.includes(row.status) &&
      new Date(row.scheduledEndAt).getTime() < now.getTime(),
  };
}

/** A percentage rounded to 2 decimals, or null when there is nothing to divide by. */
export function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) {
    return null;
  }
  return Math.round((numerator / denominator) * 10_000) / 100;
}

function isVolumeStatus(status: AppointmentStatus): status is VolumeStatus {
  return status !== "rejected";
}

type DueRates = { dueCount: number; cancellationRate: number | null; noShowRate: number | null };

/** Rates over the due rows of a group. Callers pass rows already derived with `now`. */
function dueRates(rows: { row: AnalyticsAppointment; derived: DerivedAnalyticsRow }[]) {
  const due = rows.filter(({ derived }) => derived.isDue);
  const countStatus = (status: AppointmentStatus) => due.filter(({ row }) => row.status === status).length;
  return {
    dueCount: due.length,
    completed: countStatus("completed"),
    cancellationRate: rate(countStatus("cancelled"), due.length),
    noShowRate: rate(countStatus("no_show"), due.length),
  };
}

function deriveAll(rows: AnalyticsAppointment[], now: Date) {
  return rows.map((row) => ({ row, derived: deriveAnalyticsRow(row, now) }));
}

export type AnalyticsKpis = {
  total: number;
  dueCount: number;
  completionRate: number | null;
  noShowRate: number | null;
  cancellationRate: number | null;
};

export function computeKpis(rows: AnalyticsAppointment[], now: Date): AnalyticsKpis {
  const { dueCount, completed, cancellationRate, noShowRate } = dueRates(deriveAll(rows, now));
  return {
    total: rows.filter((row) => isVolumeStatus(row.status)).length,
    dueCount,
    completionRate: rate(completed, dueCount),
    noShowRate,
    cancellationRate,
  };
}

export type MonthlyVolume = { month: string; total: number };

/** Non-rejected appointments per Manila month, one entry per month in `months`. */
export function monthlyVolume(rows: AnalyticsAppointment[], months: string[]): MonthlyVolume[] {
  const totals = new Map(months.map((month) => [month, 0]));
  for (const row of rows) {
    const month = bucketTime(row.scheduledAt).schedMonth;
    if (isVolumeStatus(row.status) && totals.has(month)) {
      totals.set(month, (totals.get(month) ?? 0) + 1);
    }
  }
  return months.map((month) => ({ month, total: totals.get(month) ?? 0 }));
}

export type DoctorAnalytics = { doctorId: string; doctorName: string; total: number } & DueRates;

/** Volume and due-cohort rates per doctor, highest volume first, then by name. */
export function byDoctor(rows: AnalyticsAppointment[], now: Date): DoctorAnalytics[] {
  const groups = new Map<string, ReturnType<typeof deriveAll>>();
  for (const entry of deriveAll(rows, now)) {
    const group = groups.get(entry.row.doctorId) ?? [];
    group.push(entry);
    groups.set(entry.row.doctorId, group);
  }

  return [...groups.values()]
    .map((group) => {
      const { dueCount, cancellationRate, noShowRate } = dueRates(group);
      return {
        doctorId: group[0].row.doctorId,
        doctorName: group[0].row.doctorName,
        total: group.filter(({ row }) => isVolumeStatus(row.status)).length,
        dueCount,
        cancellationRate,
        noShowRate,
      };
    })
    // A doctor whose only rows in the period are rejected has no volume to show.
    .filter((doctor) => doctor.total > 0)
    .sort((a, b) => b.total - a.total || a.doctorName.localeCompare(b.doctorName));
}

export type HeatmapCell = { weekday: Weekday; hourBucket: string; count: number };

function slotKey(weekday: Weekday, hourBucket: string) {
  return `${weekday} ${hourBucket}`;
}

function everySlot() {
  return WEEKDAYS.flatMap((weekday) => HOUR_BUCKETS.map((hourBucket) => ({ weekday, hourBucket })));
}

/** Non-rejected appointments in every weekday × hour bucket cell, Monday first. */
export function heatmap(rows: AnalyticsAppointment[]): HeatmapCell[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (isVolumeStatus(row.status)) {
      const { weekday, hourBucket } = bucketTime(row.scheduledAt);
      const key = slotKey(weekday, hourBucket);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return everySlot().map((slot) => ({ ...slot, count: counts.get(slotKey(slot.weekday, slot.hourBucket)) ?? 0 }));
}

export type MonthlyStatusCounts = { month: string; counts: Record<VolumeStatus, number> };

/** Non-rejected appointments per status and Manila month, one entry per month in `months`. */
export function statusByMonth(rows: AnalyticsAppointment[], months: string[]): MonthlyStatusCounts[] {
  const emptyCounts = (): Record<VolumeStatus, number> => ({
    requested: 0,
    confirmed: 0,
    cancelled: 0,
    checked_in: 0,
    completed: 0,
    no_show: 0,
  });
  const byMonth = new Map(months.map((month) => [month, emptyCounts()]));

  for (const row of rows) {
    const counts = byMonth.get(bucketTime(row.scheduledAt).schedMonth);
    if (counts && isVolumeStatus(row.status)) {
      counts[row.status] += 1;
    }
  }
  return months.map((month) => ({ month, counts: byMonth.get(month) ?? emptyCounts() }));
}

export type SlotRates = { weekday: Weekday; hourBucket: string } & DueRates;

/** Due-cohort rates per weekday × hour bucket, only for cells with due appointments. */
export function ratesBySlot(rows: AnalyticsAppointment[], now: Date): SlotRates[] {
  const groups = new Map<string, ReturnType<typeof deriveAll>>();
  for (const entry of deriveAll(rows, now)) {
    const key = slotKey(entry.derived.weekday, entry.derived.hourBucket);
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }

  return everySlot().flatMap((slot) => {
    const { dueCount, cancellationRate, noShowRate } = dueRates(
      groups.get(slotKey(slot.weekday, slot.hourBucket)) ?? [],
    );
    return dueCount > 0 ? [{ ...slot, dueCount, cancellationRate, noShowRate }] : [];
  });
}

/** Every dataset for one period, as `loadAnalytics` returns it. */
export type AnalyticsDatasets = {
  kpis: AnalyticsKpis & { pending: number };
  monthly: MonthlyVolume[];
  byDoctor: DoctorAnalytics[];
  heatmap: HeatmapCell[];
  statusByMonth: MonthlyStatusCounts[];
  ratesBySlot: SlotRates[];
};
