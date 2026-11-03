import { describe, expect, it } from "vitest";

import { APPOINTMENT_STATUSES } from "@/lib/appointments/status";
import {
  CANCELLATION_REASONS,
  CANCELLATION_REASON_LABELS,
  REJECTION_REASONS,
  REJECTION_REASON_LABELS,
  RESCHEDULE_REASONS,
  RESCHEDULE_REASON_LABELS,
  canFrontDeskCancel,
  canFrontDeskReschedule,
  cancelAppointmentSchema,
  confirmRequestSchema,
  rejectRequestSchema,
  rescheduleAppointmentSchema,
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

describe("front desk change guards", () => {
  it("allows cancelling and rescheduling only requested and confirmed appointments", () => {
    const cancellable = APPOINTMENT_STATUSES.filter((status) => canFrontDeskCancel(status));
    const reschedulable = APPOINTMENT_STATUSES.filter((status) =>
      canFrontDeskReschedule(status),
    );

    expect(cancellable).toEqual(["requested", "confirmed"]);
    expect(reschedulable).toEqual(["requested", "confirmed"]);
  });

  it("refuses to cancel a completed appointment", () => {
    expect(canFrontDeskCancel("completed")).toBe(false);
    expect(canFrontDeskReschedule("completed")).toBe(false);
  });
});

describe("cancelAppointmentSchema", () => {
  it("offers cancellation reasons ending with other", () => {
    expect(CANCELLATION_REASONS.map((reason) => CANCELLATION_REASON_LABELS[reason])).toEqual([
      "Patient request",
      "Doctor unavailable",
      "Hospital schedule change",
      "Duplicate appointment",
      "Other hospital-approved reason",
    ]);
  });

  it("stores the preset label with trimmed details", () => {
    expect(
      cancelAppointmentSchema.parse({
        appointmentId: APPOINTMENT_ID,
        reason: "patient_request",
        details: "  Called the front desk.  ",
      }),
    ).toEqual({
      appointmentId: APPOINTMENT_ID,
      cancellationReason: "Patient request: Called the front desk.",
    });
  });

  it("requires details for an other reason", () => {
    const parsed = cancelAppointmentSchema.safeParse({
      appointmentId: APPOINTMENT_ID,
      reason: "other",
      details: "",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(
      "Describe the reason for cancelling this appointment.",
    );
  });

  it("rejects a missing reason", () => {
    expect(
      cancelAppointmentSchema.safeParse({ appointmentId: APPOINTMENT_ID, reason: null })
        .success,
    ).toBe(false);
  });
});

describe("rescheduleAppointmentSchema", () => {
  const scheduledAt = "2026-11-05T01:30:00.000Z";

  it("offers reschedule reasons ending with other", () => {
    expect(RESCHEDULE_REASONS.map((reason) => RESCHEDULE_REASON_LABELS[reason])).toEqual([
      "Patient request",
      "Doctor unavailable",
      "Hospital schedule change",
      "Other hospital-approved reason",
    ]);
  });

  it("returns the new time and the stored reason", () => {
    expect(
      rescheduleAppointmentSchema.parse({
        appointmentId: APPOINTMENT_ID,
        scheduledAt,
        reason: "doctor_unavailable",
        details: null,
      }),
    ).toEqual({
      appointmentId: APPOINTMENT_ID,
      scheduledAt,
      rescheduleReason: "Doctor unavailable",
    });
  });

  it("requires a valid date-time with an offset", () => {
    for (const value of ["", "tomorrow", "2026-11-05T09:30"]) {
      expect(
        rescheduleAppointmentSchema.safeParse({
          appointmentId: APPOINTMENT_ID,
          scheduledAt: value,
          reason: "patient_request",
        }).success,
      ).toBe(false);
    }
  });

  it("requires details for an other reason", () => {
    const parsed = rescheduleAppointmentSchema.safeParse({
      appointmentId: APPOINTMENT_ID,
      scheduledAt,
      reason: "other",
      details: " ",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(
      "Describe the reason for rescheduling this appointment.",
    );
  });
});
