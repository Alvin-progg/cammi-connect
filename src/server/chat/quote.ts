import "server-only";

import { computeCharge, type ChargeLineInput, type PrivilegeChoice } from "@/lib/billing/compute";
import { maskMemberNumber, philhealthOffered } from "@/lib/billing/hmo";
import { BOOKING_COPY } from "@/lib/chat/booking";
import {
  PAYMENT_COPY,
  hmoPendingCopy,
  paymentChoiceLabel,
  paymentRequestCopy,
} from "@/lib/chat/payment";
import type { BookedPayment, ChargeSummary, ServiceRequirementView } from "@/lib/chat/schemas";
import { SERVICE_COPY } from "@/lib/chat/services";
import type { BookingDraft, PaymentChoice } from "@/lib/chat/state";
import { hmoOffered } from "@/lib/services/booking";

import type { BookingContext, BookingReply } from "./booking";

export function withLead(lead: string | undefined, reply: string): string {
  return lead ? `${lead} ${reply}` : reply;
}

export type Quote =
  | {
      ok: true;
      charge: ChargeSummary;
      draft: BookingDraft;
      privilege: PrivilegeChoice;
      payment: PaymentChoice;
      hmoName: string | undefined;
    }
  | { ok: false; reply: BookingReply };

/**
 * PAY-03/PAY-07: the charge for these lines, computed from database prices,
 * or the next question while the discount or payer is still missing.
 * PhilHealth is offered only when a line has a benefit, and an HMO only when
 * it covers a line; a stale choice asks the payer question again. Service
 * requirements are shown with the discount question, so they come before
 * any payment.
 */
export async function quoteLines(
  lines: ChargeLineInput[],
  draft: BookingDraft,
  ctx: BookingContext,
  requirements: ServiceRequirementView[] = [],
): Promise<Quote> {
  const { privilege } = draft;
  if (!privilege) {
    return {
      ok: false,
      reply: {
        reply: requirements.length
          ? `${SERVICE_COPY.requirementsLead} ${PAYMENT_COPY.privilegeQuestion}`
          : PAYMENT_COPY.privilegeQuestion,
        payload: requirements.length
          ? { kind: "privilege_options", requirements }
          : { kind: "privilege_options" },
        state: { step: "choosing_privilege", draft },
      },
    };
  }

  const offerPhilhealth = philhealthOffered(lines);
  const hmoProviders = hmoOffered(lines) ? await ctx.tools.getActiveHmoProviders() : [];
  let payment = draft.payment;
  let lead: string | undefined;
  if (payment?.payer === "philhealth" && !offerPhilhealth) {
    payment = undefined;
  }
  const hmoChoice = payment?.payer === "hmo" ? payment : undefined;
  const hmo = hmoChoice
    ? hmoProviders.find((provider) => provider.id === hmoChoice.hmoProviderId)
    : undefined;
  if (hmoChoice && !hmo) {
    payment = undefined;
    lead = PAYMENT_COPY.hmoUnavailable;
  }
  if (!payment) {
    return {
      ok: false,
      reply: {
        reply: withLead(lead, PAYMENT_COPY.payerQuestion),
        payload: {
          kind: "payer_options",
          philhealth: offerPhilhealth,
          hmoProviders: hmoProviders.map(({ id, name }) => ({ id, name })),
        },
        state: { step: "choosing_payer", draft: { ...draft, payment: undefined } },
      },
    };
  }

  const { totals } = computeCharge({
    items: lines,
    privilege,
    payer: payment.payer,
    hmoCopayCentavos: hmo?.copayCentavos ?? 0,
  });
  const payerLabel =
    payment.payer === "hmo" && hmo
      ? `${hmo.name} (member ${maskMemberNumber(payment.memberNumber)})`
      : paymentChoiceLabel(payment);
  return {
    ok: true,
    charge: { privilege, payerLabel, ...totals },
    draft: { ...draft, payment },
    privilege,
    payment,
    hmoName: hmo?.name,
  };
}

/** The templated reply for a booking with a charge; amounts come from the payment row. */
export function bookedPaymentReply(
  payment: BookedPayment,
  choice: PaymentChoice,
  hmoName: string | undefined,
  now: Date,
  requested: string = BOOKING_COPY.requested,
): string {
  if (payment.status === "hmo_pending") {
    return hmoPendingCopy(hmoName ?? "HMO");
  }
  if (payment.status === "awaiting_payment" && payment.deadline) {
    return paymentRequestCopy({
      amountDueCentavos: payment.amountDueCentavos,
      referenceCode: payment.referenceCode,
      deadline: payment.deadline,
      method: choice.payer === "self" ? choice.method : "qr_ph",
      now,
    });
  }
  return requested;
}
