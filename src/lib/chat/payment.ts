import type { ChargeLineInput, PrivilegeChoice } from "@/lib/billing/compute";
import { formatPesos } from "@/lib/billing/money";
import type { PaymentStatus } from "@/lib/billing/payments";
import { formatManilaShortDate, formatManilaTime } from "@/lib/appointments/format";
import type { HmoOfferStatus } from "@/lib/benefits/hmo-offer";
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
  /** BEN-05: the discount needs a verified PWD declaration. */
  pwdNotVerified:
    "Your PWD discount needs a verified PWD ID, so I've kept the question open. You can add your PWD ID in your account.",
  /** PAY-04: appended by the receipt route after a successful upload. */
  receiptReceived:
    "Got your receipt, thank you! The front desk will check it and I'll let you know here.",
  /** PAY-04: shown on the payment card when payment.qr_image_path is not set. */
  qrNotConfigured:
    "The hospital's QR code isn't set up yet. Please pay at the hospital cashier and give your reference code.",
  /** PAY-05: appended when the front desk verifies the payment (D9). */
  paymentVerified:
    "Payment received ✔. Your appointment is now waiting for front desk confirmation.",
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

/** The payment request after Confirm; a QR payer also gets the QR card (PAY-04). */
export function paymentRequestCopy(input: {
  amountDueCentavos: number;
  referenceCode: string;
  deadline: string;
  method: "qr_ph" | "counter";
  now: Date;
}): string {
  const amount = formatPesos(input.amountDueCentavos);
  const deadline = formatPaymentDeadline(input.deadline, input.now);
  if (input.method === "qr_ph") {
    return `Almost done! To hold your slot, please pay ${amount} by ${deadline}. Scan the QR with GCash, Maya, or your bank app and put ${input.referenceCode} in the message/notes. Then send me a photo of your receipt here.`;
  }
  return `Almost done! To hold your slot, please pay ${amount} at the hospital cashier by ${deadline} and give the reference code ${input.referenceCode}. If it isn't paid by then, the request may be cancelled.`;
}

/**
 * payment.qr_image_path as an image source, or null when it is unset or not
 * a same-site path (the CSP allows only same-origin images anyway).
 */
export function paymentQrImageSrc(path: string): string | null {
  const trimmed = path.trim();
  return /^\/(?![/\\])[^\s\\]*$/.test(trimmed) ? trimmed : null;
}

/** BEN-05: why a saved membership can't be used for this doctor; undefined when it can. */
export function hmoOfferCopy(offer: HmoOfferStatus, hmoName: string): string | undefined {
  switch (offer.kind) {
    case "offered":
    case "no_membership":
      return undefined;
    case "verification_required":
      return `Your ${hmoName} membership is still waiting for front desk review, so it can't be used yet.`;
    case "membership_not_usable":
      return `Your ${hmoName} membership can't be used for payment. You can check it in your account.`;
    case "doctor_not_accredited":
      return `This doctor doesn't accept ${hmoName}. You can pay by QR Ph or at the counter instead.`;
    case "accreditation_expired":
      return `This doctor's ${hmoName} accreditation has ended. You can pay by QR Ph or at the counter instead.`;
  }
}

export function hmoPendingCopy(hmoName: string): string {
  return `Thanks! The front desk will check your ${hmoName} coverage. Please request an LOA in your HMO app and bring your HMO card and a valid ID.`;
}

/** PAY-06: appended when the front desk approves HMO coverage (D9). */
export function hmoApprovedCopy(hmoName: string): string {
  return `Your ${hmoName} coverage is approved ✔. Your appointment is now waiting for front desk confirmation. Please bring your HMO card and a valid ID.`;
}

/**
 * PAY-06: appended when the front desk denies HMO coverage. The payment is
 * now self-pay (0037): a QR payment with a new deadline, the cashier at the
 * visit when that is less than 2 hours away, or nothing for a ₱0 visit. The
 * denial reason is internal and never repeated to the patient.
 */
export function hmoDeniedCopy(input: {
  status: PaymentStatus;
  amountDueCentavos: number;
  referenceCode: string;
  deadline: string | null;
  now: Date;
}): string {
  const amount = formatPesos(input.amountDueCentavos);
  if (input.status === "awaiting_payment" && input.deadline) {
    const deadline = formatPaymentDeadline(input.deadline, input.now);
    return `Your HMO couldn't cover this visit. You can still pay ${amount} here to keep the slot. Please pay by ${deadline}: scan the QR with GCash, Maya, or your bank app, put ${input.referenceCode} in the message/notes, and send me a photo of your receipt.`;
  }
  if (input.amountDueCentavos === 0) {
    return "Your HMO couldn't cover this visit, but there's nothing to pay for it. Your appointment is now waiting for front desk confirmation.";
  }
  return `Your HMO couldn't cover this visit. Please pay ${amount} at the hospital cashier when you arrive and give the reference code ${input.referenceCode}.`;
}

/** PAY-05: appended when the front desk rejects a receipt (D9). */
export function receiptRejectedCopy(reason: string): string {
  return `The front desk couldn't match your payment: ${reason}. Please check and send the correct receipt.`;
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
      (payload?.kind === "booking_result" && payload.payment !== undefined) ||
      payload?.kind === "payment_update";
    return { role, content: hasPaymentDetails ? PAYMENT_COPY.hiddenFromModel : content };
  });
}
