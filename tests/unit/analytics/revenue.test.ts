import { describe, expect, it } from "vitest";

import { revenueSummary, type RevenuePayment } from "@/lib/analytics/revenue";

const PERIOD = { start: "2026-10-31T16:00:00.000Z", end: "2026-11-30T16:00:00.000Z" };
const INSIDE = "2026-11-10T02:00:00+00:00";
const BEFORE = "2026-10-31T15:59:59+00:00";

function payment(overrides: Partial<RevenuePayment>): RevenuePayment {
  return {
    status: "awaiting_payment",
    amountDueCentavos: 56000,
    amountReceivedCentavos: null,
    verifiedAt: null,
    refundedAt: null,
    hmoDecidedAt: null,
    hmoCentavos: 0,
    ...overrides,
  };
}

describe("revenue summary (PAY-08)", () => {
  it("is all zeros with no payments", () => {
    expect(revenueSummary([], PERIOD)).toEqual({
      collected: { centavos: 0, count: 0 },
      refunded: { centavos: 0, count: 0 },
      refundDue: { centavos: 0, count: 0 },
      outstanding: { centavos: 0, count: 0 },
      hmoApproved: { centavos: 0, count: 0 },
    });
  });

  it("counts collected money by verified time, using the amount received, even if refunded later", () => {
    const summary = revenueSummary(
      [
        payment({ status: "verified", verifiedAt: INSIDE, amountReceivedCentavos: 56000 }),
        payment({ status: "refunded", verifiedAt: INSIDE, amountReceivedCentavos: 70000, refundedAt: INSIDE }),
        payment({ status: "verified", verifiedAt: BEFORE, amountReceivedCentavos: 99900 }),
        payment({ status: "verified", verifiedAt: PERIOD.end, amountReceivedCentavos: 99900 }),
      ],
      PERIOD,
    );
    expect(summary.collected).toEqual({ centavos: 126000, count: 2 });
  });

  it("counts refunds by refund time", () => {
    const summary = revenueSummary(
      [
        payment({ status: "refunded", verifiedAt: BEFORE, amountReceivedCentavos: 70000, refundedAt: INSIDE }),
        payment({ status: "refunded", verifiedAt: BEFORE, amountReceivedCentavos: 50000, refundedAt: BEFORE }),
      ],
      PERIOD,
    );
    expect(summary.refunded).toEqual({ centavos: 70000, count: 1 });
  });

  it("shows refund due and outstanding as snapshots of open payments", () => {
    const summary = revenueSummary(
      [
        payment({ status: "refund_due", verifiedAt: BEFORE, amountReceivedCentavos: 56000 }),
        payment({ status: "awaiting_payment", amountDueCentavos: 70000 }),
        payment({ status: "submitted", amountDueCentavos: 56000 }),
        payment({ status: "rejected", amountDueCentavos: 10000 }),
        payment({ status: "expired", amountDueCentavos: 99900 }),
        payment({ status: "hmo_pending", amountDueCentavos: 0 }),
      ],
      PERIOD,
    );
    expect(summary.refundDue).toEqual({ centavos: 56000, count: 1 });
    expect(summary.outstanding).toEqual({ centavos: 136000, count: 3 });
  });

  it("refunds the amount due when no amount received was recorded", () => {
    const summary = revenueSummary([payment({ status: "refund_due", amountDueCentavos: 42000 })], PERIOD);
    expect(summary.refundDue).toEqual({ centavos: 42000, count: 1 });
  });

  it("sums the HMO share of approvals decided in the period", () => {
    const summary = revenueSummary(
      [
        payment({ status: "hmo_approved", hmoDecidedAt: INSIDE, hmoCentavos: 60000, amountDueCentavos: 10000 }),
        payment({ status: "hmo_approved", hmoDecidedAt: BEFORE, hmoCentavos: 70000 }),
        // A denial also sets hmo_decided_at; it is not an approval.
        payment({ status: "awaiting_payment", hmoDecidedAt: INSIDE, hmoCentavos: 0 }),
      ],
      PERIOD,
    );
    expect(summary.hmoApproved).toEqual({ centavos: 60000, count: 1 });
  });
});
