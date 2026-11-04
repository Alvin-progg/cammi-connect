import {
  fitsConsultationHours,
  timeToMinutes,
  type ConsultationPeriod,
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
 * The appointments that no consultation period covers. A schedule edit that
 * leaves an upcoming appointment here is refused (spec-admin ADM-05).
 */
export function findAppointmentsOutsideSchedule<Appointment extends SlotInterval>(
  appointments: Appointment[],
  schedules: ConsultationPeriod[],
): Appointment[] {
  return appointments.filter((appointment) => !fitsConsultationHours(appointment, schedules));
}

/**
 * The doctor's periods as they would be after saving `candidate`: it replaces
 * the period `periodId`, or is added when `periodId` is null.
 */
export function withCandidatePeriod(
  schedules: WeeklySchedule[],
  periodId: string | null,
  candidate: ConsultationPeriod,
): ConsultationPeriod[] {
  const others = schedules.filter((schedule) => schedule.id !== periodId);
  return [...others, candidate];
}
