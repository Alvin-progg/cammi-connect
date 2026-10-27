"use server";

import { revalidatePath } from "next/cache";

import {
  appointmentIdSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
} from "@/lib/appointments/schemas";
import type { DoctorAppointmentAction } from "@/lib/appointments/transitions";
import { getDoctorSession } from "@/server/auth/dal";
import { supabaseDoctorSchedulesRepository } from "@/server/schedules/repository";

import { supabaseDoctorAppointmentsRepository } from "./repository";
import {
  rescheduleDoctorAppointment,
  transitionDoctorAppointment,
  type MutationResult,
} from "./service";

export type AppointmentActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const SUCCESS_MESSAGES: Record<DoctorAppointmentAction | "reschedule", string> =
  {
    confirm: "Appointment confirmed.",
    complete: "Appointment marked as completed.",
    no_show: "Appointment marked as no-show.",
    cancel: "Appointment cancelled.",
    reschedule: "Appointment rescheduled.",
  };

async function runDoctorMutation(
  mutate: (doctorId: string) => Promise<MutationResult>,
  successMessage: string,
): Promise<AppointmentActionState> {
  const session = await getDoctorSession("/doctor");
  if (!session) {
    return {
      status: "error",
      message: "You are not authorized to manage appointments.",
    };
  }

  const result = await mutate(session.doctor.id);
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  revalidatePath("/doctor");
  return { status: "success", message: successMessage };
}

function readAppointmentId(
  formData: FormData,
): { appointmentId: string } | AppointmentActionState {
  const parsed = appointmentIdSchema.safeParse(formData.get("appointmentId"));
  if (!parsed.success) {
    return { status: "error", message: "Invalid appointment reference." };
  }
  return { appointmentId: parsed.data };
}

function transitionAction(action: DoctorAppointmentAction) {
  return async (
    _previous: AppointmentActionState,
    formData: FormData,
  ): Promise<AppointmentActionState> => {
    const id = readAppointmentId(formData);
    if ("status" in id) {
      return id;
    }
    return runDoctorMutation(
      (doctorId) =>
        transitionDoctorAppointment(
          { doctorId, appointmentId: id.appointmentId, action },
          supabaseDoctorAppointmentsRepository,
        ),
      SUCCESS_MESSAGES[action],
    );
  };
}

export const confirmAppointmentAction = transitionAction("confirm");
export const completeAppointmentAction = transitionAction("complete");
export const markNoShowAppointmentAction = transitionAction("no_show");

export async function cancelAppointmentAction(
  _previous: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const parsed = cancelAppointmentSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Check the cancellation reason.",
    };
  }
  return runDoctorMutation(
    (doctorId) =>
      transitionDoctorAppointment(
        {
          doctorId,
          appointmentId: parsed.data.appointmentId,
          action: "cancel",
          reason: parsed.data.reason,
        },
        supabaseDoctorAppointmentsRepository,
      ),
    SUCCESS_MESSAGES.cancel,
  );
}

export async function rescheduleAppointmentAction(
  _previous: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  const parsed = rescheduleAppointmentSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    newScheduledAt: formData.get("newScheduledAt"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Check the new date and time.",
    };
  }
  return runDoctorMutation(
    (doctorId) =>
      rescheduleDoctorAppointment(
        {
          doctorId,
          appointmentId: parsed.data.appointmentId,
          newScheduledAt: new Date(parsed.data.newScheduledAt),
          note: parsed.data.note,
        },
        {
          appointments: supabaseDoctorAppointmentsRepository,
          availability: supabaseDoctorSchedulesRepository,
        },
      ),
    SUCCESS_MESSAGES.reschedule,
  );
}
