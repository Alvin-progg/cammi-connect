import { MANILA_TIME_ZONE } from "@/lib/appointments/filters";
import { manilaDateOfTimestamp } from "@/lib/appointments/stats";
import type { AppointmentStatus } from "@/lib/appointments/status";

/**
 * The analytics metric layer (ADM-10). Every number on the admin analytics and
 * dashboard pages comes from these pure functions; the definitions live in
 * docs/analytics-definitions.md (v2, 2026-11-08). Keep the two in sync.
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

/** Clinic weekdays always shown on the heatmap; weekends appear only with data. */
const CLINIC_WEEKDAYS: readonly Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** Daytime two-hour slots by Manila start hour; other start times are "outside clinic hours". */
export const DAYTIME_SLOTS = ["9–11 AM", "11 AM–1 PM", "1–3 PM", "3–5 PM"] as const;
export type DaytimeSlot = (typeof DAYTIME_SLOTS)[number];
const FIRST_SLOT_HOUR = 9;
const SLOT_HOURS = 2;

/** Compact slot labels for the peak-slot card ("Thu 11–1"). */
export const DAYTIME_SLOT_SHORT_LABELS: Record<DaytimeSlot, string> = {
  "9–11 AM": "9–11",
  "11 AM–1 PM": "11–1",
  "1–3 PM": "1–3",
  "3–5 PM": "3–5",
};

function slotForHour(hour: number): DaytimeSlot | null {
  const index = Math.floor((hour - FIRST_SLOT_HOUR) / SLOT_HOURS);
  return hour >= FIRST_SLOT_HOUR ? (DAYTIME_SLOTS[index] ?? null) : null;
}

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

/** Final statuses: an ended appointment with one of these has a known outcome. */
const OUTCOME_STATUSES: readonly AppointmentStatus[] = ["completed", "cancelled", "no_show"];

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
  /** The daytime slot of the Manila start time, or null outside 9:00–16:59. */
  slot: DaytimeSlot | null;
  /** In the outcome cohort: the denominator of every rate. */
  isOutcome: boolean;
};

function isWeekday(value: string): value is Weekday {
  return WEEKDAYS.some((weekday) => weekday === value);
}

type TimeBuckets = Pick<DerivedAnalyticsRow, "schedDateMnl" | "schedMonth" | "weekday" | "slot">;

/** Manila calendar date, month, weekday, and daytime slot of an appointment start. */
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
    slot: slotForHour(hour),
  };
}

