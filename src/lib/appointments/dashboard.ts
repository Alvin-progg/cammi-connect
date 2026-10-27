import { isAppointmentStatus, type AppointmentStatus } from "./status";
import {
  isValidManilaDate,
  manilaDayRange,
  todayInManila,
} from "./filters";

/**
 * URL contract for the doctor dashboard views and appointment filters.
 * Kept pure and framework-free so it is unit-testable and reusable by the
 * page and the filter components.
 */
export const DOCTOR_VIEWS = [
  "board",
  "list",
  "calendar",
  "stats",
  "notifications",
  "profile",
] as const;

export type DoctorView = (typeof DOCTOR_VIEWS)[number];

export const APPOINTMENT_RANGES = [
  "today",
  "upcoming",
  "history",
  "day",
] as const;

export type AppointmentRange = (typeof APPOINTMENT_RANGES)[number];

export const STATS_PERIODS = ["7d", "30d", "month", "all"] as const;

export type StatsPeriod = (typeof STATS_PERIODS)[number];

export const DOCTOR_VIEW_LABELS: Record<DoctorView, string> = {
  board: "Board",
  list: "List",
  calendar: "Schedule",
  stats: "Statistics",
  notifications: "Notifications",
  profile: "Profile",
};

export const APPOINTMENT_RANGE_LABELS: Record<AppointmentRange, string> = {
  today: "Today",
  upcoming: "Upcoming",
  history: "History",
  day: "Specific day",
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
    : "board";
}

export function parseAppointmentStatusFilter(
  value: string | string[] | undefined,
): AppointmentStatus | null {
  const raw = firstValue(value);
  return raw && isAppointmentStatus(raw) ? raw : null;
}

/**
 * A specific valid `date` parameter always wins and implies the "day" range.
 * Otherwise the `range` parameter decides, defaulting to "today".
 */
export function parseAppointmentRange(input: {
  range?: string | string[];
  date?: string | string[];
}): { range: AppointmentRange; date: string } {
  const date = firstValue(input.date);
  if (date && isValidManilaDate(date)) {
    return { range: "day", date };
  }

  const raw = firstValue(input.range);
  if (raw === "upcoming" || raw === "history") {
    return { range: raw, date: todayInManila() };
  }
  return { range: "today", date: todayInManila() };
}

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const UPCOMING_DAYS = 7;
const HISTORY_DAYS = 30;

export type ResolvedRange = {
  start: Date;
  end: Date;
  description: string;
};

export function resolveRangeBounds(input: {
  range: AppointmentRange;
  date: string;
}): ResolvedRange {
  if (input.range === "day" || input.range === "today") {
    const { start, end } = manilaDayRange(input.date);
    return {
      start,
      end,
      description:
        input.range === "today" ? "Today" : `Day of ${input.date}`,
    };
  }

  const todayStart = manilaDayRange(todayInManila()).start;
  if (input.range === "upcoming") {
    return {
      start: todayStart,
      end: new Date(todayStart.getTime() + UPCOMING_DAYS * DAY_IN_MILLISECONDS),
      description: `Next ${UPCOMING_DAYS} days`,
    };
  }

  return {
    start: new Date(
      todayStart.getTime() - HISTORY_DAYS * DAY_IN_MILLISECONDS,
    ),
    end: todayStart,
    description: `Past ${HISTORY_DAYS} days`,
  };
}

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
