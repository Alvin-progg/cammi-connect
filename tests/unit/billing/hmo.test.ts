import { describe, expect, it } from "vitest";

import { hmoDecisionSchema, maskMemberNumber, philhealthOffered } from "@/lib/billing/hmo";

const PAYMENT_ID = "00000000-0000-4000-8000-000000000901";
const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000202";

describe("maskMemberNumber", () => {
  it("shows only the last 4 characters", () => {
    expect(maskMemberNumber("1234-5678-4417")).toBe("••••4417");
    expect(maskMemberNumber("417")).toBe("••••417");
  });

  it("never contains the rest of the number", () => {
    expect(maskMemberNumber("MAXI-0099-4417")).not.toContain("0099");
  });
});

describe("philhealthOffered", () => {
  const line = (philhealthBenefitCentavos: number) => ({
    baseCentavos: 150000,
    vatable: false,
    philhealthBenefitCentavos,
    hmoCoverable: true,
  });

  it("offers PhilHealth only when a chosen item has a benefit above ₱0", () => {
    expect(philhealthOffered([line(0)])).toBe(false);
    expect(philhealthOffered([line(50000)])).toBe(true);
    expect(philhealthOffered([line(0), line(50000)])).toBe(true);
    expect(philhealthOffered([])).toBe(false);
  });
});

describe("hmoDecisionSchema", () => {
  it("approves with an LOA number", () => {
    const parsed = hmoDecisionSchema.parse({
      decision: "approve",
      paymentId: PAYMENT_ID,
      appointmentId: APPOINTMENT_ID,
      loaNumber: "  LOA-2026-118  ",
      reason: null,
    });
    expect(parsed).toEqual({
      decision: "approve",
      paymentId: PAYMENT_ID,
      appointmentId: APPOINTMENT_ID,
      loaNumber: "LOA-2026-118",
    });
  });

  it("refuses an approval without an LOA number", () => {
    const result = hmoDecisionSchema.safeParse({
      decision: "approve",
      paymentId: PAYMENT_ID,
      appointmentId: APPOINTMENT_ID,
      loaNumber: " ",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter the LOA number from the HMO.");
  });

  it("denies with a reason", () => {
    const parsed = hmoDecisionSchema.parse({
      decision: "deny",
      paymentId: PAYMENT_ID,
      appointmentId: APPOINTMENT_ID,
      loaNumber: null,
      reason: "Member not eligible",
    });
    expect(parsed).toEqual({
      decision: "deny",
      paymentId: PAYMENT_ID,
      appointmentId: APPOINTMENT_ID,
      reason: "Member not eligible",
    });
  });

  it("refuses a denial without a reason, or an unknown decision", () => {
    expect(
      hmoDecisionSchema.safeParse({ decision: "deny", paymentId: PAYMENT_ID, appointmentId: APPOINTMENT_ID, reason: "" })
        .success,
    ).toBe(false);
    expect(
      hmoDecisionSchema.safeParse({ decision: "maybe", paymentId: PAYMENT_ID, appointmentId: APPOINTMENT_ID }).success,
    ).toBe(false);
  });
});
