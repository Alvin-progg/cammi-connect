import { describe, expect, it } from "vitest";

import {
  markRefundedSchema,
  paymentAllowsConfirm,
  paymentBadge,
  receiptRejectionPhrase,
  rejectReceiptSchema,
  verifyPaymentSchema,
} from "@/lib/billing/verification";

const PAYMENT_ID = "00000000-0000-4000-8000-000000000901";
const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000202";
const NOW = new Date("2026-11-17T06:00:00.000Z");

describe("paymentAllowsConfirm", () => {
  it("allows verified, HMO-approved, no-payment-needed, counter, and no payment row", () => {
    for (const status of ["verified", "hmo_approved", "not_required", "collect_at_counter"] as const) {
      expect(paymentAllowsConfirm(status)).toBe(true);
    }
    expect(paymentAllowsConfirm(null)).toBe(true);
  });

  it("blocks every unpaid or closed status", () => {
    for (const status of [
      "awaiting_payment",
      "submitted",
      "rejected",
      "hmo_pending",
      "expired",
      "refund_due",
      "refunded",
    ] as const) {
      expect(paymentAllowsConfirm(status)).toBe(false);
    }
  });
});

describe("paymentBadge", () => {
  const future = "2026-11-17T08:00:00.000Z";
  const past = "2026-11-17T05:00:00.000Z";

  it("shows the spec's queue badges", () => {
    expect(paymentBadge({ status: "awaiting_payment", deadline: future }, NOW)).toEqual({
      label: "Awaiting payment",
      tone: "warning",
    });
    expect(paymentBadge({ status: "rejected", deadline: future }, NOW).label).toBe("Awaiting payment");
    expect(paymentBadge({ status: "submitted", deadline: past }, NOW).label).toBe("Receipt to check");
    expect(paymentBadge({ status: "hmo_pending", deadline: null }, NOW).label).toBe("HMO to check");
    expect(paymentBadge({ status: "verified", deadline: past }, NOW)).toEqual({ label: "Paid", tone: "success" });
  });

  it("marks unpaid requests past their deadline overdue, but never a submitted receipt", () => {
    expect(paymentBadge({ status: "awaiting_payment", deadline: past }, NOW)).toEqual({
      label: "Overdue",
      tone: "danger",
    });
    expect(paymentBadge({ status: "rejected", deadline: past }, NOW).label).toBe("Overdue");
  });

  it("falls back to the status label for other statuses", () => {
    expect(paymentBadge({ status: "refund_due", deadline: null }, NOW).label).toBe("Refund due");
  });
});

describe("verifyPaymentSchema", () => {
  const valid = {
    paymentId: PAYMENT_ID,
    appointmentId: APPOINTMENT_ID,
    transactionReference: "  GC 1234 5678 ",
    amountReceived: "1,560.50",
    receivedAt: "2026-11-17T13:45",
  };

  it("reads pesos as centavos and the time as Manila time", () => {
    expect(verifyPaymentSchema.parse(valid)).toEqual({
      paymentId: PAYMENT_ID,
      appointmentId: APPOINTMENT_ID,
      transactionReference: "GC 1234 5678",
      amountReceivedCentavos: 156050,
      receivedAt: "2026-11-17T05:45:00.000Z",
    });
  });

  it("requires a reference, an amount, and a time", () => {
    expect(verifyPaymentSchema.safeParse({ ...valid, transactionReference: "  " }).success).toBe(false);
    expect(verifyPaymentSchema.safeParse({ ...valid, amountReceived: "abc" }).success).toBe(false);
    expect(verifyPaymentSchema.safeParse({ ...valid, receivedAt: "" }).success).toBe(false);
    expect(verifyPaymentSchema.safeParse({ ...valid, paymentId: "x" }).success).toBe(false);
  });
});

describe("rejectReceiptSchema", () => {
  it("stores the preset label with any details", () => {
    expect(
      rejectReceiptSchema.parse({
        paymentId: PAYMENT_ID,
        appointmentId: APPOINTMENT_ID,
        reason: "amount_different",
        details: "",
      }),
    ).toEqual({
      paymentId: PAYMENT_ID,
      appointmentId: APPOINTMENT_ID,
      reasonCode: "amount_different",
      details: null,
      rejectedReason: "Amount is different",
    });
  });

  it("requires details for other", () => {
    const base = { paymentId: PAYMENT_ID, appointmentId: APPOINTMENT_ID, reason: "other" };
    expect(rejectReceiptSchema.safeParse({ ...base, details: " " }).success).toBe(false);
    expect(rejectReceiptSchema.parse({ ...base, details: "Paid to the wrong account" }).rejectedReason).toBe(
      "Other: Paid to the wrong account",
    );
  });
});

describe("receiptRejectionPhrase", () => {
  it("names the amount due when the amount is different", () => {
    expect(receiptRejectionPhrase("amount_different", null, 56000)).toBe("amount is different from ₱560.00");
  });

  it("uses the staff's words for other", () => {
    expect(receiptRejectionPhrase("other", "Paid to the wrong account", 56000)).toBe(
      "Paid to the wrong account",
    );
    expect(receiptRejectionPhrase("not_found", null, 56000)).toBe("not found in our account");
  });
});

describe("markRefundedSchema", () => {
  it("requires a refund reference", () => {
    expect(
      markRefundedSchema.parse({ paymentId: PAYMENT_ID, appointmentId: APPOINTMENT_ID, refundReference: " R-1 " }),
    ).toEqual({ paymentId: PAYMENT_ID, appointmentId: APPOINTMENT_ID, refundReference: "R-1" });
    expect(
      markRefundedSchema.safeParse({ paymentId: PAYMENT_ID, appointmentId: APPOINTMENT_ID, refundReference: "" })
        .success,
    ).toBe(false);
  });
});
