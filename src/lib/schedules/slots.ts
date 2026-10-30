import {
  intervalsOverlap,
  manilaParts,
  timeToMinutes,
  type SlotInterval,
} from "./availability";
import { isScheduleEffectiveOn, type WeeklySchedule } from "./types";

export type AvailableSlot = { doctorId: string; start: Date; end: Date };

type SlotSchedule = Pick<
  WeeklySchedule,
  | "dayOfWeek"
  | "startTime"
  | "endTime"
  | "slotDurationMinutes"
  | "effectiveFrom"
  | "effectiveUntil"
  | "isActive"
>;

const MINUTE_MILLISECONDS = 60 * 1000;
const DAY_MILLISECONDS = 24 * 60 * MINUTE_MILLISECONDS;

/** Manila calendar dates from `fromDate`, e.g. ["2026-11-02", "2026-11-03"]. */
function manilaDates(fromDate: string, days: number): string[] {
  const first = new Date(`${fromDate}T00:00:00Z`).getTime();
  return Array.from({ length: days }, (_, index) =>
    new Date(first + index * DAY_MILLISECONDS).toISOString().slice(0, 10),
  );
}

/**
 * Bookable slots for one doctor over `days` Manila dates starting at
 * `fromDate`. Each active period that is effective on a date is walked on its
 * own grid of `slotDurationMinutes` from the period start; a partial last slot
 * is not offered. Past slots and slots overlapping an exception or an active
 * appointment are excluded. Pure function; the server supplies the data.
 */
export function generateAvailableSlots(input: {
  doctorId: string;
  schedules: SlotSchedule[];
  exceptions: SlotInterval[];
  existing: SlotInterval[];
  fromDate: string;
  days: number;
  now: Date;
}): AvailableSlot[] {
  const { doctorId, schedules, exceptions, existing, now } = input;
  const slots: AvailableSlot[] = [];

  for (const date of manilaDates(input.fromDate, input.days)) {
    const midnight = new Date(`${date}T00:00:00+08:00`);
    const { dayOfWeek } = manilaParts(midnight);
    const periods = schedules.filter(
      (schedule) =>
        schedule.isActive &&
        schedule.dayOfWeek === dayOfWeek &&
        isScheduleEffectiveOn(schedule, date),
    );

    for (const period of periods) {
      const periodEnd = timeToMinutes(period.endTime);
      for (
        let minute = timeToMinutes(period.startTime);
        minute + period.slotDurationMinutes <= periodEnd;
        minute += period.slotDurationMinutes
      ) {
        const start = new Date(midnight.getTime() + minute * MINUTE_MILLISECONDS);
        const end = new Date(
          start.getTime() + period.slotDurationMinutes * MINUTE_MILLISECONDS,
        );
        const slot = { start, end };
        if (
          start.getTime() > now.getTime() &&
          !exceptions.some((exception) => intervalsOverlap(slot, exception)) &&
          !existing.some((appointment) => intervalsOverlap(slot, appointment))
        ) {
          slots.push({ doctorId, start, end });
        }
      }
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}
