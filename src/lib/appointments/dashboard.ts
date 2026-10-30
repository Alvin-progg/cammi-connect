import { isAppointmentStatus, type AppointmentStatus } from "./status";
import { isValidManilaDate, manilaDayRange, todayInManila } from "./filters";

/**
 * URL contract for the doctor dashboard views and appointment filters.
 * Kept pure and framework-free so it is unit-testable and reusable by the
 * page and the filter components.
 */
export const DOCTOR_VIEWS = [
  "week",
  "calendar",
  "stats",
  "profile",
] as const;

export type DoctorView = (typeof DOCTOR_VIEWS)[number];

export const STATS_PERIODS = ["7d", "30d", "month", "all"] as const;

export type StatsPeriod = (typeof STATS_PERIODS)[number];

export const DOCTOR_VIEW_LABELS: Record<DoctorView, string> = {
  week: "Schedule",
  calendar: "Availability",
  stats: "Statistics",
  profile: "Profile",
};

export const STATS_PERIOD_LABELS: Record<StatsPeriod, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month",
  all: "All time",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseDashboardView(
  value: string | string[] | undefined,
): DoctorView {
  const raw = firstValue(value);
  return DOCTOR_VIEWS.some((view) => view === raw)
    ? (raw as DoctorView)
    : "week";
}

export function parseAppointmentStatusFilter(
  value: string | string[] | undefined,
): AppointmentStatus | null {
  const raw = firstValue(value);
  return raw && isAppointmentStatus(raw) ? raw : null;
}

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function parseStatsPeriod(
  value: string | string[] | undefined,
): StatsPeriod {
  const raw = firstValue(value);
  return STATS_PERIODS.some((period) => period === raw)
    ? (raw as StatsPeriod)
    : "30d";
}

/**
 * Bounds for a statistics period. "all" uses a wide lower bound so the query
 * stays indexed; the label communicates the intent.
 */
export function resolveStatsPeriodBounds(
  period: StatsPeriod,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const end = new Date(now.getTime() + DAY_IN_MILLISECONDS);
  if (period === "all") {
    return { start: new Date("2020-01-01T00:00:00+08:00"), end };
  }
  if (period === "month") {
    const manilaToday = todayInManila(now);
    const monthStart = `${manilaToday.slice(0, 7)}-01`;
    return { start: manilaDayRange(monthStart).start, end };
  }
  const days = period === "7d" ? 7 : 30;
  const todayStart = manilaDayRange(todayInManila(now)).start;
  return {
    start: new Date(todayStart.getTime() - days * DAY_IN_MILLISECONDS),
    end,
  };
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Calendar tab month parameter, defaulting to the current Manila month. */
export function parseCalendarMonth(
  value: string | string[] | undefined,
  now: Date = new Date(),
): string {
  const raw = firstValue(value);
  if (raw && MONTH_PATTERN.test(raw)) {
    return raw;
  }
  return todayInManila(now).slice(0, 7);
}

export function shiftCalendarMonth(month: string, offset: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthIndex - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function calendarMonthLabel(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, monthIndex - 1, 1)));
}

const WEEK_LABEL_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});

function utcDateOf(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDateOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Week-grid `week` parameter: the Sunday (YYYY-MM-DD) that starts the Manila
 * week containing the given date, defaulting to the current week.
 */
export function parseWeekStart(
  value: string | string[] | undefined,
  now: Date = new Date(),
): string {
  const raw = firstValue(value);
  const anchor = raw && isValidManilaDate(raw) ? raw : todayInManila(now);
  const date = utcDateOf(anchor);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return isoDateOf(date);
}

export function shiftWeek(weekStart: string, offset: number): string {
  const date = utcDateOf(weekStart);
  date.setUTCDate(date.getUTCDate() + offset * 7);
  return isoDateOf(date);
}

/** "18 – 24 Oct 2026", "29 Nov – 5 Dec 2026", "27 Dec 2026 – 2 Jan 2027". */
export function weekRangeLabel(weekStart: string): string {
  const start = utcDateOf(weekStart);
  const end = utcDateOf(shiftWeek(weekStart, 1));
  end.setUTCDate(end.getUTCDate() - 1);

  const part = (date: Date, type: Intl.DateTimeFormatPartTypes) =>
    WEEK_LABEL_FORMATTER.formatToParts(date).find((p) => p.type === type)
      ?.value ?? "";
  const endLabel = `${part(end, "day")} ${part(end, "month")} ${part(end, "year")}`;

  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    return `${part(start, "day")} ${part(start, "month")} ${part(start, "year")} – ${endLabel}`;
  }
  if (start.getUTCMonth() !== end.getUTCMonth()) {
    return `${part(start, "day")} ${part(start, "month")} – ${endLabel}`;
  }
  return `${part(start, "day")} – ${endLabel}`;
}
