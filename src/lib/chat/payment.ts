import type { ChargeLineInput, PrivilegeChoice } from "@/lib/billing/compute";
import { formatPesos } from "@/lib/billing/money";
import { formatManilaShortDate, formatManilaTime } from "@/lib/appointments/format";
import { manilaDateOf } from "@/lib/chat/booking";
import { addDays } from "@/lib/chat/resolve";
import type { ChatMessage, ChatRole } from "@/lib/chat/schemas";
import type { PaymentChoice } from "@/lib/chat/state";

/**
 * PAY-03 templated payment replies. Amounts, reference codes, and deadlines
 * come from database rows; the LLM never writes or sees any of this text.
 */
export const PAYMENT_COPY = {
  privilegeQuestion:
    "Do any of these apply to you? You'll need to show the ID at the front desk.",
  payerQuestion: "How will this be paid?",
  priceOnRequest:
    "The fee for this visit is available on request, so I can't book it here. Please contact the hospital front desk and they'll help you book.",
  hmoUnavailable: "That HMO isn't available for booking anymore.",
  /** What the model sees instead of a message that carries payment details. */
  hiddenFromModel: "(Booking details were shown in a card.)",
} as const;

export const PRIVILEGE_LABELS: Record<PrivilegeChoice, string> = {
  senior: "Senior citizen (60+)",
  pwd: "PWD",
  none: "None",
};

/** Button labels; also the patient's side of the turn, so they never carry a member number. */
export function paymentChoiceLabel(payment: PaymentChoice): string {
  switch (payment.payer) {
    case "self":
      return payment.method === "qr_ph" ? "I'll pay (GCash, Maya, bank)" : "Pay at the hospital";
    case "hmo":
      return "My HMO";
    case "philhealth":
      return "PhilHealth";
  }
}

/** "••••4417": member numbers are never shown in full in chat. */
export function maskMemberNumber(memberNumber: string): string {
  return `••••${memberNumber.slice(-4)}`;
}

/**
 * A consultation as a billing line: doctors' fees are not VAT-able here, have
 * no PhilHealth benefit, and HMOs cover them (same constants as 0034).
 */
export function consultationLine(feeCentavos: number): ChargeLineInput {
  return { baseCentavos: feeCentavos, vatable: false, philhealthBenefitCentavos: 0, hmoCoverable: true };
}

/** "4:30 PM today", "8:30 AM tomorrow", or "8:30 AM on 3 Nov" in Manila time. */
export function formatPaymentDeadline(deadline: string, now: Date): string {
  const time = formatManilaTime(deadline);
  const today = manilaDateOf(now.toISOString());
  const day = manilaDateOf(deadline);
  if (day === today) return `${time} today`;
  if (day === addDays(today, 1)) return `${time} tomorrow`;
  return `${time} on ${formatManilaShortDate(deadline)}`;
}

/**
 * The payment request after Confirm. The QR card itself comes with PAY-04;
 * until then the patient gets the amount, deadline, and reference code.
 */
export function paymentRequestCopy(input: {
  amountDueCentavos: number;
  referenceCode: string;
  deadline: string;
  method: "qr_ph" | "counter";
  now: Date;
}): string {
  const amount = formatPesos(input.amountDueCentavos);
  const deadline = formatPaymentDeadline(input.deadline, input.now);
  const lead =
    input.method === "qr_ph"
      ? `Almost done! To hold your slot, please pay ${amount} by ${deadline} and put ${input.referenceCode} in the payment message/notes.`
      : `Almost done! To hold your slot, please pay ${amount} at the hospital cashier by ${deadline} and give the reference code ${input.referenceCode}.`;
  return `${lead} If it isn't paid by then, the request may be cancelled.`;
}

export function hmoPendingCopy(hmoName: string): string {
  return `Thanks! The front desk will check your ${hmoName} coverage. Please request an LOA in your HMO app and bring your HMO card and a valid ID.`;
}

/**
 * Earlier messages as model context. A reply that carried payment details
 * (summary breakdown or payment request) is replaced, so the LLM never sees
 * an amount, reference code, or member number.
 */
export function modelHistory(messages: ChatMessage[]): { role: ChatRole; content: string }[] {
  return messages.map(({ role, content, payload }) => {
    const hasPaymentDetails =
      (payload?.kind === "booking_summary" && payload.charge !== undefined) ||
      (payload?.kind === "booking_result" && payload.payment !== undefined);
    return { role, content: hasPaymentDetails ? PAYMENT_COPY.hiddenFromModel : content };
  });
}
