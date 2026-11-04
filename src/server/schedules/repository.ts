import "server-only";

import { SLOT_HOLDING_STATUSES } from "@/lib/appointments/status";
import type {
  ScheduleException,
  UpcomingAppointment,
  WeeklySchedule,
} from "@/lib/schedules/types";
import { supabaseDoctorAppointmentsRepository } from "@/server/appointments/repository";
import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type { DoctorSchedulesStore } from "./service";

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
  console.error("Schedule period save failed.");
  return undefined;
}

async function loadSchedules(doctorIds: string[]): Promise<WeeklySchedule[]> {
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

export const supabaseDoctorSchedulesRepository: DoctorSchedulesStore = {
  listSchedulesForDoctor(doctorId) {
    return loadSchedules([doctorId]);
  },

  listSchedulesForDoctors(doctorIds) {
    return doctorIds.length === 0 ? Promise.resolve([]) : loadSchedules(doctorIds);
  },

  async listExceptionsForDoctor({ doctorId, start, end }) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("schedule_exceptions")
      .select("id, start_datetime, end_datetime, exception_type, reason")
      .eq("doctor_id", doctorId)
      .lt("start_datetime", end)
      .gt("end_datetime", start)
      .order("start_datetime", { ascending: true });

    if (error) {
      throw new Error("Unable to load schedule exceptions.");
    }
    return (data ?? []).map(
      (row): ScheduleException => ({
        id: row.id,
        startsAt: row.start_datetime,
        endsAt: row.end_datetime,
        exceptionType: row.exception_type,
        reason: row.reason,
      }),
    );
  },

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
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("schedule_exceptions").insert({
      doctor_id: input.doctorId,
      start_datetime: input.startsAt,
      end_datetime: input.endsAt,
      exception_type: input.exceptionType,
      reason: input.reason,
    });

    if (error) {
      throw new Error("Unable to add the schedule exception.");
    }
  },

  async removeException({ doctorId, exceptionId }) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("schedule_exceptions")
      .delete()
      .eq("id", exceptionId)
      .eq("doctor_id", doctorId)
      .select("id");

    if (error) {
      throw new Error("Unable to remove the schedule exception.");
    }
    return (data ?? []).length > 0;
  },

  listActiveIntervals(input) {
    return supabaseDoctorAppointmentsRepository.listActiveIntervals(input);
  },
};
