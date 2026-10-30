/**
 * Weekly schedule and schedule-exception shapes shared between the server
 * layer and the dashboard UIs. `dayOfWeek` is 0-6, Sunday-first, in
 * Asia/Manila. A doctor may have several periods on the same weekday.
 */
export type WeeklySchedule = {
  id: string;
  doctorId: string;
  dayOfWeek: number;
  /** "HH:MM" 24-hour, Asia/Manila. */
  startTime: string;
  /** "HH:MM" 24-hour, Asia/Manila. */
  endTime: string;
  slotDurationMinutes: number;
  /** "YYYY-MM-DD" Manila date, inclusive. */
  effectiveFrom: string;
  /** "YYYY-MM-DD" Manila date, inclusive; null means open-ended. */
  effectiveUntil: string | null;
  isActive: boolean;
};

export const SCHEDULE_EXCEPTION_TYPES = [
  "leave",
  "blocked_period",
  "unavailable_date",
  "temporary_change",
] as const;

export type ScheduleExceptionType = (typeof SCHEDULE_EXCEPTION_TYPES)[number];

export const SCHEDULE_EXCEPTION_LABELS: Record<ScheduleExceptionType, string> = {
  leave: "Leave",
  blocked_period: "Blocked period",
  unavailable_date: "Unavailable date",
  temporary_change: "Temporary change",
};

/** An interval where the doctor is unavailable. Always removes availability. */
export type ScheduleException = {
  id: string;
  startsAt: string;
  endsAt: string;
  exceptionType: ScheduleExceptionType;
  reason: string;
};

/** True when the period applies on the given Manila date ("YYYY-MM-DD"). */
export function isScheduleEffectiveOn(
  schedule: Pick<WeeklySchedule, "effectiveFrom" | "effectiveUntil">,
  date: string,
): boolean {
  return (
    schedule.effectiveFrom <= date &&
    (schedule.effectiveUntil === null || schedule.effectiveUntil >= date)
  );
}

export const SLOT_DURATIONS = [15, 30, 45, 60] as const;

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const WEEKDAY_SHORT_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

/**
 * Compact human summary used near reschedule controls, e.g.
 * "Mon 08:00–12:00, 13:00–17:00 · Tue 09:00–12:00". Periods that are not yet
 * or no longer effective on `today` are left out.
 */
export function formatScheduleSummary(
  schedules: WeeklySchedule[],
  today: string,
): string {
  const active = schedules
    .filter(
      (schedule) =>
        schedule.isActive && isScheduleEffectiveOn(schedule, today),
    )
    .sort(
      (a, b) =>
        a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
    );
  if (active.length === 0) {
    return "No regular consultation hours set.";
  }

  const periodsByDay = new Map<number, string[]>();
  for (const schedule of active) {
    const periods = periodsByDay.get(schedule.dayOfWeek) ?? [];
    periods.push(`${schedule.startTime}–${schedule.endTime}`);
    periodsByDay.set(schedule.dayOfWeek, periods);
  }
  return [...periodsByDay]
    .map(
      ([dayOfWeek, periods]) =>
        `${WEEKDAY_SHORT_LABELS[dayOfWeek]} ${periods.join(", ")}`,
    )
    .join(" · ");
}
