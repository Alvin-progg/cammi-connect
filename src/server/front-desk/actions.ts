"use server";

import { revalidatePath } from "next/cache";

import {
  cancelAppointmentSchema,
  confirmRequestSchema,
  rejectRequestSchema,
  rescheduleAppointmentSchema,
} from "@/lib/front-desk/decisions";
import {
  recordAttendanceSchema,
  type AttendanceStatus,
} from "@/lib/front-desk/schedule";
import { getFrontDeskSession } from "@/server/auth/dal";

import { supabaseFrontDeskRequestsWriter } from "./repository";
import {
  cancelAppointment,
  confirmRequest,
  recordAttendance,
  rejectRequest,
  rescheduleAppointment,
  type DecisionResult,
} from "./service";

export type RequestDecisionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const QUEUE_PATH = "/front-desk/requests";
const SCHEDULE_PATH = "/front-desk/schedule";

/**
 * Runs a decision as the signed-in front desk staff member. The staff ID
 * always comes from the session, never from the form. Views are refreshed
 * only after the database transaction has committed.
 */
async function runDecision(
  appointmentId: string,
  decide: (staffId: string) => Promise<DecisionResult>,
  successMessage: string,
): Promise<RequestDecisionState> {
  const session = await getFrontDeskSession(`${QUEUE_PATH}/${appointmentId}`);
  if (!session) {
    return {
      status: "error",
      message: "You are not authorized to manage appointment requests.",
    };
  }

  const result = await decide(session.staff.id);
  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath(QUEUE_PATH);
  revalidatePath(`${QUEUE_PATH}/${appointmentId}`);
  revalidatePath(SCHEDULE_PATH);
  revalidatePath("/doctor");
  return { status: "success", message: successMessage };
}

export async function confirmRequestAction(
  _previous: RequestDecisionState,
  formData: FormData,
): Promise<RequestDecisionState> {
  const parsed = confirmRequestSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Invalid appointment reference." };
  }
  const { appointmentId } = parsed.data;

  return runDecision(
    appointmentId,
    (staffId) =>
      confirmRequest({ appointmentId, staffId }, supabaseFrontDeskRequestsWriter),
    "Appointment confirmed.",
  );
}

export async function rejectRequestAction(
  _previous: RequestDecisionState,
  formData: FormData,
): Promise<RequestDecisionState> {
  const parsed = rejectRequestSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    reason: formData.get("reason"),
    details: formData.get("details"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the rejection reason.",
    };
  }
  const { appointmentId, rejectionReason } = parsed.data;

  return runDecision(
    appointmentId,
    (staffId) =>
      rejectRequest(
        { appointmentId, staffId, rejectionReason },
        supabaseFrontDeskRequestsWriter,
      ),
    "Request rejected.",
  );
}

const ATTENDANCE_SUCCESS_MESSAGES: Record<AttendanceStatus, string> = {
  checked_in: "Patient checked in.",
  completed: "Appointment marked completed.",
  no_show: "Appointment marked as no-show.",
};

/** Records check-in, completion, or no-show (SPEC-frontdesk §8). */
export async function recordAttendanceAction(
  _previous: RequestDecisionState,
  formData: FormData,
): Promise<RequestDecisionState> {
  const parsed = recordAttendanceSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the attendance update.",
    };
  }
  const { appointmentId, status } = parsed.data;

  return runDecision(
    appointmentId,
    (staffId) =>
      recordAttendance(
        { appointmentId, staffId, status },
        supabaseFrontDeskRequestsWriter,
      ),
    ATTENDANCE_SUCCESS_MESSAGES[status],
  );
}

/** Moves an appointment to another slot with the same doctor (SPEC-frontdesk §9). */
export async function rescheduleAppointmentAction(
  _previous: RequestDecisionState,
  formData: FormData,
): Promise<RequestDecisionState> {
  const parsed = rescheduleAppointmentSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    scheduledAt: formData.get("scheduledAt"),
    reason: formData.get("reason"),
    details: formData.get("details"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the new time and reason.",
    };
  }
  const { appointmentId, scheduledAt, rescheduleReason } = parsed.data;

  return runDecision(
    appointmentId,
    (staffId) =>
      rescheduleAppointment(
        { appointmentId, staffId, scheduledAt, rescheduleReason },
        supabaseFrontDeskRequestsWriter,
      ),
    "Appointment rescheduled.",
  );
}

/** Cancels an appointment with a required reason (SPEC-frontdesk §9). */
export async function cancelAppointmentAction(
  _previous: RequestDecisionState,
  formData: FormData,
): Promise<RequestDecisionState> {
  const parsed = cancelAppointmentSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    reason: formData.get("reason"),
    details: formData.get("details"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the cancellation reason.",
    };
  }
  const { appointmentId, cancellationReason } = parsed.data;

  return runDecision(
    appointmentId,
    (staffId) =>
      cancelAppointment(
        { appointmentId, staffId, cancellationReason },
        supabaseFrontDeskRequestsWriter,
      ),
    "Appointment cancelled.",
  );
}
