import "server-only";

import type { PaymentStatus } from "@/lib/billing/payments";
import { hmoApprovedCopy, hmoDeniedCopy } from "@/lib/chat/payment";
import type { DecisionResult } from "@/server/front-desk/service";

import {
  GENERIC_ERROR,
  RAISED_EXCEPTION,
  tellPatient,
  type DatabaseError,
  type PatientChatNotifier,
} from "./verification";

export type HmoDecisionInput = { paymentId: string; staffId: string } & (
  | { decision: "approve"; loaNumber: string }
  | { decision: "deny"; reason: string }
);

/** The payment after the decision, as cammi_connect_decide_hmo (0037) returns it. */
type HmoDecisionOutcome =
  | {
      ok: true;
      patientId: string;
      status: PaymentStatus;
      method: "qr_ph" | "counter" | null;
      amountDueCentavos: number;
      deadline: string | null;
      referenceCode: string;
      hmoName: string;
    }
  | { ok: false; error: DatabaseError };

/** The 0037 function re-checks the staff role and the payment status in one transaction. */
export type HmoDecisionStore = {
  decideHmo(input: HmoDecisionInput): Promise<HmoDecisionOutcome>;
};

const REFUSALS: Record<string, string> = {
  not_allowed: "You are not authorized to decide HMO coverage.",
  payment_not_found: "This payment no longer exists.",
  not_open: "This payment isn't waiting for an HMO decision. Refresh to see its current status.",
  not_pending: "This request is no longer pending. Refresh to see its current status.",
  loa_required: "Enter the LOA number from the HMO.",
  reason_required: "Write the reason the HMO denied coverage.",
};

/**
 * PAY-06: approve (LOA number) or deny (reason) HMO coverage, then tell the
 * patient in chat (D9). A denial makes the visit self-pay; when it is a QR
 * payment, Cami's message carries the PAY-04 QR card for the new amount.
 */
export async function decideHmo(
  input: HmoDecisionInput,
  store: HmoDecisionStore,
  chat: PatientChatNotifier,
  now: Date = new Date(),
): Promise<DecisionResult> {
  const outcome = await store.decideHmo(input);
  if (!outcome.ok) {
    const { code, message } = outcome.error;
    const known = code === RAISED_EXCEPTION && Object.hasOwn(REFUSALS, message);
    return { ok: false, message: known ? REFUSALS[message] : GENERIC_ERROR };
  }

  if (input.decision === "approve") {
    await tellPatient(outcome.patientId, hmoApprovedCopy(outcome.hmoName), chat, now);
    return { ok: true };
  }

  const content = hmoDeniedCopy({ ...outcome, now });
  const qrCard =
    outcome.status === "awaiting_payment" && outcome.method === "qr_ph"
      ? {
          id: input.paymentId,
          method: outcome.method,
          status: outcome.status,
          amountDueCentavos: outcome.amountDueCentavos,
          referenceCode: outcome.referenceCode,
          deadline: outcome.deadline,
        }
      : undefined;
  await tellPatient(outcome.patientId, content, chat, now, qrCard);
  return { ok: true };
}
