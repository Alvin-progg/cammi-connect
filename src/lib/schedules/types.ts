/**
 * Weekly schedule and blocked-slot shapes shared between the server layer and
 * the doctor dashboard UI. `dayOfWeek` is 0-6, Sunday-first, in Asia/Manila.
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
  isActive: boolean;
};

export type BlockedSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string;
};

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

/** Compact human summary used near reschedule controls, e.g. "Mon 09:00–17:00 · Tue 09:00–12:00". */
export function formatScheduleSummary(schedules: WeeklySchedule[]): string {
  const active = schedules
    .filter((schedule) => schedule.isActive)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  if (active.length === 0) {
    return "No regular consultation hours set.";
  }
  return active
    .map(
      (schedule) =>
        `${WEEKDAY_SHORT_LABELS[schedule.dayOfWeek]} ${schedule.startTime}–${schedule.endTime}`,
    )
    .join(" · ");
}
