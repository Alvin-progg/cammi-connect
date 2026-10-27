import "server-only";

import type { BlockedSlot, WeeklySchedule } from "@/lib/schedules/types";

/**
 * Data access contract for doctor availability. Always scoped by the session
 * doctor's profile ID.
 */
export type DoctorSchedulesReader = {
  listSchedulesForDoctor(doctorId: string): Promise<WeeklySchedule[]>;
  listBlocksForDoctor(input: {
    doctorId: string;
    start: string;
    end: string;
  }): Promise<BlockedSlot[]>;
  upsertScheduleDay(input: {
    doctorId: string;
    dayOfWeek: number;
    isActive: boolean;
    startTime: string;
    endTime: string;
    slotDurationMinutes: number;
  }): Promise<void>;
  addBlockedSlot(input: {
    doctorId: string;
    startsAt: string;
    endsAt: string;
    reason: string;
  }): Promise<void>;
  removeBlockedSlot(input: {
    doctorId: string;
    blockId: string;
  }): Promise<boolean>;
};

export async function listDoctorSchedules(
  doctorId: string,
  reader: DoctorSchedulesReader,
): Promise<WeeklySchedule[]> {
  return reader.listSchedulesForDoctor(doctorId);
}

export async function listDoctorBlockedSlots(
  input: { doctorId: string; start: Date; end: Date },
  reader: DoctorSchedulesReader,
): Promise<BlockedSlot[]> {
  return reader.listBlocksForDoctor({
    doctorId: input.doctorId,
    start: input.start.toISOString(),
    end: input.end.toISOString(),
  });
}

export async function saveDoctorScheduleDay(
  input: {
    doctorId: string;
    dayOfWeek: number;
    isActive: boolean;
    startTime: string;
    endTime: string;
    slotDurationMinutes: number;
  },
  reader: DoctorSchedulesReader,
): Promise<void> {
  return reader.upsertScheduleDay(input);
}

export async function addDoctorBlockedSlot(
  input: {
    doctorId: string;
    startsAt: Date;
    endsAt: Date;
    reason: string;
  },
  reader: DoctorSchedulesReader,
): Promise<void> {
  return reader.addBlockedSlot({
    doctorId: input.doctorId,
    startsAt: input.startsAt.toISOString(),
    endsAt: input.endsAt.toISOString(),
    reason: input.reason,
  });
}

export async function removeDoctorBlockedSlot(
  input: { doctorId: string; blockId: string },
  reader: DoctorSchedulesReader,
): Promise<boolean> {
  return reader.removeBlockedSlot(input);
}
