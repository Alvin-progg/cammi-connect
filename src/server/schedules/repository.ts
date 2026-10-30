import "server-only";

import type {
  ScheduleException,
  WeeklySchedule,
} from "@/lib/schedules/types";
import { supabaseDoctorAppointmentsRepository } from "@/server/appointments/repository";
import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type { DoctorSchedulesStore, PeriodSaveOutcome } from "./service";

const EXCLUSION_VIOLATION = "23P01";

/** Postgres `time` comes back as "HH:MM:SS"; the UI works with "HH:MM". */
function trimTime(time: string): string {
  return time.slice(0, 5);
}

function toPeriodOutcome(
  error: { code?: string } | null,
  affectedRows: number,
): PeriodSaveOutcome {
  if (error?.code === EXCLUSION_VIOLATION) {
    return "overlap";
  }
  if (error) {
    throw new Error("Unable to save the consultation hours.");
  }
  return affectedRows > 0 ? "saved" : "not_found";
}

export const supabaseDoctorSchedulesRepository: DoctorSchedulesStore = {
  async listSchedulesForDoctor(doctorId) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("doctor_schedules")
      .select(
        "id, doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, effective_from, effective_until, is_active",
      )
      .eq("doctor_id", doctorId)
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

  async createSchedulePeriod({ doctorId, ...period }) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("doctor_schedules")
      .insert({
        doctor_id: doctorId,
        day_of_week: period.dayOfWeek,
        start_time: period.startTime,
        end_time: period.endTime,
        slot_duration_minutes: period.slotDurationMinutes,
        effective_from: period.effectiveFrom,
        effective_until: period.effectiveUntil,
        is_active: period.isActive,
      })
      .select("id");

    return toPeriodOutcome(error, (data ?? []).length);
  },

  async updateSchedulePeriod({ doctorId, periodId, ...period }) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("doctor_schedules")
      .update({
        day_of_week: period.dayOfWeek,
        start_time: period.startTime,
        end_time: period.endTime,
        slot_duration_minutes: period.slotDurationMinutes,
        effective_from: period.effectiveFrom,
        effective_until: period.effectiveUntil,
        is_active: period.isActive,
      })
      .eq("id", periodId)
      .eq("doctor_id", doctorId)
      .select("id");

    return toPeriodOutcome(error, (data ?? []).length);
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
