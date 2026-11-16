import "server-only";

import {
  receiptRejectionPhrase,
  type ReceiptRejectionReason,
} from "@/lib/billing/verification";
import { PAYMENT_COPY, receiptRejectedCopy, refundSentCopy } from "@/lib/chat/payment";
import type { BookedPayment } from "@/lib/chat/schemas";
import type { DecisionResult } from "@/server/front-desk/service";

import type { ReceiptChatStore } from "./receipts";

export type DatabaseError = { code: string; message: string };

type DecisionOutcome =
  | { ok: true; patientId: string; amountDueCentavos: number }
  | { ok: false; error: DatabaseError };

/**
 * The 0036 functions. Each re-checks the staff role and the payment status
 * in one transaction; the staff ID always comes from the session.
 */
export type PaymentDecisionStore = {
  verify(input: {
    paymentId: string;
    staffId: string;
    transactionReference: string;
    amountReceivedCentavos: number;
    receivedAt: string;
  }): Promise<DecisionOutcome>;
  reject(input: {
    paymentId: string;
    staffId: string;
    reasonCode: ReceiptRejectionReason;
    rejectedReason: string;
  }): Promise<DecisionOutcome>;
  markRefunded(input: {
    paymentId: string;
    staffId: string;
    refundReference: string;
  }): Promise<DecisionOutcome>;
  /** Audits the view and returns the latest receipt's storage path. */
  recordReceiptView(input: {
    paymentId: string;
    staffId: string;
  }): Promise<{ ok: true; storagePath: string } | { ok: false; error: DatabaseError }>;
  signReceiptUrl(storagePath: string, expiresInSeconds: number): Promise<string>;
};

export type PatientChatNotifier = Pick<ReceiptChatStore, "latestConversationId" | "appendMessages">;

/** ADR-0005 amendment: receipt links expire after 60 seconds. */
export const RECEIPT_URL_SECONDS = 60;

export const RAISED_EXCEPTION = "P0001";
const UNIQUE_VIOLATION = "23505";
const DUPLICATE_REFERENCE = "This transaction reference was already used to verify another payment.";
export const GENERIC_ERROR = "The payment could not be updated. Try again in a moment.";

const REFUSALS: Record<string, string> = {
  not_allowed: "You are not authorized to verify payments.",
  payment_not_found: "This payment no longer exists.",
  not_open: "This payment isn't waiting to be verified. Refresh to see its current status.",
  not_pending: "This request is no longer pending. Refresh to see its current status.",
  reference_required: "Enter the transaction reference from the hospital's account.",
  duplicate_reference: DUPLICATE_REFERENCE,
  amount_short: "The amount received is less than the amount due.",
  invalid_received_at: "The time received can't be in the future.",
  reason_required: "Choose a reason for rejecting the receipt.",
};

const REFUND_REFUSALS: Record<string, string> = {
  ...REFUSALS,
  not_open: "This payment isn't waiting for a refund. Refresh to see its current status.",
  reference_required: "Enter the refund reference.",
};

function refusal(error: DatabaseError, messages: Record<string, string>): string {
  // payments_transaction_reference_key: a concurrent verify won the race.
  if (error.code === UNIQUE_VIOLATION) return DUPLICATE_REFERENCE;
  if (error.code === RAISED_EXCEPTION && Object.hasOwn(messages, error.message)) {
    return messages[error.message];
  }
  return GENERIC_ERROR;
}

/**
 * D9: Cami's templated message in the patient's latest conversation. The
 * decision has committed, so a failure here is not reported as a failed
 * decision. The payload hides the text from the model (it can name an
 * amount).
 */
export async function tellPatient(
  patientId: string,
  content: string,
  chat: PatientChatNotifier,
  now: Date,
  payment?: BookedPayment,
): Promise<void> {
  try {
    const conversationId = await chat.latestConversationId(patientId);
    if (!conversationId) return;
    await chat.appendMessages(conversationId, [
      {
        role: "assistant",
        content,
        payload: payment ? { kind: "payment_update", payment } : { kind: "payment_update" },
        createdAt: now,
      },
    ]);
  } catch {
    // Best effort; the patient also sees the status in My appointments.
  }
}

export async function verifyPayment(
  input: Parameters<PaymentDecisionStore["verify"]>[0],
  store: PaymentDecisionStore,
  chat: PatientChatNotifier,
  now: Date = new Date(),
): Promise<DecisionResult> {
  const outcome = await store.verify(input);
  if (!outcome.ok) return { ok: false, message: refusal(outcome.error, REFUSALS) };
  await tellPatient(outcome.patientId, PAYMENT_COPY.paymentVerified, chat, now);
  return { ok: true };
}

export async function rejectReceipt(
  input: {
    paymentId: string;
    staffId: string;
    reasonCode: ReceiptRejectionReason;
    details: string | null;
    rejectedReason: string;
  },
  store: PaymentDecisionStore,
  chat: PatientChatNotifier,
  now: Date = new Date(),
): Promise<DecisionResult> {
  const outcome = await store.reject({
    paymentId: input.paymentId,
    staffId: input.staffId,
    reasonCode: input.reasonCode,
    rejectedReason: input.rejectedReason,
  });
  if (!outcome.ok) return { ok: false, message: refusal(outcome.error, REFUSALS) };
  const phrase = receiptRejectionPhrase(input.reasonCode, input.details, outcome.amountDueCentavos);
  await tellPatient(outcome.patientId, receiptRejectedCopy(phrase), chat, now);
  return { ok: true };
}

export async function markRefunded(
  input: Parameters<PaymentDecisionStore["markRefunded"]>[0],
  store: PaymentDecisionStore,
  chat: PatientChatNotifier,
  now: Date = new Date(),
): Promise<DecisionResult> {
  const outcome = await store.markRefunded(input);
  if (!outcome.ok) return { ok: false, message: refusal(outcome.error, REFUND_REFUSALS) };
  await tellPatient(outcome.patientId, refundSentCopy(input.refundReference), chat, now);
  return { ok: true };
}

/** The view is audited before any link exists; nothing is signed if it is refused. */
export async function viewReceipt(
  input: { paymentId: string; staffId: string },
  store: PaymentDecisionStore,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const recorded = await store.recordReceiptView(input);
  if (!recorded.ok) {
    const { code, message } = recorded.error;
    if (code === RAISED_EXCEPTION && message === "receipt_not_found") {
      return { ok: false, message: "No receipt has been sent for this payment." };
    }
    if (code === RAISED_EXCEPTION && message === "not_allowed") {
      return { ok: false, message: "You are not authorized to view receipts." };
    }
    return { ok: false, message: "The receipt could not be opened. Try again in a moment." };
  }
  return { ok: true, url: await store.signReceiptUrl(recorded.storagePath, RECEIPT_URL_SECONDS) };
}
