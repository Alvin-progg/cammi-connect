import type { PaymentStatus } from "@/lib/billing/payments";

/**
 * PAY-08 revenue numbers (definitions in docs/analytics-definitions.md,
 * "Revenue"). Integer centavos; no patient fields. Every chat payment counts,
 * consultations and service visits alike; the doctor and department filters
 * do not apply.
 */
export type RevenuePayment = {
  status: PaymentStatus;
  amountDueCentavos: number;
  amountReceivedCentavos: number | null;
  verifiedAt: string | null;
  refundedAt: string | null;
  hmoDecidedAt: string | null;
  /** The charge's HMO deduction. */
  hmoCentavos: number;
};

export type RevenueFigure = { centavos: number; count: number };

export type RevenueSummary = {
  /** Money found in the hospital's account: verified in the period, even if refunded later. */
  collected: RevenueFigure;
  /** Refunds marked sent in the period. */
  refunded: RevenueFigure;
  /** Snapshot: paid, then cancelled, refund not sent yet. */
  refundDue: RevenueFigure;
  /** Snapshot: open self-pay requests not paid yet (awaiting, submitted, rejected). */
  outstanding: RevenueFigure;
  /** HMO share of coverage approved in the period. */
  hmoApproved: RevenueFigure;
};

const OUTSTANDING: readonly PaymentStatus[] = ["awaiting_payment", "submitted", "rejected"];

function inPeriod(instant: string | null, period: { start: string; end: string }): boolean {
  if (!instant) return false;
  const time = Date.parse(instant);
  return time >= Date.parse(period.start) && time < Date.parse(period.end);
}

/** What was paid in: the amount received, or the amount due when none was recorded. */
function paidAmount(payment: RevenuePayment): number {
  return payment.amountReceivedCentavos ?? payment.amountDueCentavos;
}

export function revenueSummary(payments: RevenuePayment[], period: { start: string; end: string }): RevenueSummary {
  const summary: RevenueSummary = {
    collected: { centavos: 0, count: 0 },
    refunded: { centavos: 0, count: 0 },
    refundDue: { centavos: 0, count: 0 },
    outstanding: { centavos: 0, count: 0 },
    hmoApproved: { centavos: 0, count: 0 },
  };
  const add = (figure: RevenueFigure, centavos: number) => {
    figure.centavos += centavos;
    figure.count += 1;
  };

  for (const payment of payments) {
    if (inPeriod(payment.verifiedAt, period)) add(summary.collected, paidAmount(payment));
    if (payment.status === "refunded" && inPeriod(payment.refundedAt, period)) add(summary.refunded, paidAmount(payment));
    if (payment.status === "refund_due") add(summary.refundDue, paidAmount(payment));
    if (OUTSTANDING.includes(payment.status)) add(summary.outstanding, payment.amountDueCentavos);
    if (payment.status === "hmo_approved" && inPeriod(payment.hmoDecidedAt, period)) {
      add(summary.hmoApproved, payment.hmoCentavos);
    }
  }
  return summary;
}
