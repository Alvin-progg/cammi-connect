import type { WeeklySchedule } from "./types";

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

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export type AvailabilityRejection =
  | "past"
  | "outside_hours"
  | "blocked"
  | "overlap";

/**
 * Validates a candidate appointment interval against the doctor's regular
 * hours, blocked slots, and existing active appointments. Pure function; the
 * service layer supplies authoritative data and maps rejections to messages.
 */
export function validateAppointmentSlot(input: {
  start: Date;
  durationMinutes: number;
  now: Date;
  schedules: Pick<
    WeeklySchedule,
    "dayOfWeek" | "startTime" | "endTime" | "isActive"
  >[];
  blocks: SlotInterval[];
  existing: SlotInterval[];
}): { ok: true } | { ok: false; reason: AvailabilityRejection } {
  const { start, durationMinutes, now, schedules, blocks, existing } = input;

  if (start.getTime() <= now.getTime()) {
    return { ok: false, reason: "past" };
  }

  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const startParts = manilaParts(start);
  const endParts = manilaParts(end);

  // The whole consultation must fit inside one active window on the same day.
  const fitsWindow = schedules.some(
    (schedule) =>
      schedule.isActive &&
      schedule.dayOfWeek === startParts.dayOfWeek &&
      startParts.dayOfWeek === endParts.dayOfWeek &&
      startParts.minutesOfDay >= timeToMinutes(schedule.startTime) &&
      endParts.minutesOfDay <= timeToMinutes(schedule.endTime),
  );
  if (!fitsWindow) {
    return { ok: false, reason: "outside_hours" };
  }

  const candidate = { start, end };
  if (blocks.some((block) => intervalsOverlap(candidate, block))) {
    return { ok: false, reason: "blocked" };
  }
  if (existing.some((slot) => intervalsOverlap(candidate, slot))) {
    return { ok: false, reason: "overlap" };
  }
  return { ok: true };
}
