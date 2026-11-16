"use server";

import { revalidatePath } from "next/cache";

import { hmoDecisionSchema } from "@/lib/billing/hmo";
import {
  markRefundedSchema,
  rejectReceiptSchema,
  verifyPaymentSchema,
} from "@/lib/billing/verification";
import { getFrontDeskSession } from "@/server/auth/dal";
import { supabaseChatRepository } from "@/server/chat/repository";
import type { RequestDecisionState } from "@/server/front-desk/actions";
import type { DecisionResult } from "@/server/front-desk/service";

import { decideHmo } from "./hmo";
import { supabaseHmoDecisionRepository, supabasePaymentDecisionRepository } from "./repository";
import { markRefunded, rejectReceipt, verifyPayment, viewReceipt } from "./verification";

const QUEUE_PATH = "/front-desk/requests";

/**
 * Runs a PAY-05 payment decision as the signed-in front desk staff member.
 * The staff ID comes from the session; the 0036 functions re-check the role.
 */
async function runPaymentDecision(
  appointmentId: string,
  decide: (staffId: string) => Promise<DecisionResult>,
  successMessage: string,
): Promise<RequestDecisionState> {
  const session = await getFrontDeskSession(`${QUEUE_PATH}/${appointmentId}`);
  if (!session) {
    return { status: "error", message: "You are not authorized to manage payments." };
  }

  const result = await decide(session.staff.id);
  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath(QUEUE_PATH);
  revalidatePath(`${QUEUE_PATH}/${appointmentId}`);
  return { status: "success", message: successMessage };
}

function firstIssue(error: { issues: { message: string }[] }, fallback: string): RequestDecisionState {
  return { status: "error", message: error.issues[0]?.message ?? fallback };
}

export async function verifyPaymentAction(
  _previous: RequestDecisionState,
  formData: FormData,
): Promise<RequestDecisionState> {
  const parsed = verifyPaymentSchema.safeParse({
    paymentId: formData.get("paymentId"),
    appointmentId: formData.get("appointmentId"),
    transactionReference: formData.get("transactionReference"),
    amountReceived: formData.get("amountReceived"),
    receivedAt: formData.get("receivedAt"),
  });
  if (!parsed.success) return firstIssue(parsed.error, "Check the payment details.");
  const { appointmentId, ...input } = parsed.data;

  return runPaymentDecision(
    appointmentId,
    (staffId) =>
      verifyPayment({ ...input, staffId }, supabasePaymentDecisionRepository, supabaseChatRepository),
    "Payment verified.",
  );
}

export async function rejectReceiptAction(
  _previous: RequestDecisionState,
  formData: FormData,
): Promise<RequestDecisionState> {
  const parsed = rejectReceiptSchema.safeParse({
    paymentId: formData.get("paymentId"),
    appointmentId: formData.get("appointmentId"),
    reason: formData.get("reason"),
    details: formData.get("details"),
  });
  if (!parsed.success) return firstIssue(parsed.error, "Check the rejection reason.");
  const { appointmentId, ...input } = parsed.data;

  return runPaymentDecision(
    appointmentId,
    (staffId) =>
      rejectReceipt({ ...input, staffId }, supabasePaymentDecisionRepository, supabaseChatRepository),
    "Receipt rejected. The patient can send another.",
  );
}

export async function markRefundedAction(
  _previous: RequestDecisionState,
  formData: FormData,
): Promise<RequestDecisionState> {
  const parsed = markRefundedSchema.safeParse({
    paymentId: formData.get("paymentId"),
    appointmentId: formData.get("appointmentId"),
    refundReference: formData.get("refundReference"),
  });
  if (!parsed.success) return firstIssue(parsed.error, "Check the refund reference.");
  const { appointmentId, ...input } = parsed.data;

  return runPaymentDecision(
    appointmentId,
    (staffId) =>
      markRefunded({ ...input, staffId }, supabasePaymentDecisionRepository, supabaseChatRepository),
    "Refund recorded.",
  );
}

/** PAY-06: Approve coverage (LOA number) or Deny coverage (reason). */
export async function decideHmoAction(
  _previous: RequestDecisionState,
  formData: FormData,
): Promise<RequestDecisionState> {
  const parsed = hmoDecisionSchema.safeParse({
    decision: formData.get("decision"),
    paymentId: formData.get("paymentId"),
    appointmentId: formData.get("appointmentId"),
    loaNumber: formData.get("loaNumber"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return firstIssue(parsed.error, "Check the HMO decision.");
  const { appointmentId, ...decision } = parsed.data;

  return runPaymentDecision(
    appointmentId,
    (staffId) =>
      decideHmo({ ...decision, staffId }, supabaseHmoDecisionRepository, supabaseChatRepository),
    decision.decision === "approve"
      ? "HMO coverage approved."
      : "HMO coverage denied. The patient can now pay.",
  );
}

export type ReceiptViewState =
  | { status: "error"; message: string }
  | { status: "success"; url: string };

/**
 * A 60-second signed link to the latest receipt, made on demand. The view is
 * audited (payment.receipt_viewed) before the link is created.
 */
export async function viewReceiptAction(paymentId: string): Promise<ReceiptViewState> {
  const session = await getFrontDeskSession(QUEUE_PATH);
  if (!session) {
    return { status: "error", message: "You are not authorized to view receipts." };
  }
  // Server Action arguments are untrusted.
  const parsed = markRefundedSchema.shape.paymentId.safeParse(paymentId);
  if (!parsed.success) {
    return { status: "error", message: "Invalid payment reference." };
  }

  const result = await viewReceipt(
    { paymentId: parsed.data, staffId: session.staff.id },
    supabasePaymentDecisionRepository,
  );
  return result.ok ? { status: "success", url: result.url } : { status: "error", message: result.message };
}
