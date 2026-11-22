/**
 * PAY-001 payment statuses, in the order of the `payment_status` enum
 * (migration 0034). Chat bookings start at `awaiting_payment`, `hmo_pending`,
 * or `not_required`; later slices move them on.
 */
export const PAYMENT_STATUSES = [
  "not_required",
  "hmo_pending",
  "awaiting_payment",
  "submitted",
  "rejected",
  "verified",
  "hmo_approved",
  "expired",
  "collect_at_counter",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Patient-facing labels. */
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  not_required: "No payment needed",
  hmo_pending: "HMO coverage being checked",
  awaiting_payment: "Awaiting payment",
  submitted: "Receipt sent",
  rejected: "Receipt not matched",
  verified: "Paid",
  hmo_approved: "Covered by HMO",
  expired: "Payment expired",
  collect_at_counter: "Pay at the counter",
};
