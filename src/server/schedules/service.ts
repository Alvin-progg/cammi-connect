import "server-only";

import {
  findAppointmentsOutsideSchedule,
  findOverlappingPeriod,
  withCandidatePeriod,
} from "@/lib/schedules/periods";
import type { SchedulePeriodInput } from "@/lib/schedules/schemas";
import {
  WEEKDAY_LABELS,
  type ScheduleConflict,
  type ScheduleException,
  type ScheduleExceptionType,
  type UpcomingAppointment,
  type WeeklySchedule,
} from "@/lib/schedules/types";

/**
 * `code` is the database refusal, e.g. overlap, not_found,
 * orphans_appointments, or has_appointments; undefined when unexpected.
 */
export type StoreWriteOutcome = { ok: true } | { ok: false; code: string | undefined };

/**
 * Data access contract for doctor schedules and exceptions. Every method is
 * scoped by `doctorId`, which comes from the doctor session or, for admins,
 * from a validated form field after the admin check.
 */
export type DoctorSchedulesStore = {
  listSchedulesForDoctor(doctorId: string): Promise<WeeklySchedule[]>;
  /** Every period of the given doctors, for the admin overview. */
  listSchedulesForDoctors(doctorIds: string[]): Promise<WeeklySchedule[]>;
  listExceptionsForDoctor(input: {
    doctorId: string;
    start: string;
    end: string;
  }): Promise<ScheduleException[]>;
  /**
   * Creates (`periodId` null) or updates a period and writes its audit row in
   * one transaction. The database refuses overlaps and edits that would leave
   * an upcoming appointment outside the hours. `actorId` comes from the session.
   */
  savePeriod(
    input: { actorId: string; doctorId: string; periodId: string | null } & SchedulePeriodInput,
  ): Promise<StoreWriteOutcome>;
  /** Slot-holding appointments starting at or after `from`, soonest first. */
  listUpcomingAppointments(input: { doctorId: string; from: string }): Promise<UpcomingAppointment[]>;
  /**
   * Adds an exception and its audit row in one transaction; `doctorId` null
   * is a hospital holiday. The database refuses one that covers a
   * slot-holding appointment (has_appointments).
   */
  addException(input: {
    actorId: string;
    doctorId: string | null;
    startsAt: string;
    endsAt: string;
    exceptionType: ScheduleExceptionType;
    reason: string;
  }): Promise<StoreWriteOutcome>;
  /** Removes the doctor's exception (or, with `doctorId` null, a holiday), audited. */
  removeException(input: {
    actorId: string;
    doctorId: string | null;
    exceptionId: string;
  }): Promise<StoreWriteOutcome>;
  /**
   * Slot-holding appointments overlapping [start, end): one doctor's, or every
   * doctor's (with `doctorName`) when `doctorId` is null. Soonest first.
   */
  listOverlappingAppointments(input: {
    doctorId: string | null;
    start: string;
    end: string;
  }): Promise<ScheduleConflict[]>;
  /** Hospital holidays overlapping [start, end). */
  listHolidays(input: { start: string; end: string }): Promise<ScheduleException[]>;
  /** Slot-holding (SLOT_HOLDING_STATUSES) appointment intervals starting in [start, end). */
  listActiveIntervals(input: {
    doctorId: string;
    start: string;
    end: string;
  }): Promise<{ start: string; end: string }[]>;
};

export type ScheduleResult =
  | { ok: true; message: string }
  | { ok: false; message: string; conflicts?: ScheduleConflict[] };

const PERIOD_GONE = "That schedule period no longer exists.";
const GENERIC_FAILURE = "Something went wrong. Try again.";

export async function listDoctorSchedules(
  doctorId: string,
  store: DoctorSchedulesStore,
): Promise<WeeklySchedule[]> {
  return store.listSchedulesForDoctor(doctorId);
}

export async function listHospitalHolidays(
  input: { start: Date; end: Date },
  store: Pick<DoctorSchedulesStore, "listHolidays">,
): Promise<ScheduleException[]> {
  return store.listHolidays({ start: input.start.toISOString(), end: input.end.toISOString() });
}

export async function listDoctorExceptions(
  input: { doctorId: string; start: Date; end: Date },
  store: DoctorSchedulesStore,
): Promise<ScheduleException[]> {
  return store.listExceptionsForDoctor({
    doctorId: input.doctorId,
    start: input.start.toISOString(),
    end: input.end.toISOString(),
  });
}

function orphanMessage(count: number): string {
  const appointments = count === 1 ? "1 upcoming appointment" : `${count} upcoming appointments`;
  return `This change would leave ${appointments} outside the doctor's hours. Ask the front desk to reschedule or cancel ${
    count === 1 ? "it" : "them"
  } first, or end-date this period and add a new one.`;
}

/**
 * Creates (`periodId` null) or updates one consultation period. An edit that
 * would move an upcoming requested, confirmed, or checked-in appointment
 * outside the doctor's hours is refused and the appointments are returned
 * (spec-admin ADM-05, D6); nothing is moved. The database re-checks inside
 * the save transaction.
 */
