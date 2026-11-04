import type { AppointmentStatus } from "@/lib/appointments/status";
import { formatManilaMediumDate } from "@/lib/appointments/format";
import { manilaDateOfTimestamp } from "@/lib/appointments/stats";

import {
  isScheduleEffectiveOn,
  WEEKDAY_LABELS,
  type ScheduleException,
  type ScheduleExceptionType,
  type WeeklySchedule,
} from "./types";

/** Monday-first, the order a working week is read in. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** The seven weekdays Monday-first, each with its periods sorted by start time. */
export function groupPeriodsByWeekday<Period extends Pick<WeeklySchedule, "dayOfWeek" | "startTime">>(
  periods: Period[],
): { dayOfWeek: number; label: string; periods: Period[] }[] {
  return WEEK_ORDER.map((dayOfWeek) => ({
    dayOfWeek,
    label: WEEKDAY_LABELS[dayOfWeek],
    periods: periods
      .filter((period) => period.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));
}

/** "Until Dec 31, 2026", "Starts Jan 5, 2027", "Ended …", or "Ongoing". */
export function periodEffectiveLabel(
  period: Pick<WeeklySchedule, "effectiveFrom" | "effectiveUntil">,
  today: string,
): string {
  if (period.effectiveUntil !== null && period.effectiveUntil < today) {
    return `Ended ${formatManilaMediumDate(period.effectiveUntil)}`;
  }
  if (period.effectiveFrom > today) {
    const starts = `Starts ${formatManilaMediumDate(period.effectiveFrom)}`;
    return period.effectiveUntil
      ? `${starts} · until ${formatManilaMediumDate(period.effectiveUntil)}`
      : starts;
  }
  return period.effectiveUntil
    ? `Until ${formatManilaMediumDate(period.effectiveUntil)}`
    : "Ongoing";
}

/** The exception shown on one calendar day. */
export type CalendarDayBlock = {
  type: ScheduleExceptionType;
  reason: string;
  /** True when the exception covers the whole Manila day (00:00–24:00). */
  allDay: boolean;
};

export type CalendarDaySummary = {
  /** Manila calendar date, YYYY-MM-DD. */
  date: string;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  hasSchedule: boolean;
  block: CalendarDayBlock | null;
  counts: Partial<Record<AppointmentStatus, number>>;
};

export type CalendarMonthGrid = {
  /** Flat list of 42 days (6 weeks, Sunday-first) covering the month. */
  days: CalendarDaySummary[];
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const MANILA_OFFSET_MILLISECONDS = 8 * 60 * 60 * 1000;

/** Manila is always UTC+08:00; shifting gives exact Manila calendar fields. */
function manilaShifted(date: Date): Date {
  return new Date(date.getTime() + MANILA_OFFSET_MILLISECONDS);
}

/**
 * Builds a fixed 6-week Sunday-first grid for a Manila month ("YYYY-MM").
 * Schedule flags come from the weekly periods effective on each date; blocks
 * and appointment counts are matched by Manila calendar date.
 */
export function buildMonthGrid(input: {
  month: string;
  today: string;
  schedules: Pick<
    WeeklySchedule,
    "dayOfWeek" | "isActive" | "effectiveFrom" | "effectiveUntil"
  >[];
  blocksByDate: Map<string, CalendarDayBlock>;
  countByDate: Map<string, Partial<Record<AppointmentStatus, number>>>;
}): CalendarMonthGrid {
  const [year, monthIndex] = input.month.split("-").map(Number);
  const firstOfMonth = new Date(`${input.month}-01T00:00:00+08:00`);
  const firstWeekday = manilaShifted(firstOfMonth).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();

  const activeSchedules = input.schedules.filter((schedule) => schedule.isActive);

  const days: CalendarDaySummary[] = [];
  for (let cell = 0; cell < 42; cell += 1) {
    const dayNumber = cell - firstWeekday + 1;
    const cellDate = new Date(
      firstOfMonth.getTime() + (dayNumber - 1) * DAY_IN_MILLISECONDS,
    );
    const date = manilaDateOfTimestamp(cellDate.toISOString());
    const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
    const dayOfWeek = cell % 7;

    days.push({
      date,
      dayOfMonth: manilaShifted(cellDate).getUTCDate(),
      inMonth,
      isToday: date === input.today,
      hasSchedule: activeSchedules.some(
        (schedule) =>
          schedule.dayOfWeek === dayOfWeek && isScheduleEffectiveOn(schedule, date),
      ),
      block: input.blocksByDate.get(date) ?? null,
      counts: input.countByDate.get(date) ?? {},
    });
  }

  return { days };
}

/** Guards against malformed data producing an unbounded loop. */
const MAX_BLOCK_DAYS = 40;

/**
 * Every Manila calendar date touched by an exception, keyed by date. When a
 * date has several exceptions, an all-day one wins so the calendar shows the
 * day as fully unavailable.
 */
export function summarizeBlocksByDate(
  exceptions: Pick<ScheduleException, "startsAt" | "endsAt" | "exceptionType" | "reason">[],
): Map<string, CalendarDayBlock> {
  const blocks = new Map<string, CalendarDayBlock>();
  for (const exception of exceptions) {
    const startsAt = new Date(exception.startsAt).getTime();
    const endsAt = new Date(exception.endsAt).getTime();
    let date = manilaDateOfTimestamp(exception.startsAt);

    for (let guard = 0; guard < MAX_BLOCK_DAYS; guard += 1) {
      const dayStart = new Date(`${date}T00:00:00+08:00`).getTime();
      if (dayStart >= endsAt) {
        break;
      }
      const dayEnd = dayStart + DAY_IN_MILLISECONDS;
      const allDay = startsAt <= dayStart && endsAt >= dayEnd;
      const existing = blocks.get(date);
      if (!existing || (allDay && !existing.allDay)) {
        blocks.set(date, {
          type: exception.exceptionType,
          reason: exception.reason,
          allDay,
        });
      }
      date = manilaDateOfTimestamp(new Date(dayEnd).toISOString());
    }
  }
  return blocks;
}
