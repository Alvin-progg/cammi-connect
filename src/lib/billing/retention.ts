import type { AppointmentStatus } from "@/lib/appointments/status";
import type { PaymentStatus } from "@/lib/billing/payments";

/**
 * PAY-001 D5 (ADR-0005 amendment): receipt images are deleted from storage
 * 90 days after the payment is closed. The payment row and its history stay.
 * Used by `npm run payments:purge-receipts` (scripts/purge-receipts.mts), so
 * this file must stay free of runtime imports (Node runs it by type stripping).
 */
export const RECEIPT_RETENTION_DAYS = 90;

const DAY_MS = 86_400_000;

/** Statuses after which no further payment action is expected. */
const CLOSED_STATUSES: readonly PaymentStatus[] = [
  "verified",
  "hmo_approved",
  "expired",
  "not_required",
  "collect_at_counter",
];

export type ReceiptRetentionRow = {
  paymentStatus: PaymentStatus;
  paymentUpdatedAt: string;
  appointmentStatus: AppointmentStatus;
  appointmentUpdatedAt: string;
};

/**
 * When the payment closed, or null while it is open. A closed status is final
 * (its row is not updated again), so `updated_at` is the closing time. An
 * unfinished payment (awaiting, submitted, rejected, HMO pending) also closes
 * once its request is no longer pending, e.g. the patient cancelled it.
 */
export function paymentClosedAt(row: ReceiptRetentionRow): string | null {
  if (CLOSED_STATUSES.includes(row.paymentStatus)) {
    return row.paymentUpdatedAt;
  }
  if (row.appointmentStatus === "requested") {
    return null;
  }
  return Date.parse(row.appointmentUpdatedAt) > Date.parse(row.paymentUpdatedAt)
    ? row.appointmentUpdatedAt
    : row.paymentUpdatedAt;
}

export function isReceiptPurgeable(row: ReceiptRetentionRow, now: Date): boolean {
  const closedAt = paymentClosedAt(row);
  return closedAt !== null && now.getTime() - Date.parse(closedAt) >= RECEIPT_RETENTION_DAYS * DAY_MS;
}
