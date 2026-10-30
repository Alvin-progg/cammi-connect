import { describe, expect, it } from "vitest";

import {
  intervalsOverlap,
  manilaParts,
  timeToMinutes,
  validateAppointmentSlot,
} from "@/lib/schedules/availability";

// 2026-10-26 is a Monday in Asia/Manila.
const MONDAY_10AM = new Date("2026-10-26T10:00:00+08:00");
const NOW = new Date("2026-10-25T12:00:00+08:00");

const WEEKDAY_NINE_TO_FIVE = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  startTime: "09:00",
  endTime: "17:00",
  effectiveFrom: "2026-01-01",
  effectiveUntil: null,
  isActive: true,
}));

function validate(
  overrides: Partial<Parameters<typeof validateAppointmentSlot>[0]> = {},
) {
  return validateAppointmentSlot({
    start: MONDAY_10AM,
    durationMinutes: 30,
    now: NOW,
    schedules: WEEKDAY_NINE_TO_FIVE,
    blocks: [],
    existing: [],
    ...overrides,
  });
}

describe("intervalsOverlap", () => {
  it("treats touching half-open intervals as non-overlapping", () => {
    expect(
      intervalsOverlap(
        { start: new Date("2026-10-26T09:00:00+08:00"), end: MONDAY_10AM },
        { start: MONDAY_10AM, end: new Date("2026-10-26T10:30:00+08:00") },
      ),
    ).toBe(false);
  });

  it("detects true overlaps", () => {
    expect(
      intervalsOverlap(
        { start: new Date("2026-10-26T09:30:00+08:00"), end: new Date("2026-10-26T10:30:00+08:00") },
        { start: MONDAY_10AM, end: new Date("2026-10-26T11:00:00+08:00") },
      ),
    ).toBe(true);
  });
});

describe("manilaParts", () => {
  it("computes the Manila weekday and minutes-of-day", () => {
    expect(manilaParts(MONDAY_10AM)).toEqual({
      dayOfWeek: 1,
      minutesOfDay: 600,
    });
  });

  it("rolls to the next Manila day after 16:00 UTC", () => {
    const tuesdayManila = new Date("2026-10-26T16:30:00.000Z");
    expect(manilaParts(tuesdayManila).dayOfWeek).toBe(2);
    expect(manilaParts(tuesdayManila).minutesOfDay).toBe(30);
  });
});

describe("validateAppointmentSlot", () => {
  it("accepts a future slot inside regular hours", () => {
    expect(validate()).toEqual({ ok: true });
  });

  it("rejects past times", () => {
    expect(validate({ start: new Date("2026-10-24T10:00:00+08:00") })).toEqual({
      ok: false,
      reason: "past",
    });
  });

  it("rejects days without an active schedule", () => {
    // 2026-10-25 is a Sunday.
    expect(validate({ start: new Date("2026-10-25T13:00:00+08:00"), now: new Date("2026-10-24T12:00:00+08:00") })).toEqual({
      ok: false,
      reason: "outside_hours",
    });
  });

  it("rejects times outside the daily window", () => {
    expect(validate({ start: new Date("2026-10-26T08:00:00+08:00") })).toEqual({
      ok: false,
      reason: "outside_hours",
    });
  });

  it("rejects consultations that run past the window end", () => {
    expect(
      validate({
        start: new Date("2026-10-26T16:45:00+08:00"),
        durationMinutes: 30,
      }),
    ).toEqual({ ok: false, reason: "outside_hours" });
  });

  it("ignores inactive schedule rows", () => {
    expect(
      validate({
        schedules: [
          {
            dayOfWeek: 1,
            startTime: "09:00",
            endTime: "17:00",
            effectiveFrom: "2026-01-01",
            effectiveUntil: null,
            isActive: false,
          },
        ],
      }),
    ).toEqual({ ok: false, reason: "outside_hours" });
  });

  it("accepts any of several periods on the same day", () => {
    const splitMonday = [
      { ...WEEKDAY_NINE_TO_FIVE[0], startTime: "08:00", endTime: "09:30" },
      { ...WEEKDAY_NINE_TO_FIVE[0], startTime: "13:00", endTime: "17:00" },
    ];
    expect(
      validate({
        schedules: splitMonday,
        start: new Date("2026-10-26T13:00:00+08:00"),
      }),
    ).toEqual({ ok: true });
    expect(validate({ schedules: splitMonday })).toEqual({
      ok: false,
      reason: "outside_hours",
    });
  });

  it("rejects dates before a period's effective-from date", () => {
    expect(
      validate({
        schedules: [{ ...WEEKDAY_NINE_TO_FIVE[0], effectiveFrom: "2026-10-27" }],
      }),
    ).toEqual({ ok: false, reason: "outside_hours" });
  });

  it("rejects dates after a period's effective-until date", () => {
    expect(
      validate({
        schedules: [{ ...WEEKDAY_NINE_TO_FIVE[0], effectiveUntil: "2026-10-25" }],
      }),
    ).toEqual({ ok: false, reason: "outside_hours" });
    expect(
      validate({
        schedules: [{ ...WEEKDAY_NINE_TO_FIVE[0], effectiveUntil: "2026-10-26" }],
      }),
    ).toEqual({ ok: true });
  });

  it("rejects slots overlapping a blocked interval", () => {
    expect(
      validate({
        blocks: [
          {
            start: new Date("2026-10-26T09:45:00+08:00"),
            end: new Date("2026-10-26T10:15:00+08:00"),
          },
        ],
      }),
    ).toEqual({ ok: false, reason: "blocked" });
  });

  it("rejects slots overlapping an existing active appointment", () => {
    expect(
      validate({
        existing: [
          {
            start: MONDAY_10AM,
            end: new Date("2026-10-26T10:30:00+08:00"),
          },
        ],
      }),
    ).toEqual({ ok: false, reason: "overlap" });
  });
});

describe("timeToMinutes", () => {
  it("converts HH:MM to minutes", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("17:00")).toBe(1020);
  });
});
