"use server";

import { revalidatePath } from "next/cache";

import {
  confirmRequestSchema,
  rejectRequestSchema,
} from "@/lib/front-desk/decisions";
import { getFrontDeskSession } from "@/server/auth/dal";

import { supabaseFrontDeskRequestsWriter } from "./repository";
import { confirmRequest, rejectRequest, type DecisionResult } from "./service";

export type RequestDecisionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const QUEUE_PATH = "/front-desk/requests";

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