export function deriveAnalyticsRow(row: AnalyticsAppointment, now: Date): DerivedAnalyticsRow {
  return {
    ...bucketTime(row.scheduledAt),
    isOutcome: OUTCOME_STATUSES.includes(row.status) && new Date(row.scheduledEndAt).getTime() < now.getTime(),
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

type OutcomeRates = { outcomeCount: number; cancellationRate: number | null; noShowRate: number | null };
type DerivedEntry = { row: AnalyticsAppointment; derived: DerivedAnalyticsRow };

/** Outcome counts and rates over the outcome rows of a group. */
function outcomeRates(entries: DerivedEntry[]) {
  const outcomes = entries.filter(({ derived }) => derived.isOutcome);
  const countStatus = (status: AppointmentStatus) => outcomes.filter(({ row }) => row.status === status).length;
  const cancelled = countStatus("cancelled");
  const noShow = countStatus("no_show");
  return {
    outcomeCount: outcomes.length,
    completed: countStatus("completed"),
    cancelled,
    noShow,
    cancellationRate: rate(cancelled, outcomes.length),
    noShowRate: rate(noShow, outcomes.length),
  };
}

function deriveAll(rows: AnalyticsAppointment[], now: Date): DerivedEntry[] {
  return rows.map((row) => ({ row, derived: deriveAnalyticsRow(row, now) }));
}

export type AnalyticsKpis = {
  total: number;
  outcomeCount: number;
  completed: number;
  cancelled: number;
  noShow: number;
  completionRate: number | null;
  cancellationRate: number | null;
  noShowRate: number | null;
  /** First and last Manila month with outcomes; labels the outcome KPIs. */
  outcomeMonths: { first: string; last: string } | null;
  busiestMonth: { month: string; total: number } | null;
  peakSlot: { weekday: Weekday; slot: DaytimeSlot; count: number } | null;
};

export function computeKpis(rows: AnalyticsAppointment[], now: Date): AnalyticsKpis {
  const entries = deriveAll(rows, now);
  const rates = outcomeRates(entries);
  const outcomeMonthList = entries
    .filter(({ derived }) => derived.isOutcome)
    .map(({ derived }) => derived.schedMonth)
    .sort();

  const perMonth = new Map<string, number>();
  for (const { row, derived } of entries) {
    if (isVolumeStatus(row.status)) perMonth.set(derived.schedMonth, (perMonth.get(derived.schedMonth) ?? 0) + 1);
  }
  // Busiest month; ties go to the earliest month.
  const busiest = [...perMonth.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  // Heatmap cells are in weekday-then-slot order, so the first maximum wins ties.
  const peak = heatmap(rows).cells.reduce<HeatmapCell | null>(
    (best, cell) => (cell.count > 0 && (!best || cell.count > best.count) ? cell : best),
    null,
  );

  return {
    total: rows.filter((row) => isVolumeStatus(row.status)).length,
    outcomeCount: rates.outcomeCount,
    completed: rates.completed,
    cancelled: rates.cancelled,
    noShow: rates.noShow,
    completionRate: rate(rates.completed, rates.outcomeCount),
    cancellationRate: rates.cancellationRate,
    noShowRate: rates.noShowRate,
    outcomeMonths:
      outcomeMonthList.length > 0
        ? { first: outcomeMonthList[0], last: outcomeMonthList[outcomeMonthList.length - 1] }
        : null,
    busiestMonth: busiest ? { month: busiest[0], total: busiest[1] } : null,
    peakSlot: peak ? { weekday: peak.weekday, slot: peak.slot, count: peak.count } : null,
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

export type DoctorAnalytics = {
  doctorId: string;
  doctorName: string;
  /** Surname for chart labels ("Reyes"; "G. Lim" when surnames repeat). */
  shortName: string;
  total: number;
} & OutcomeRates;

/** Surname labels for a list of doctor names, adding the first initial when surnames repeat. */
export function shortDoctorNames(names: string[]): string[] {
  const parts = names.map((name) => name.replace(/^Dr\.?\s+/i, "").trim().split(/\s+/));
  const surname = (words: string[]) => words[words.length - 1] ?? "";
  const counts = new Map<string, number>();
  for (const words of parts) counts.set(surname(words), (counts.get(surname(words)) ?? 0) + 1);
  return parts.map((words) =>
    (counts.get(surname(words)) ?? 0) > 1 && words.length > 1 ? `${words[0][0]}. ${surname(words)}` : surname(words),
  );
}

/** Volume and outcome-cohort rates per doctor, highest volume first, then by name. */
export function byDoctor(rows: AnalyticsAppointment[], now: Date): DoctorAnalytics[] {
  const groups = new Map<string, DerivedEntry[]>();
  for (const entry of deriveAll(rows, now)) {
    const group = groups.get(entry.row.doctorId) ?? [];
    group.push(entry);
    groups.set(entry.row.doctorId, group);
  }

  const doctors = [...groups.values()]
    .map((group) => {
      const { outcomeCount, cancellationRate, noShowRate } = outcomeRates(group);
      return {
        doctorId: group[0].row.doctorId,
        doctorName: group[0].row.doctorName,
        total: group.filter(({ row }) => isVolumeStatus(row.status)).length,
        outcomeCount,
        cancellationRate,
        noShowRate,
      };
    })
    // A doctor whose only rows in the period are rejected has no volume to show.
    .filter((doctor) => doctor.total > 0)
    .sort((a, b) => b.total - a.total || a.doctorName.localeCompare(b.doctorName));
  const shortNames = shortDoctorNames(doctors.map((doctor) => doctor.doctorName));
  return doctors.map((doctor, index) => ({
    doctorId: doctor.doctorId,
    doctorName: doctor.doctorName,
    shortName: shortNames[index],
    total: doctor.total,
    outcomeCount: doctor.outcomeCount,
    cancellationRate: doctor.cancellationRate,
    noShowRate: doctor.noShowRate,
  }));
}

export type HeatmapCell = { weekday: Weekday; slot: DaytimeSlot; count: number };
export type Heatmap = { cells: HeatmapCell[]; outsideHours: number };

/**
 * Non-rejected appointments per weekday × daytime slot, Monday first. Mon–Fri
 * are always present; Saturday and Sunday only when they have daytime
 * appointments. Starts outside the slots are counted in `outsideHours`.
 */
export function heatmap(rows: AnalyticsAppointment[]): Heatmap {
  const counts = new Map<string, number>();
  let outsideHours = 0;
  for (const row of rows) {
    if (!isVolumeStatus(row.status)) continue;
    const { weekday, slot } = bucketTime(row.scheduledAt);
    if (slot === null) {
      outsideHours += 1;
      continue;
    }
    const key = `${weekday} ${slot}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const hasData = (weekday: Weekday) => DAYTIME_SLOTS.some((slot) => counts.has(`${weekday} ${slot}`));
  const weekdays = WEEKDAYS.filter((weekday) => CLINIC_WEEKDAYS.includes(weekday) || hasData(weekday));
  return {
    cells: weekdays.flatMap((weekday) =>
      DAYTIME_SLOTS.map((slot) => ({ weekday, slot, count: counts.get(`${weekday} ${slot}`) ?? 0 })),
    ),
    outsideHours,
  };
}

export type MonthlyOutcomes = { month: string; completed: number; cancelled: number; noShow: number };

/**
 * Completed, cancelled, and no-show appointments per Manila month, for the
 * months in `months` from the first to the last month that has outcomes.
 */
export function outcomesByMonth(rows: AnalyticsAppointment[], months: string[], now: Date): MonthlyOutcomes[] {
  const byMonth = new Map<string, DerivedEntry[]>();
  for (const entry of deriveAll(rows, now)) {
    if (!entry.derived.isOutcome) continue;
    const group = byMonth.get(entry.derived.schedMonth) ?? [];
    group.push(entry);
    byMonth.set(entry.derived.schedMonth, group);
  }
  const withOutcomes = months.filter((month) => byMonth.has(month));
  if (withOutcomes.length === 0) return [];
  const first = withOutcomes[0];
  const last = withOutcomes[withOutcomes.length - 1];
  return months
    .filter((month) => month >= first && month <= last)
    .map((month) => {
      const { completed, cancelled, noShow } = outcomeRates(byMonth.get(month) ?? []);
      return { month, completed, cancelled, noShow };
    });
}

export type WeekdayRates = { weekday: Weekday } & OutcomeRates;

/** Outcome-cohort rates per Manila weekday, Monday first, only weekdays with outcomes. */
export function ratesByWeekday(rows: AnalyticsAppointment[], now: Date): WeekdayRates[] {
  const groups = new Map<Weekday, DerivedEntry[]>();
  for (const entry of deriveAll(rows, now)) {
    const group = groups.get(entry.derived.weekday) ?? [];
    group.push(entry);
    groups.set(entry.derived.weekday, group);
  }
  return WEEKDAYS.flatMap((weekday) => {
    const { outcomeCount, cancellationRate, noShowRate } = outcomeRates(groups.get(weekday) ?? []);
    return outcomeCount > 0 ? [{ weekday, outcomeCount, cancellationRate, noShowRate }] : [];
  });
}

/** Non-rejected appointments by current status (ADM-12 status distribution). */
export function statusDistribution(rows: AnalyticsAppointment[]): Record<VolumeStatus, number> {
  const counts: Record<VolumeStatus, number> = {
    requested: 0,
    confirmed: 0,
    cancelled: 0,
    checked_in: 0,
    completed: 0,
    no_show: 0,
  };
  for (const row of rows) {
    if (isVolumeStatus(row.status)) {
      counts[row.status] += 1;
    }
  }
  return counts;
}

export type DashboardCards = {
  total: number;
  confirmed: number;
  completed: number;
  noShow: number;
  cancelled: number;
};

/**
 * ADM-12 summary cards (D4). Every card but Cancelled counts rows scheduled in
 * the period by current status; Cancelled is counted by cancellation date, so
 * the caller passes that count from a separate read.
 */
export function dashboardCards(rows: AnalyticsAppointment[], cancelledInPeriod: number): DashboardCards {
  const counts = statusDistribution(rows);
  return {
    total: VOLUME_STATUSES.reduce((sum, status) => sum + counts[status], 0),
    confirmed: counts.confirmed,
    completed: counts.completed,
    noShow: counts.no_show,
    cancelled: cancelledInPeriod,
  };
}

export type DailyVolume = { date: string; total: number };

/** Non-rejected appointments per Manila day, one entry per day in `days`. */
export function dailyVolume(rows: AnalyticsAppointment[], days: string[]): DailyVolume[] {
  const totals = new Map(days.map((day) => [day, 0]));
  for (const row of rows) {
    const day = bucketTime(row.scheduledAt).schedDateMnl;
    if (isVolumeStatus(row.status) && totals.has(day)) {
      totals.set(day, (totals.get(day) ?? 0) + 1);
    }
  }
  return days.map((date) => ({ date, total: totals.get(date) ?? 0 }));
}

/** Percent change from the previous period, rounded to 2 decimals; null when there was nothing before. */
export function trendPercent(current: number, previous: number): number | null {
  return rate(current - previous, previous);
}

/** Every dataset for one period, as `loadAnalytics` returns it. */
export type AnalyticsDatasets = {
  kpis: AnalyticsKpis & { pending: number };
  monthly: MonthlyVolume[];
  byDoctor: DoctorAnalytics[];
  heatmap: Heatmap;
  outcomesByMonth: MonthlyOutcomes[];
  ratesByWeekday: WeekdayRates[];
};
