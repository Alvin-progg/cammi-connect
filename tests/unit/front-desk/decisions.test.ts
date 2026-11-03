import { describe, expect, it } from "vitest";

import {
  REJECTION_REASONS,
  REJECTION_REASON_LABELS,
  confirmRequestSchema,
  rejectRequestSchema,
} from "@/lib/front-desk/decisions";

const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000202";

describe("confirmRequestSchema", () => {
  it("accepts an appointment id", () => {
    expect(confirmRequestSchema.parse({ appointmentId: APPOINTMENT_ID })).toEqual({
      appointmentId: APPOINTMENT_ID,
    });
  });

  it("rejects a malformed id", () => {
    expect(confirmRequestSchema.safeParse({ appointmentId: "202" }).success).toBe(false);
  });
});

describe("rejectRequestSchema", () => {
  it("offers the SPEC-frontdesk §6 rejection reasons", () => {
    expect(REJECTION_REASONS.map((reason) => REJECTION_REASON_LABELS[reason])).toEqual([
      "Requested schedule is no longer available",
      "Incomplete appointment information",
      "Invalid or unsupported appointment request",
      "Doctor unavailable",
      "Other hospital-approved reason",
    ]);
  });

  it("stores the preset label as the rejection reason", () => {
    expect(
      rejectRequestSchema.parse({
        appointmentId: APPOINTMENT_ID,
        reason: "doctor_unavailable",
        details: "",
      }),
    ).toEqual({
      appointmentId: APPOINTMENT_ID,
      rejectionReason: "Doctor unavailable",
    });
  });

  it("appends trimmed details to the preset label", () => {
    expect(
      rejectRequestSchema.parse({
        appointmentId: APPOINTMENT_ID,
        reason: "schedule_unavailable",
        details: "  Doctor's clinic hours changed.  ",
      }).rejectionReason,
    ).toBe("Requested schedule is no longer available: Doctor's clinic hours changed.");
  });

  it("requires details for an other reason", () => {
    const parsed = rejectRequestSchema.safeParse({
      appointmentId: APPOINTMENT_ID,
      reason: "other",
      details: "   ",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(
      "Describe the reason for rejecting this request.",
    );
  });

  it("rejects an unknown reason, a missing reason, and overlong details", () => {
    expect(
      rejectRequestSchema.safeParse({ appointmentId: APPOINTMENT_ID, reason: "spam" }).success,
    ).toBe(false);
    expect(
      rejectRequestSchema.safeParse({ appointmentId: APPOINTMENT_ID, reason: null }).success,
    ).toBe(false);
    expect(
      rejectRequestSchema.safeParse({
        appointmentId: APPOINTMENT_ID,
        reason: "other",
        details: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
});
