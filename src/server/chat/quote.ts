import "server-only";

import { computeCharge, type ChargeLineInput, type PrivilegeChoice } from "@/lib/billing/compute";
import { philhealthOffered } from "@/lib/billing/hmo";
import { BOOKING_COPY } from "@/lib/chat/booking";
import {
  PAYMENT_COPY,
  hmoOfferCopy,
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
  const pwdVerified = await ctx.tools.isPwdVerified({ patientId: ctx.patientId });
  // A PWD choice without a verified declaration is asked again, with the reason.
  if (!privilege || (privilege === "pwd" && !pwdVerified)) {
    const body = requirements.length
      ? `${SERVICE_COPY.requirementsLead} ${PAYMENT_COPY.privilegeQuestion}`
      : PAYMENT_COPY.privilegeQuestion;
    return {
      ok: false,
      reply: {
        reply: privilege === "pwd" ? withLead(PAYMENT_COPY.pwdNotVerified, body) : body,
        payload: {
          kind: "privilege_options",
          pwdVerified,
          ...(requirements.length ? { requirements } : {}),
        },
        state: { step: "choosing_privilege", draft: { ...draft, privilege: undefined } },
      },
    };
  }

  const offerPhilhealth = philhealthOffered(lines);
  const hmoOptions = hmoOffered(lines)
    ? await ctx.tools.getHmoOptions({ patientId: ctx.patientId, doctorId: draft.doctorId ?? null })
    : [];
  let payment = draft.payment;
  let lead: string | undefined;
  if (payment?.payer === "philhealth" && !offerPhilhealth) {
    payment = undefined;
  }
  const hmoChoice = payment?.payer === "hmo" ? payment : undefined;
  const chosenOption = hmoChoice
    ? hmoOptions.find((option) => option.patientHmoId === hmoChoice.patientHmoId)
    : undefined;
  const hmo = chosenOption?.offer.kind === "offered" ? chosenOption : undefined;
  if (hmoChoice && !hmo) {
    payment = undefined;
    lead = chosenOption
      ? hmoOfferCopy(chosenOption.offer, chosenOption.name) ?? PAYMENT_COPY.hmoUnavailable
      : PAYMENT_COPY.hmoUnavailable;
  }
  if (!payment) {
    // The other memberships that can't be used now are explained, not silently hidden.
    const explanations = hmoOptions
      .filter((option) => option.patientHmoId !== hmoChoice?.patientHmoId)
      .map((option) => hmoOfferCopy(option.offer, option.name))
      .filter((text): text is string => text !== undefined);
    const leadText = [lead, ...explanations].filter(Boolean).join(" ") || undefined;
    return {
      ok: false,
      reply: {
        reply: withLead(leadText, PAYMENT_COPY.payerQuestion),
        payload: {
          kind: "payer_options",
          philhealth: offerPhilhealth,
          hmoMemberships: hmoOptions
            .filter((option) => option.offer.kind === "offered")
            .map((option) => ({ patientHmoId: option.patientHmoId, name: option.name, maskedNumber: option.maskedNumber })),
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
      ? `${hmo.name} (member ${hmo.maskedNumber})`
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
      now,
    });
  }
  return requested;
}