export async function saveSchedulePeriod(
  input: {
    actorId: string;
    doctorId: string;
    periodId: string | null;
    period: SchedulePeriodInput;
    now: Date;
  },
  store: DoctorSchedulesStore,
): Promise<ScheduleResult> {
  const { actorId, doctorId, periodId, period } = input;
  const schedules = await store.listSchedulesForDoctor(doctorId);

  if (periodId && !schedules.some((schedule) => schedule.id === periodId)) {
    return { ok: false, message: PERIOD_GONE };
  }

  const clash = findOverlappingPeriod({ ...period, id: periodId ?? undefined }, schedules);
  if (clash) {
    return {
      ok: false,
      message: `This overlaps the ${WEEKDAY_LABELS[clash.dayOfWeek]} ${clash.startTime}–${clash.endTime} period.`,
    };
  }

  const findOrphans = async (): Promise<ScheduleConflict[]> => {
    const upcoming = await store.listUpcomingAppointments({
      doctorId,
      from: input.now.toISOString(),
    });
    const intervals = upcoming.map((appointment) => ({
      ...appointment,
      start: new Date(appointment.scheduledAt),
      end: new Date(appointment.scheduledEndAt),
    }));
    // Only appointments this edit pushes out count; one that was already
    // outside the hours (legacy data) does not block unrelated edits.
    const alreadyOutside = new Set(
      findAppointmentsOutsideSchedule(intervals, schedules).map((item) => item.appointmentId),
    );
    const proposed = withCandidatePeriod(schedules, periodId, period);
    return findAppointmentsOutsideSchedule(intervals, proposed)
      .filter((item) => !alreadyOutside.has(item.appointmentId))
      .map(({ appointmentId, scheduledAt, status }) => ({ appointmentId, scheduledAt, status }));
  };

  const orphans = await findOrphans();
  if (orphans.length > 0) {
    return { ok: false, message: orphanMessage(orphans.length), conflicts: orphans };
  }

  const outcome = await store.savePeriod({ actorId, doctorId, periodId, ...period });
  if (outcome.ok) {
    return { ok: true, message: "Consultation hours saved." };
  }
  switch (outcome.code) {
    case "overlap":
      return { ok: false, message: "This overlaps another active period on that day." };
    case "not_found":
      return { ok: false, message: PERIOD_GONE };
    case "orphans_appointments": {
      // A booking landed between the check above and the save.
      const conflicts = await findOrphans();
      return { ok: false, message: orphanMessage(Math.max(conflicts.length, 1)), conflicts };
    }
    default:
      return { ok: false, message: GENERIC_FAILURE };
  }
}

function coveredMessage(count: number): string {
  const appointments = count === 1 ? "1 existing appointment" : `${count} existing appointments`;
  return `This exception covers ${appointments}. Ask the front desk to reschedule or cancel ${
    count === 1 ? "it" : "them"
  } first.`;
}

/**
 * Adds an unavailability interval; `doctorId` null adds a hospital holiday
 * for every doctor. An interval that covers a requested, confirmed, or
 * checked-in appointment is refused and the appointments are returned
 * (spec-admin ADM-06, D6); nothing is moved or cancelled. The database
 * re-checks inside the save transaction.
 */
export async function addScheduleException(
  input: {
    actorId: string;
    doctorId: string | null;
    start: Date;
    end: Date;
    exceptionType: ScheduleExceptionType;
    reason: string;
  },
  store: DoctorSchedulesStore,
): Promise<ScheduleResult> {
  const range = {
    doctorId: input.doctorId,
    start: input.start.toISOString(),
    end: input.end.toISOString(),
  };

  const covered = await store.listOverlappingAppointments(range);
  if (covered.length > 0) {
    return { ok: false, message: coveredMessage(covered.length), conflicts: covered };
  }

  const outcome = await store.addException({
    actorId: input.actorId,
    doctorId: input.doctorId,
    startsAt: range.start,
    endsAt: range.end,
    exceptionType: input.exceptionType,
    reason: input.reason,
  });
  if (outcome.ok) {
    return { ok: true, message: input.doctorId === null ? "Holiday added." : "Exception added." };
  }
  if (outcome.code === "has_appointments") {
    // A booking landed between the check above and the save.
    const conflicts = await store.listOverlappingAppointments(range);
    return { ok: false, message: coveredMessage(Math.max(conflicts.length, 1)), conflicts };
  }
  return { ok: false, message: GENERIC_FAILURE };
}

export async function removeScheduleException(
  input: { actorId: string; doctorId: string | null; exceptionId: string },
  store: DoctorSchedulesStore,
): Promise<ScheduleResult> {
  const outcome = await store.removeException(input);
  if (outcome.ok) {
    return { ok: true, message: input.doctorId === null ? "Holiday removed." : "Exception removed." };
  }
  if (outcome.code === "not_found") {
    return {
      ok: false,
      message: input.doctorId === null
        ? "That holiday was already removed."
        : "That exception was already removed.",
    };
  }
  return { ok: false, message: GENERIC_FAILURE };
}
