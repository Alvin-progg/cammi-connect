import { describe, expect, it } from "vitest";

import { generateAvailableSlots } from "@/lib/schedules/slots";

const DOCTOR_ID = "00000000-0000-4000-8000-000000000101";

// 2026-11-02 is a Monday in Asia/Manila.
const MONDAY = "2026-11-02";
const NOW = new Date("2026-11-01T12:00:00+08:00");

type Period = Parameters<typeof generateAvailableSlots>[0]["schedules"][number];

function period(overrides: Partial<Period> = {}): Period {
  return {
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "10:00",
    slotDurationMinutes: 30,
    effectiveFrom: "2026-01-01",
    effectiveUntil: null,
    isActive: true,
    ...overrides,
  };
}

function generate(
  overrides: Partial<Parameters<typeof generateAvailableSlots>[0]> = {},
) {
  return generateAvailableSlots({
    doctorId: DOCTOR_ID,
    schedules: [period()],
    exceptions: [],
    existing: [],
    fromDate: MONDAY,
    days: 1,
    now: NOW,
    ...overrides,
  });
}

function startTimes(slots: { start: Date }[]): string[] {
  return slots.map((slot) => slot.start.toISOString());
}

function manila(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+08:00`);
}

describe("generateAvailableSlots", () => {
  it("walks a period on its slot grid and tags each slot with the doctor", () => {
    const slots = generate();

    expect(slots).toEqual([
      {
        doctorId: DOCTOR_ID,
        start: manila(MONDAY, "09:00"),
        end: manila(MONDAY, "09:30"),
      },
      {
        doctorId: DOCTOR_ID,
        start: manila(MONDAY, "09:30"),
        end: manila(MONDAY, "10:00"),
      },
    ]);
  });

  it("uses each period's own fixed duration", () => {
    expect(
      startTimes(generate({ schedules: [period({ slotDurationMinutes: 15 })] })),
    ).toHaveLength(4);
    expect(
      startTimes(generate({ schedules: [period({ slotDurationMinutes: 60 })] })),
    ).toEqual([manila(MONDAY, "09:00").toISOString()]);
  });

  it("drops a partial last slot", () => {
    const slots = generate({
      schedules: [period({ endTime: "10:20", slotDurationMinutes: 30 })],
    });

    expect(startTimes(slots)).toEqual([
      manila(MONDAY, "09:00").toISOString(),
      manila(MONDAY, "09:30").toISOString(),
    ]);
  });

  it("supports several consultation periods on one day", () => {
    const slots = generate({
      schedules: [
        period({ startTime: "13:00", endTime: "14:00", slotDurationMinutes: 60 }),
        period({ startTime: "08:00", endTime: "09:00", slotDurationMinutes: 60 }),
      ],
    });

    expect(startTimes(slots)).toEqual([
      manila(MONDAY, "08:00").toISOString(),
      manila(MONDAY, "13:00").toISOString(),
    ]);
  });

  it("applies different hours on different weekdays", () => {
    const slots = generate({
      days: 2,
      schedules: [
        period({ dayOfWeek: 1, startTime: "09:00", endTime: "09:30" }),
        period({ dayOfWeek: 2, startTime: "14:00", endTime: "14:30" }),
      ],
    });

    expect(startTimes(slots)).toEqual([
      manila(MONDAY, "09:00").toISOString(),
      manila("2026-11-03", "14:00").toISOString(),
    ]);
  });

  it("ignores inactive periods", () => {
    expect(generate({ schedules: [period({ isActive: false })] })).toEqual([]);
  });

  it("respects inclusive effective-from and effective-until dates", () => {
    const schedules = [period({ effectiveFrom: "2026-11-09", effectiveUntil: "2026-11-16" })];
    const slots = generate({ schedules, days: 22 });

    // Mondays 2026-11-02 and 2026-11-23 are outside; 11-09 and 11-16 are inside.
    expect(
      [...new Set(slots.map((slot) => slot.start.toISOString().slice(0, 10)))],
    ).toEqual(["2026-11-09", "2026-11-16"]);
  });

  it("removes slots overlapping a schedule exception", () => {
    const slots = generate({
      exceptions: [
        { start: manila(MONDAY, "09:15"), end: manila(MONDAY, "09:20") },
      ],
    });

    expect(startTimes(slots)).toEqual([manila(MONDAY, "09:30").toISOString()]);
  });

  it("removes slots overlapping an existing active appointment", () => {
    const slots = generate({
      existing: [
        { start: manila(MONDAY, "09:30"), end: manila(MONDAY, "10:00") },
      ],
    });

    expect(startTimes(slots)).toEqual([manila(MONDAY, "09:00").toISOString()]);
  });

  it("returns only future slots", () => {
    const slots = generate({ now: manila(MONDAY, "09:00") });

    expect(startTimes(slots)).toEqual([manila(MONDAY, "09:30").toISOString()]);
  });

  it("uses Manila calendar days, not UTC days", () => {
    // 07:00 Manila Monday is 23:00 UTC Sunday.
    const slots = generate({
      schedules: [period({ startTime: "07:00", endTime: "07:30" })],
    });

    expect(startTimes(slots)).toEqual(["2026-11-01T23:00:00.000Z"]);
  });
});
