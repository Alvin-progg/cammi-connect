import "server-only";

import type { BlockedSlot, WeeklySchedule } from "@/lib/schedules/types";
import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type { DoctorSchedulesReader } from "./service";

type ScheduleRow = {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
};

type BlockRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
};

/** Postgres `time` comes back as "HH:MM:SS"; the UI works with "HH:MM". */
function trimTime(time: string): string {
  return time.slice(0, 5);
}

export const supabaseDoctorSchedulesRepository: DoctorSchedulesReader = {
  async listSchedulesForDoctor(doctorId) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("doctor_schedules")
      .select(
        "id, doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, is_active",
      )
      .eq("doctor_id", doctorId)
      .order("day_of_week", { ascending: true });

    if (error) {
      throw new Error("Unable to load consultation hours.");
    }
    return ((data ?? []) as ScheduleRow[]).map(
      (row): WeeklySchedule => ({
        id: row.id,
        doctorId: row.doctor_id,
        dayOfWeek: row.day_of_week,
        startTime: trimTime(row.start_time),
        endTime: trimTime(row.end_time),
        slotDurationMinutes: row.slot_duration_minutes,
        isActive: row.is_active,
      }),
    );
  },

  async listBlocksForDoctor({ doctorId, start, end }) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("doctor_blocked_slots")
      .select("id, starts_at, ends_at, reason")
      .eq("doctor_id", doctorId)
      .lt("starts_at", end)
      .gt("ends_at", start)
      .order("starts_at", { ascending: true });

    if (error) {
      throw new Error("Unable to load blocked slots.");
    }
    return ((data ?? []) as BlockRow[]).map(
      (row): BlockedSlot => ({
        id: row.id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        reason: row.reason,
      }),
    );
  },

  async upsertScheduleDay(input) {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("doctor_schedules").upsert(
      {
        doctor_id: input.doctorId,
        day_of_week: input.dayOfWeek,
        is_active: input.isActive,
        start_time: input.startTime,
        end_time: input.endTime,
        slot_duration_minutes: input.slotDurationMinutes,
      },
      { onConflict: "doctor_id,day_of_week" },
    );

    if (error) {
      throw new Error("Unable to save the consultation hours.");
    }
  },

  async addBlockedSlot(input) {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("doctor_blocked_slots").insert({
      doctor_id: input.doctorId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      reason: input.reason,
    });

    if (error) {
      throw new Error("Unable to block the selected time.");
    }
  },

  async removeBlockedSlot({ doctorId, blockId }) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("doctor_blocked_slots")
      .delete()
      .eq("id", blockId)
      .eq("doctor_id", doctorId)
      .select("id");

    if (error) {
      throw new Error("Unable to remove the blocked slot.");
    }
    return (data ?? []).length > 0;
  },
};
