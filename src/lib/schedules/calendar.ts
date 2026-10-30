import type { AppointmentStatus } from "@/lib/appointments/status";
import { manilaDateOfTimestamp } from "@/lib/appointments/stats";

import { isScheduleEffectiveOn, type WeeklySchedule } from "./types";

export type CalendarDaySummary = {
  /** Manila calendar date, YYYY-MM-DD. */
  date: string;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  hasSchedule: boolean;
  blocked: boolean;
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
  blockedDates: string[];
  countByDate: Map<string, Partial<Record<AppointmentStatus, number>>>;
}): CalendarMonthGrid {
  const [year, monthIndex] = input.month.split("-").map(Number);
  const firstOfMonth = new Date(`${input.month}-01T00:00:00+08:00`);
  const firstWeekday = manilaShifted(firstOfMonth).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();

  const blockedSet = new Set(input.blockedDates);
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
      blocked: blockedSet.has(date),
      counts: input.countByDate.get(date) ?? {},
    });
  }

  return { days };
}
