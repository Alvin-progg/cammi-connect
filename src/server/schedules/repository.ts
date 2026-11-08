import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { SLOT_HOLDING_STATUSES } from "@/lib/appointments/status";
import type {
  ScheduleConflict,
  ScheduleException,
  UpcomingAppointment,
  WeeklySchedule,
} from "@/lib/schedules/types";
import { supabaseDoctorAppointmentsRepository } from "@/server/appointments/repository";
import { REFERENCE_CACHE_TAG } from "@/server/cache/reference-tag";
import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type { DoctorSchedulesStore, StoreWriteOutcome } from "./service";

const EXCLUSION_VIOLATION = "23P01";

/** Postgres `time` comes back as "HH:MM:SS"; the UI works with "HH:MM". */
function trimTime(time: string): string {
  return time.slice(0, 5);
}

/**
 * P0001 refusals carry their code as the message. The overlap exclusion
 * constraint surfaces as 23P01. Anything else is unexpected.
 */
function refusalCode(error: { code?: string; message: string }): string | undefined {
  if (error.code === "P0001") {
    return error.message;
  }
  if (error.code === EXCLUSION_VIOLATION) {
    return "overlap";
  }
  console.error("Schedule save failed.");
  return undefined;
}

function toWriteOutcome(error: { code?: string; message: string } | null): StoreWriteOutcome {
  return error ? { ok: false, code: refusalCode(error) } : { ok: true };
}

const EXCEPTION_COLUMNS = "id, doctor_id, start_datetime, end_datetime, exception_type, reason";

function toScheduleException(row: {
  id: string;
  doctor_id: string | null;
  start_datetime: string;
  end_datetime: string;
  exception_type: ScheduleException["exceptionType"];
  reason: string;
}): ScheduleException {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    startsAt: row.start_datetime,
    endsAt: row.end_datetime,
    exceptionType: row.exception_type,
    reason: row.reason,
  };
}

/** Weekly consultation periods. Cached until a schedule write clears the reference tag. */
async function loadSchedules(doctorIds: string[]): Promise<WeeklySchedule[]> {
  "use cache";
  cacheTag(REFERENCE_CACHE_TAG);
  cacheLife("hours");

  const { data, error } = await getSupabaseAdminClient()
    .from("doctor_schedules")
    .select(
      "id, doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, effective_from, effective_until, is_active",
    )
    .in("doctor_id", doctorIds)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error("Unable to load consultation hours.");
  }
  return (data ?? []).map(
    (row): WeeklySchedule => ({
      id: row.id,
      doctorId: row.doctor_id,
      dayOfWeek: row.day_of_week,
      startTime: trimTime(row.start_time),
      endTime: trimTime(row.end_time),
      slotDurationMinutes: row.slot_duration_minutes,
      effectiveFrom: row.effective_from,
      effectiveUntil: row.effective_until,
      isActive: row.is_active,
    }),
  );
}

/**
 * Schedule exceptions and hospital holidays.
 * Cached until a write action calls `updateTag(REFERENCE_CACHE_TAG)`.
 */
async function cachedListExceptionsForDoctor(
  { doctorId, start, end }: Parameters<DoctorSchedulesStore["listExceptionsForDoctor"]>[0],
): ReturnType<DoctorSchedulesStore["listExceptionsForDoctor"]> {
  "use cache";
  cacheTag(REFERENCE_CACHE_TAG);
  cacheLife("hours");

  const { data, error } = await getSupabaseAdminClient()
    .from("schedule_exceptions")
    .select(EXCEPTION_COLUMNS)
    .or(`doctor_id.eq.${doctorId},doctor_id.is.null`)
    .lt("start_datetime", end)
    .gt("end_datetime", start)
    .order("start_datetime", { ascending: true });

  if (error) {
    throw new Error("Unable to load schedule exceptions.");
  }
  return (data ?? []).map(toScheduleException);
}

async function cachedListHolidays(
  { start, end }: Parameters<DoctorSchedulesStore["listHolidays"]>[0],
): ReturnType<DoctorSchedulesStore["listHolidays"]> {
  "use cache";
  cacheTag(REFERENCE_CACHE_TAG);
  cacheLife("hours");

  const { data, error } = await getSupabaseAdminClient()
    .from("schedule_exceptions")
    .select(EXCEPTION_COLUMNS)
    .is("doctor_id", null)
    .lt("start_datetime", end)
    .gt("end_datetime", start)
    .order("start_datetime", { ascending: true });

  if (error) {
    throw new Error("Unable to load hospital holidays.");
  }
  return (data ?? []).map(toScheduleException);
}

