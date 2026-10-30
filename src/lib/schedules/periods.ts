import {
  fitsConsultationHours,
  timeToMinutes,
  type SlotInterval,
} from "./availability";
import type { WeeklySchedule } from "./types";

type PeriodCandidate = Omit<WeeklySchedule, "id" | "doctorId" | "slotDurationMinutes"> & {
  id?: string;
};

function effectiveRangesOverlap(a: PeriodCandidate, b: PeriodCandidate): boolean {
  const aEndsBeforeB = a.effectiveUntil !== null && a.effectiveUntil < b.effectiveFrom;
  const bEndsBeforeA = b.effectiveUntil !== null && b.effectiveUntil < a.effectiveFrom;
  return !aEndsBeforeB && !bEndsBeforeA;
}

/**
 * The first active period that would clash with `candidate`: same weekday,
 * overlapping effective dates, and overlapping `[start, end)` hours. Returns
 * null when the candidate can be saved. Mirrors the
 * doctor_schedules_no_active_overlap constraint so the user gets a friendly
 * message instead of a database error.
 */
export function findOverlappingPeriod<Period extends PeriodCandidate>(
  candidate: PeriodCandidate,
  periods: Period[],
): Period | null {
  if (!candidate.isActive) {
    return null;
  }

  const candidateStart = timeToMinutes(candidate.startTime);
  const candidateEnd = timeToMinutes(candidate.endTime);
  return (
    periods.find(
      (period) =>
        period.isActive &&
        period.id !== candidate.id &&
        period.dayOfWeek === candidate.dayOfWeek &&
        effectiveRangesOverlap(period, candidate) &&
        timeToMinutes(period.startTime) < candidateEnd &&
        candidateStart < timeToMinutes(period.endTime),
    ) ?? null
  );
}

/**
 * How many appointments no longer fit the doctor's consultation hours. Used
 * after a schedule change to report, never to modify, affected bookings.
 */
export function countAppointmentsOutsideSchedule(
  appointments: SlotInterval[],
  schedules: WeeklySchedule[],
): number {
  return appointments.filter(
    (appointment) => !fitsConsultationHours(appointment, schedules),
  ).length;
}
