import { z } from "zod";

import type { PrivilegeChoice } from "./compute";
import { formatPesos, pesosToCentavos } from "./money";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "./payments";

/**
 * PAY-05 front desk verification rules. The 0036 SQL functions enforce the
 * same rules; these drive the forms, badges, and the disabled Confirm button.
 */

/** Statuses `cammi_connect_confirm_appointment` accepts (0036). */
export const CONFIRMABLE_PAYMENT_STATUSES = [
  "verified",
  "hmo_approved",
  "not_required",
  "collect_at_counter",
] as const satisfies readonly PaymentStatus[];

/**
 * Null is an appointment with no payment row (front-desk bookings, bookings
 * from before payments, or payment.enabled off), which is not gated.
 */
export function paymentAllowsConfirm(status: PaymentStatus | null): boolean {
  return status === null || (CONFIRMABLE_PAYMENT_STATUSES as readonly PaymentStatus[]).includes(status);
}

export const PAYMENT_NOT_VERIFIED = "Payment not verified yet";

export type PaymentBadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "ai";

/** The front desk queue badge (PAY-001 "Front desk changes"). */
export function paymentBadge(
  payment: { status: PaymentStatus; deadline: string | null },
  now: Date,
): { label: string; tone: PaymentBadgeTone } {
  switch (payment.status) {
    case "awaiting_payment":
    case "rejected": {
      // Until PAY-08 expires them, staff see these as Overdue (D2).
      const overdue = payment.deadline !== null && new Date(payment.deadline) <= now;
      return overdue ? { label: "Overdue", tone: "danger" } : { label: "Awaiting payment", tone: "warning" };
    }
    case "submitted":
      return { label: "Receipt to check", tone: "ai" };
    case "hmo_pending":
      return { label: "HMO to check", tone: "info" };
    case "verified":
      return { label: "Paid", tone: "success" };
    case "hmo_approved":
      return { label: PAYMENT_STATUS_LABELS.hmo_approved, tone: "success" };
    default:
      return { label: PAYMENT_STATUS_LABELS[payment.status], tone: "neutral" };
  }
}

/** The payment panel on request details; front desk only, never doctors. */
export type FrontDeskPayment = {
  id: string;
  status: PaymentStatus;
  method: "qr_ph" | "counter" | null;
  amountDueCentavos: number;
  deadline: string | null;
  attempts: number;
  referenceCode: string;
  privilege: PrivilegeChoice;
  payer: "self" | "hmo" | "philhealth";
  baseCentavos: number;
  vatExemptionCentavos: number;
  privilegeDiscountCentavos: number;
  philhealthCentavos: number;
  hmoCentavos: number;
  transactionReference: string | null;
  amountReceivedCentavos: number | null;
  receivedAt: string | null;
  rejectedReason: string | null;
  refundReference: string | null;
  hasReceipt: boolean;
};

/** One row of the "Refund due" list. */
export type RefundDueItem = {
  paymentId: string;
  appointmentId: string;
  patientName: string;
  referenceCode: string;
  amountReceivedCentavos: number | null;
  transactionReference: string | null;
};

export const RECEIPT_REJECTION_REASONS = [
  "not_found",
  "amount_different",
  "unreadable",
  "already_used",
  "other",
] as const;

export type ReceiptRejectionReason = (typeof RECEIPT_REJECTION_REASONS)[number];

export const RECEIPT_REJECTION_REASON_LABELS: Record<ReceiptRejectionReason, string> = {
  not_found: "Not found in our account",
  amount_different: "Amount is different",
  unreadable: "Receipt is unreadable",
  already_used: "Receipt was already used",
  other: "Other",
};

/** The reason as Cami tells the patient (D9). */
export function receiptRejectionPhrase(
  reason: ReceiptRejectionReason,
  details: string | null,
  amountDueCentavos: number,
): string {
  switch (reason) {
    case "amount_different":
      return `amount is different from ${formatPesos(amountDueCentavos)}`;
    case "other":
      return details ?? RECEIPT_REJECTION_REASON_LABELS.other.toLowerCase();
    default:
      return RECEIPT_REJECTION_REASON_LABELS[reason].toLowerCase();
  }
}

const id = z.uuid("Invalid payment reference.");
const reference = (message: string) => z.string(message).trim().min(1, message).max(100, "Keep the reference under 100 characters.");

/** "2026-11-17T13:45" from a datetime-local input, read as Manila time (UTC+8, no DST). */
const MANILA_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export const verifyPaymentSchema = z.object({
  paymentId: id,
  appointmentId: z.uuid("Invalid appointment reference."),
  transactionReference: reference("Enter the transaction reference from the hospital's account."),
  amountReceived: z.string("Enter the amount received."),
  receivedAt: z.string("Enter the time the payment was received."),
})
  .transform((input, context) => {
    const amountReceivedCentavos = pesosToCentavos(input.amountReceived);
    if (amountReceivedCentavos === null) {
      context.addIssue({ code: "custom", message: "Enter the amount received in pesos.", path: ["amountReceived"] });
      return z.NEVER;
    }
    const receivedAt = MANILA_LOCAL.test(input.receivedAt) ? new Date(`${input.receivedAt}:00+08:00`) : null;
    if (!receivedAt || Number.isNaN(receivedAt.getTime())) {
      context.addIssue({ code: "custom", message: "Enter the time the payment was received.", path: ["receivedAt"] });
      return z.NEVER;
    }
    return {
      paymentId: input.paymentId,
      appointmentId: input.appointmentId,
      transactionReference: input.transactionReference,
      amountReceivedCentavos,
      receivedAt: receivedAt.toISOString(),
    };
  });

export const rejectReceiptSchema = z
  .object({
    paymentId: id,
    appointmentId: z.uuid("Invalid appointment reference."),
    reason: z.enum(RECEIPT_REJECTION_REASONS, "Choose a reason for rejecting the receipt."),
    details: z.string().trim().max(500, "Keep the details under 500 characters.").nullish(),
  })
  .refine((input) => input.reason !== "other" || Boolean(input.details), {
    message: "Write the reason for rejecting the receipt.",
    path: ["details"],
  })
  .transform(({ paymentId, appointmentId, reason, details }) => ({
    paymentId,
    appointmentId,
    reasonCode: reason,
    details: details || null,
    rejectedReason: details
      ? `${RECEIPT_REJECTION_REASON_LABELS[reason]}: ${details}`
      : RECEIPT_REJECTION_REASON_LABELS[reason],
  }));

export const markRefundedSchema = z.object({
  paymentId: id,
  appointmentId: z.uuid("Invalid appointment reference."),
  refundReference: reference("Enter the refund reference."),
});
