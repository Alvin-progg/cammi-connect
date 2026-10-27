"use server";

import { revalidatePath } from "next/cache";

import {
  blockIdSchema,
  blockSlotSchema,
  manilaLocalToUtcInterval,
  scheduleDaySchema,
} from "@/lib/schedules/schemas";
import { getDoctorSession } from "@/server/auth/dal";

import { supabaseDoctorSchedulesRepository } from "./repository";
import {
  addDoctorBlockedSlot,
  removeDoctorBlockedSlot,
  saveDoctorScheduleDay,
} from "./service";

export type ScheduleActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

function firstIssueMessage(error: {
  issues: { message: string }[];
}): string {
  return error.issues[0]?.message ?? "Check the form values.";
}

export async function saveScheduleDayAction(
  _previous: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  const session = await getDoctorSession("/doctor");
  if (!session) {
    return {
      status: "error",
      message: "You are not authorized to manage this schedule.",
    };
  }

  const parsed = scheduleDaySchema.safeParse({
    dayOfWeek: formData.get("dayOfWeek"),
    isActive: formData.get("isActive") === "on",
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    slotDurationMinutes: formData.get("slotDurationMinutes"),
  });
  if (!parsed.success) {
    return { status: "error", message: firstIssueMessage(parsed.error) };
  }

  await saveDoctorScheduleDay(
    { doctorId: session.doctor.id, ...parsed.data },
    supabaseDoctorSchedulesRepository,
  );
  revalidatePath("/doctor");
  return { status: "success", message: "Consultation hours saved." };
}

export async function addBlockedSlotAction(
  _previous: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  const session = await getDoctorSession("/doctor");
  if (!session) {
    return {
      status: "error",
      message: "You are not authorized to manage this schedule.",
    };
  }

  const parsed = blockSlotSchema.safeParse({
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { status: "error", message: firstIssueMessage(parsed.error) };
  }

  const interval = manilaLocalToUtcInterval(parsed.data);
  await addDoctorBlockedSlot(
    {
      doctorId: session.doctor.id,
      startsAt: interval.start,
      endsAt: interval.end,
      reason: parsed.data.reason,
    },
    supabaseDoctorSchedulesRepository,
  );
  revalidatePath("/doctor");
  return { status: "success", message: "Time blocked." };
}

export async function removeBlockedSlotAction(
  _previous: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  const session = await getDoctorSession("/doctor");
  if (!session) {
    return {
      status: "error",
      message: "You are not authorized to manage this schedule.",
    };
  }

  const parsed = blockIdSchema.safeParse(formData.get("blockId"));
  if (!parsed.success) {
    return { status: "error", message: "Invalid blocked slot reference." };
  }

  await removeDoctorBlockedSlot(
    { doctorId: session.doctor.id, blockId: parsed.data },
    supabaseDoctorSchedulesRepository,
  );
  revalidatePath("/doctor");
  return { status: "success", message: "Blocked slot removed." };
}
