"use server";

import { revalidatePath } from "next/cache";

import {
  doctorIdSchema,
  exceptionInterval,
  scheduleExceptionSchema,
  schedulePeriodSchema,
  scheduleRecordIdSchema,
} from "@/lib/schedules/schemas";
import { getAdminSession, getDoctorSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";

import { supabaseDoctorSchedulesRepository } from "./repository";
import {
  addScheduleException,
  removeScheduleException,
  saveSchedulePeriod,
  type ScheduleResult,
} from "./service";

export type ScheduleActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

/**
 * Who is editing. A doctor always edits their own schedule (the ID comes from
 * the session; any doctorId in the form is ignored). An admin edits the doctor
 * named in the form, which is validated only after the admin check passes.
 */
type ScheduleEditor = "doctor" | "admin";

const NOT_AUTHORIZED: ScheduleActionState = {
  status: "error",
  message: "You are not authorized to manage this schedule.",
};

function firstIssueMessage(error: {
  issues: { message: string }[];
}): string {
  return error.issues[0]?.message ?? "Check the form values.";
}

async function resolveScheduleDoctorId(
  editor: ScheduleEditor,
  formData: FormData,
): Promise<{ doctorId: string } | { denied: ScheduleActionState }> {
  if (editor === "doctor") {
    const session = await getDoctorSession("/doctor");
    return session ? { doctorId: session.doctor.id } : { denied: NOT_AUTHORIZED };
  }

  const session = await getAdminSession("/admin");
  if (!session) {
    return { denied: NOT_AUTHORIZED };
  }
  const parsed = doctorIdSchema.safeParse(formData.get("doctorId"));
  if (!parsed.success) {
    return { denied: { status: "error", message: firstIssueMessage(parsed.error) } };
  }
  const doctor = await supabaseDirectoryRepository.getDoctor(parsed.data);
  if (!doctor) {
    return { denied: { status: "error", message: "That doctor no longer exists." } };
  }
  return { doctorId: doctor.id };
}

function toActionState(result: ScheduleResult): ScheduleActionState {
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  revalidatePath("/doctor");
  revalidatePath("/admin");
  return { status: "success", message: result.message };
}

function savePeriodAction(editor: ScheduleEditor) {
  return async (
    _previous: ScheduleActionState,
    formData: FormData,
  ): Promise<ScheduleActionState> => {
    const owner = await resolveScheduleDoctorId(editor, formData);
    if ("denied" in owner) {
      return owner.denied;
    }

    const rawPeriodId = formData.get("periodId");
    const periodId = rawPeriodId ? scheduleRecordIdSchema.safeParse(rawPeriodId) : null;
    if (periodId && !periodId.success) {
      return { status: "error", message: firstIssueMessage(periodId.error) };
    }

    const parsed = schedulePeriodSchema.safeParse({
      dayOfWeek: formData.get("dayOfWeek"),
      isActive: formData.get("isActive") === "on",
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
      slotDurationMinutes: formData.get("slotDurationMinutes"),
      effectiveFrom: formData.get("effectiveFrom"),
      effectiveUntil: formData.get("effectiveUntil"),
    });
    if (!parsed.success) {
      return { status: "error", message: firstIssueMessage(parsed.error) };
    }

    return toActionState(
      await saveSchedulePeriod(
        {
          doctorId: owner.doctorId,
          periodId: periodId?.data ?? null,
          period: parsed.data,
          now: new Date(),
        },
        supabaseDoctorSchedulesRepository,
      ),
    );
  };
}

function addExceptionAction(editor: ScheduleEditor) {
  return async (
    _previous: ScheduleActionState,
    formData: FormData,
  ): Promise<ScheduleActionState> => {
    const owner = await resolveScheduleDoctorId(editor, formData);
    if ("denied" in owner) {
      return owner.denied;
    }

    const parsed = scheduleExceptionSchema.safeParse({
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
      exceptionType: formData.get("exceptionType"),
      reason: formData.get("reason"),
    });
    if (!parsed.success) {
      return { status: "error", message: firstIssueMessage(parsed.error) };
    }

    const { start, end } = exceptionInterval(parsed.data);
    return toActionState(
      await addScheduleException(
        {
          doctorId: owner.doctorId,
          start,
          end,
          exceptionType: parsed.data.exceptionType,
          reason: parsed.data.reason,
        },
        supabaseDoctorSchedulesRepository,
      ),
    );
  };
}

function removeExceptionAction(editor: ScheduleEditor) {
  return async (
    _previous: ScheduleActionState,
    formData: FormData,
  ): Promise<ScheduleActionState> => {
    const owner = await resolveScheduleDoctorId(editor, formData);
    if ("denied" in owner) {
      return owner.denied;
    }

    const parsed = scheduleRecordIdSchema.safeParse(formData.get("exceptionId"));
    if (!parsed.success) {
      return { status: "error", message: firstIssueMessage(parsed.error) };
    }

    return toActionState(
      await removeScheduleException(
        { doctorId: owner.doctorId, exceptionId: parsed.data },
        supabaseDoctorSchedulesRepository,
      ),
    );
  };
}

export const saveSchedulePeriodAction = savePeriodAction("doctor");
export const addScheduleExceptionAction = addExceptionAction("doctor");
export const removeScheduleExceptionAction = removeExceptionAction("doctor");

export const adminSaveSchedulePeriodAction = savePeriodAction("admin");
export const adminAddScheduleExceptionAction = addExceptionAction("admin");
export const adminRemoveScheduleExceptionAction = removeExceptionAction("admin");
