import "server-only";

import { intervalsOverlap } from "@/lib/schedules/availability";
import {
  countAppointmentsOutsideSchedule,
  findOverlappingPeriod,
} from "@/lib/schedules/periods";
import type { SchedulePeriodInput } from "@/lib/schedules/schemas";
import {
  WEEKDAY_LABELS,
  type ScheduleException,
  type ScheduleExceptionType,
  type WeeklySchedule,
} from "@/lib/schedules/types";

export type PeriodSaveOutcome = "saved" | "overlap" | "not_found";

/**
 * Data access contract for doctor schedules and exceptions. Every method is
 * scoped by `doctorId`, which comes from the doctor session or, for admins,
 * from a validated form field after the admin check.
 */
export type DoctorSchedulesStore = {
  listSchedulesForDoctor(doctorId: string): Promise<WeeklySchedule[]>;
  listExceptionsForDoctor(input: {
    doctorId: string;
    start: string;
    end: string;
  }): Promise<ScheduleException[]>;
  createSchedulePeriod(
    input: { doctorId: string } & SchedulePeriodInput,
  ): Promise<PeriodSaveOutcome>;
  updateSchedulePeriod(
    input: { doctorId: string; periodId: string } & SchedulePeriodInput,
  ): Promise<PeriodSaveOutcome>;
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
  /** Active (requested/confirmed) appointment intervals starting in [start, end). */
  listActiveIntervals(input: {
    doctorId: string;
    start: string;
    end: string;
  }): Promise<{ start: string; end: string }[]>;
};

export type ScheduleResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/** Far enough ahead to cover every future booking when counting affected ones. */
const OPEN_ENDED = "9999-12-31T00:00:00.000Z";

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

/**
 * Creates (`periodId` null) or updates one consultation period. Existing
 * appointments are never modified; the result reports how many future active
 * appointments no longer fit the doctor's hours so the change is not silent.
 */
export async function saveSchedulePeriod(
  input: {
    doctorId: string;
    periodId: string | null;
    period: SchedulePeriodInput;
    now: Date;
  },
  store: DoctorSchedulesStore,
): Promise<ScheduleResult> {
  const { doctorId, periodId, period } = input;
  const schedules = await store.listSchedulesForDoctor(doctorId);

  if (periodId && !schedules.some((schedule) => schedule.id === periodId)) {
    return { ok: false, message: "That schedule period no longer exists." };
  }

  const clash = findOverlappingPeriod({ ...period, id: periodId ?? undefined }, schedules);
  if (clash) {
    return {
      ok: false,
      message: `This overlaps the ${WEEKDAY_LABELS[clash.dayOfWeek]} ${clash.startTime}–${clash.endTime} period.`,
    };
  }

  const outcome = periodId
    ? await store.updateSchedulePeriod({ doctorId, periodId, ...period })
    : await store.createSchedulePeriod({ doctorId, ...period });
  if (outcome === "overlap") {
    return { ok: false, message: "This overlaps another active period on that day." };
  }
  if (outcome === "not_found") {
    return { ok: false, message: "That schedule period no longer exists." };
  }

  const [updatedSchedules, upcoming] = await Promise.all([
    store.listSchedulesForDoctor(doctorId),
    store.listActiveIntervals({
      doctorId,
      start: input.now.toISOString(),
      end: OPEN_ENDED,
    }),
  ]);
  const outside = countAppointmentsOutsideSchedule(
    toIntervals(upcoming),
    updatedSchedules,
  );
  if (outside === 0) {
    return { ok: true, message: "Consultation hours saved." };
  }
  return {
    ok: true,
    message: `Consultation hours saved. ${appointmentCount(outside)} now ${
      outside === 1 ? "falls" : "fall"
    } outside these hours and ${outside === 1 ? "was" : "were"} kept; review ${
      outside === 1 ? "it" : "them"
    } in the appointment list.`,
  };
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
