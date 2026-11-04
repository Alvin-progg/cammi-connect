import "server-only";

import { intervalsOverlap } from "@/lib/schedules/availability";
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

/** `code` is the database refusal, e.g. overlap, not_found, orphans_appointments. */
export type PeriodSaveOutcome = { ok: true } | { ok: false; code: string | undefined };

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
  ): Promise<PeriodSaveOutcome>;
  /** Slot-holding appointments starting at or after `from`, soonest first. */
  listUpcomingAppointments(input: { doctorId: string; from: string }): Promise<UpcomingAppointment[]>;
  addException(input: {
    doctorId: string;
    startsAt: string;
    endsAt: string;
    exceptionType: ScheduleExceptionType;
    reason: string;
  }): Promise<void>;
  removeException(input: {
    doctorId: string;
    exceptionId: string;
  }): Promise<boolean>;
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

function toIntervals(rows: { start: string; end: string }[]) {
  return rows.map((row) => ({ start: new Date(row.start), end: new Date(row.end) }));
}

function appointmentCount(count: number): string {
  return count === 1 ? "1 existing appointment" : `${count} existing appointments`;
}

export async function listDoctorSchedules(
  doctorId: string,
  store: DoctorSchedulesStore,
): Promise<WeeklySchedule[]> {
  return store.listSchedulesForDoctor(doctorId);
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

/**
 * Adds an unavailability interval. New bookings inside it are refused by the
 * availability check and the booking function; existing appointments are
 * kept and reported.
 */
export async function addScheduleException(
  input: {
    doctorId: string;
    start: Date;
    end: Date;
    exceptionType: ScheduleExceptionType;
    reason: string;
  },
  store: DoctorSchedulesStore,
): Promise<ScheduleResult> {
  await store.addException({
    doctorId: input.doctorId,
    startsAt: input.start.toISOString(),
    endsAt: input.end.toISOString(),
    exceptionType: input.exceptionType,
    reason: input.reason,
  });

  // Appointments that start before the exception may still run into it, so
  // look back one day (longer than any consultation) and filter by overlap.
  const lookBack = new Date(input.start.getTime() - 24 * 60 * 60 * 1000);
  const nearby = await store.listActiveIntervals({
    doctorId: input.doctorId,
    start: lookBack.toISOString(),
    end: input.end.toISOString(),
  });
  const affected = toIntervals(nearby).filter((appointment) =>
    intervalsOverlap(appointment, { start: input.start, end: input.end }),
  ).length;

  if (affected === 0) {
    return { ok: true, message: "Exception added." };
  }
  return {
    ok: true,
    message: `Exception added. ${appointmentCount(affected)} ${
      affected === 1 ? "falls" : "fall"
    } inside it and ${affected === 1 ? "was" : "were"} kept; review ${
      affected === 1 ? "it" : "them"
    } in the appointment list.`,
  };
}

export async function removeScheduleException(
  input: { doctorId: string; exceptionId: string },
  store: DoctorSchedulesStore,
): Promise<ScheduleResult> {
  const removed = await store.removeException(input);
  if (!removed) {
    return { ok: false, message: "That exception was already removed." };
  }
  return { ok: true, message: "Exception removed." };
}
