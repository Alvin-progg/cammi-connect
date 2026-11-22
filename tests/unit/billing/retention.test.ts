import { describe, expect, it } from "vitest";

import { isReceiptPurgeable, paymentClosedAt, RECEIPT_RETENTION_DAYS, type ReceiptRetentionRow } from "@/lib/billing/retention";

const CLOSED = "2026-08-01T00:00:00.000Z";
const APPOINTMENT_UPDATED = "2026-08-05T00:00:00.000Z";

function row(overrides: Partial<ReceiptRetentionRow>): ReceiptRetentionRow {
  return {
    paymentStatus: "verified",
    paymentUpdatedAt: CLOSED,
    appointmentStatus: "confirmed",
    appointmentUpdatedAt: APPOINTMENT_UPDATED,
    ...overrides,
  };
}

describe("receipt retention (PAY-001 D5)", () => {
  it("keeps receipts for 90 days", () => {
    expect(RECEIPT_RETENTION_DAYS).toBe(90);
  });

  it.each(["verified", "hmo_approved", "expired", "not_required", "collect_at_counter"] as const)(
    "treats a %s payment as closed when it last changed",
    (paymentStatus) => {
      expect(paymentClosedAt(row({ paymentStatus }))).toBe(CLOSED);
    },
  );

  it("keeps a verified payment closed after its visit was cancelled (no refunds)", () => {
    expect(paymentClosedAt(row({ paymentStatus: "verified", appointmentStatus: "cancelled" }))).toBe(CLOSED);
  });

  it.each(["awaiting_payment", "submitted", "rejected", "hmo_pending"] as const)(
    "keeps a %s payment open while the request is pending",
    (paymentStatus) => {
      expect(paymentClosedAt(row({ paymentStatus, appointmentStatus: "requested" }))).toBeNull();
    },
  );

  it("closes an unfinished payment when its request is no longer pending, at the later change", () => {
    expect(
      paymentClosedAt(row({ paymentStatus: "rejected", appointmentStatus: "cancelled" })),
    ).toBe(APPOINTMENT_UPDATED);
    expect(
      paymentClosedAt(
        row({ paymentStatus: "submitted", appointmentStatus: "rejected", appointmentUpdatedAt: "2026-07-01T00:00:00.000Z" }),
      ),
    ).toBe(CLOSED);
  });

  it("is purgeable only 90 full days after the payment closed", () => {
    const closed = row({});
    expect(isReceiptPurgeable(closed, new Date("2026-10-29T23:59:59.000Z"))).toBe(false);
    expect(isReceiptPurgeable(closed, new Date("2026-10-30T00:00:00.000Z"))).toBe(true);
    expect(isReceiptPurgeable(row({ paymentStatus: "submitted", appointmentStatus: "requested" }), new Date("2027-01-01"))).toBe(
      false,
    );
  });

  it("compares instants, not strings, so offsets in database timestamps work", () => {
    const closed = row({ paymentUpdatedAt: "2026-08-01T08:00:00+08:00" });
    expect(isReceiptPurgeable(closed, new Date("2026-10-30T00:00:00.000Z"))).toBe(true);
  });
});