export const supabaseDoctorSchedulesRepository: DoctorSchedulesStore = {
  listSchedulesForDoctor(doctorId) {
    return loadSchedules([doctorId]);
  },

  listSchedulesForDoctors(doctorIds) {
    return doctorIds.length === 0 ? Promise.resolve([]) : loadSchedules(doctorIds);
  },

  /** The doctor's own exceptions plus hospital holidays, which apply to everyone. */
  listExceptionsForDoctor: cachedListExceptionsForDoctor,

  listHolidays: cachedListHolidays,

  async savePeriod({ actorId, doctorId, periodId, ...period }) {
    const { error } = await getSupabaseAdminClient().rpc("cammi_connect_save_schedule_period", {
      p_actor_profile_id: actorId,
      p_doctor_id: doctorId,
      p_period_id: periodId,
      p_day_of_week: period.dayOfWeek,
      p_start_time: period.startTime,
      p_end_time: period.endTime,
      p_slot_duration_minutes: period.slotDurationMinutes,
      p_effective_from: period.effectiveFrom,
      p_effective_until: period.effectiveUntil,
      p_is_active: period.isActive,
    });
    return error ? { ok: false, code: refusalCode(error) } : { ok: true };
  },

  async listUpcomingAppointments({ doctorId, from }) {
    const { data, error } = await getSupabaseAdminClient()
      .from("appointments")
      .select("id, scheduled_at, scheduled_end_at, status")
      .eq("doctor_id", doctorId)
      .in("status", [...SLOT_HOLDING_STATUSES])
      .gte("scheduled_at", from)
      .order("scheduled_at", { ascending: true });

    if (error) {
      throw new Error("Unable to check upcoming appointments.");
    }
    return (data ?? []).map(
      (row): UpcomingAppointment => ({
        appointmentId: row.id,
        scheduledAt: row.scheduled_at,
        scheduledEndAt: row.scheduled_end_at,
        status: row.status,
      }),
    );
  },

  async addException(input) {
    const { error } = await getSupabaseAdminClient().rpc("cammi_connect_add_schedule_exception", {
      p_actor_profile_id: input.actorId,
      p_doctor_id: input.doctorId,
      p_exception_type: input.exceptionType,
      p_start: input.startsAt,
      p_end: input.endsAt,
      p_reason: input.reason,
    });
    return toWriteOutcome(error);
  },

  async removeException({ actorId, doctorId, exceptionId }) {
    const { error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_remove_schedule_exception",
      {
        p_actor_profile_id: actorId,
        p_doctor_id: doctorId,
        p_exception_id: exceptionId,
      },
    );
    return toWriteOutcome(error);
  },

  async listOverlappingAppointments({ doctorId, start, end }) {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("appointments")
      .select("id, doctor_id, scheduled_at, status")
      .in("status", [...SLOT_HOLDING_STATUSES])
      .lt("scheduled_at", end)
      .gt("scheduled_end_at", start)
      .order("scheduled_at", { ascending: true });
    if (doctorId !== null) {
      query = query.eq("doctor_id", doctorId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error("Unable to check appointments in that range.");
    }
    const rows = data ?? [];
    const toConflict = (row: (typeof rows)[number]): ScheduleConflict => ({
      appointmentId: row.id,
      scheduledAt: row.scheduled_at,
      status: row.status,
    });
    if (doctorId !== null || rows.length === 0) {
      return rows.map(toConflict);
    }

    // A holiday spans every doctor, so name the doctor on each appointment.
    const { data: doctors, error: doctorsError } = await supabase
      .from("doctors")
      .select("id, full_name")
      .in("id", [...new Set(rows.map((row) => row.doctor_id))]);
    if (doctorsError) {
      throw new Error("Unable to check appointments in that range.");
    }
    const names = new Map((doctors ?? []).map((doctor) => [doctor.id, doctor.full_name]));
    return rows.map((row) => ({ ...toConflict(row), doctorName: names.get(row.doctor_id) }));
  },

  listActiveIntervals(input) {
    return supabaseDoctorAppointmentsRepository.listActiveIntervals(input);
  },
};
