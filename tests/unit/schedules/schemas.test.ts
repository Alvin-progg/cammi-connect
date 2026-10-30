import { describe, expect, it } from "vitest";

import {
  availabilityQuerySchema,
  exceptionInterval,
  scheduleExceptionSchema,
  schedulePeriodSchema,
} from "@/lib/schedules/schemas";

const DOCTOR_ID = "00000000-0000-4000-8000-000000000101";
const SPECIALTY_ID = "00000000-0000-4000-8000-000000000701";

const VALID_PERIOD = {
  dayOfWeek: "1",
  startTime: "08:00",
  endTime: "12:00",
  slotDurationMinutes: "30",
  effectiveFrom: "2026-11-02",
  effectiveUntil: "",
  isActive: true,
};

function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe("schedulePeriodSchema", () => {
  it("parses form values and treats a blank effective-until as open-ended", () => {
    expect(schedulePeriodSchema.parse(VALID_PERIOD)).toEqual({
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "12:00",
      slotDurationMinutes: 30,
      effectiveFrom: "2026-11-02",
      effectiveUntil: null,
      isActive: true,
    });
  });

  it("rejects an end time before the start time", () => {
    const result = schedulePeriodSchema.safeParse({ ...VALID_PERIOD, endTime: "07:00" });
    expect(firstMessage(result)).toBe("End time must be after the start time.");
  });

  it("rejects an effective-until before effective-from", () => {
    const result = schedulePeriodSchema.safeParse({
      ...VALID_PERIOD,
      effectiveUntil: "2026-11-01",
    });
    expect(firstMessage(result)).toBe(
      "The last effective date cannot be before the first.",
    );
  });

  it("only allows the configured slot durations", () => {
    expect(
      schedulePeriodSchema.safeParse({ ...VALID_PERIOD, slotDurationMinutes: "20" }).success,
    ).toBe(false);
  });
});

describe("scheduleExceptionSchema and exceptionInterval", () => {
  it("blocks whole Manila days when no times are given", () => {
    const parsed = scheduleExceptionSchema.parse({
      startDate: "2026-11-02",
      endDate: "2026-11-03",
      startTime: "",
      endTime: "",
      exceptionType: "leave",
      reason: "Annual leave",
    });

    expect(exceptionInterval(parsed)).toEqual({
      start: new Date("2026-11-02T00:00:00+08:00"),
      end: new Date("2026-11-04T00:00:00+08:00"),
    });
  });

  it("blocks a time range on one date, defaulting the end date", () => {
    const parsed = scheduleExceptionSchema.parse({
      startDate: "2026-11-02",
      endDate: "",
      startTime: "10:00",
      endTime: "11:30",
      exceptionType: "blocked_period",
      reason: "Grand rounds",
    });

    expect(exceptionInterval(parsed)).toEqual({
      start: new Date("2026-11-02T10:00:00+08:00"),
      end: new Date("2026-11-02T11:30:00+08:00"),
    });
  });

  it("requires both times or neither", () => {
    const result = scheduleExceptionSchema.safeParse({
      startDate: "2026-11-02",
      startTime: "10:00",
      endTime: "",
      exceptionType: "blocked_period",
      reason: "Grand rounds",
    });
    expect(firstMessage(result)).toBe(
      "Enter both a start and end time, or leave both blank for whole days.",
    );
  });

  it("rejects an exception that ends before it starts", () => {
    const result = scheduleExceptionSchema.safeParse({
      startDate: "2026-11-02",
      startTime: "11:00",
      endTime: "10:00",
      exceptionType: "blocked_period",
      reason: "Grand rounds",
    });
    expect(firstMessage(result)).toBe("The exception must end after it starts.");
  });

  it("rejects unknown exception types", () => {
    expect(
      scheduleExceptionSchema.safeParse({
        startDate: "2026-11-02",
        exceptionType: "holiday",
        reason: "Holiday",
      }).success,
    ).toBe(false);
  });
});

describe("availabilityQuerySchema", () => {
  it("accepts a doctor or a specialty filter with a bounded window", () => {
    expect(
      availabilityQuerySchema.parse({ doctorId: DOCTOR_ID, fromDate: "2026-11-02" }),
    ).toEqual({ doctorId: DOCTOR_ID, fromDate: "2026-11-02", days: 7 });
    expect(
      availabilityQuerySchema.parse({
        specialtyId: SPECIALTY_ID,
        fromDate: "2026-11-02",
        days: "14",
      }),
    ).toEqual({ specialtyId: SPECIALTY_ID, fromDate: "2026-11-02", days: 14 });
  });

  it("requires a doctor or a specialty", () => {
    const result = availabilityQuerySchema.safeParse({ fromDate: "2026-11-02" });
    expect(firstMessage(result)).toBe("Choose a doctor or a specialty.");
  });

  it("caps the window at 14 days", () => {
    expect(
      availabilityQuerySchema.safeParse({
        doctorId: DOCTOR_ID,
        fromDate: "2026-11-02",
        days: "15",
      }).success,
    ).toBe(false);
  });
});
