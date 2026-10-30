import { isScheduleEffectiveOn, type WeeklySchedule } from "./types";

export type SlotInterval = { start: Date; end: Date };

/** Half-open interval overlap: [a.start, a.end) ∩ [b.start, b.end). */
export function intervalsOverlap(a: SlotInterval, b: SlotInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

const MANILA_OFFSET_MILLISECONDS = 8 * 60 * 60 * 1000;

/**
 * Manila calendar facts for a timestamp. Manila is always UTC+08:00 (no DST),
 * so shifting to a pseudo-UTC clock gives exact weekday and time-of-day.
 */
export function manilaParts(date: Date): {
  dayOfWeek: number;
  minutesOfDay: number;
} {
  const shifted = new Date(date.getTime() + MANILA_OFFSET_MILLISECONDS);
  return {
    dayOfWeek: shifted.getUTCDay(),
    minutesOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** Manila calendar date ("YYYY-MM-DD") of a timestamp. */
export function manilaDateKey(date: Date): string {
  return new Date(date.getTime() + MANILA_OFFSET_MILLISECONDS)
    .toISOString()
    .slice(0, 10);
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

type ConsultationPeriod = Pick<
  WeeklySchedule,
  | "dayOfWeek"
  | "startTime"
  | "endTime"
  | "effectiveFrom"
  | "effectiveUntil"
  | "isActive"
>;

/**
 * True when `[start, end)` fits entirely inside one active consultation period
 * that is effective on that Manila date.
 */
export function fitsConsultationHours(
  interval: SlotInterval,
  schedules: ConsultationPeriod[],
): boolean {
  const startParts = manilaParts(interval.start);
  const endParts = manilaParts(interval.end);
  const date = manilaDateKey(interval.start);
  // An interval ending exactly at Manila midnight belongs to the next day, so
  // a consultation may never run past 24:00.
  if (startParts.dayOfWeek !== endParts.dayOfWeek) {
    return false;
  }

  return schedules.some(
    (schedule) =>
      schedule.isActive &&
      schedule.dayOfWeek === startParts.dayOfWeek &&
      isScheduleEffectiveOn(schedule, date) &&
      startParts.minutesOfDay >= timeToMinutes(schedule.startTime) &&
      endParts.minutesOfDay <= timeToMinutes(schedule.endTime),
  );
}

export type AvailabilityRejection =
  | "past"
  | "outside_hours"
  | "blocked"
  | "overlap";

/**
 * Validates a candidate appointment interval against the doctor's
 * consultation periods, schedule exceptions, and existing active
 * appointments. Pure function; the service layer supplies authoritative data
 * and maps rejections to messages.
 */
export function validateAppointmentSlot(input: {
  start: Date;
  durationMinutes: number;
  now: Date;
  schedules: ConsultationPeriod[];
  blocks: SlotInterval[];
  existing: SlotInterval[];
}): { ok: true } | { ok: false; reason: AvailabilityRejection } {
  const { start, durationMinutes, now, schedules, blocks, existing } = input;

  if (start.getTime() <= now.getTime()) {
    return { ok: false, reason: "past" };
  }

  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const candidate = { start, end };
  if (!fitsConsultationHours(candidate, schedules)) {
    return { ok: false, reason: "outside_hours" };
  }

  if (blocks.some((block) => intervalsOverlap(candidate, block))) {
    return { ok: false, reason: "blocked" };
  }
  if (existing.some((slot) => intervalsOverlap(candidate, slot))) {
    return { ok: false, reason: "overlap" };
  }
  return { ok: true };
}
