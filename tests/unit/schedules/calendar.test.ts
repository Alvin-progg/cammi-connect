import { describe, expect, it } from "vitest";

import {
  buildMonthGrid,
  groupPeriodsByWeekday,
  summarizeBlocksByDate,
} from "@/lib/schedules/calendar";
import type { ScheduleException } from "@/lib/schedules/types";

describe("buildMonthGrid", () => {
  const grid = buildMonthGrid({
    month: "2026-10",
    today: "2026-10-25",
    schedules: [
      { dayOfWeek: 1, isActive: true, effectiveFrom: "2026-01-01", effectiveUntil: null },
      { dayOfWeek: 3, isActive: true, effectiveFrom: "2026-01-01", effectiveUntil: null },
      { dayOfWeek: 5, isActive: false, effectiveFrom: "2026-01-01", effectiveUntil: null },
      // Tuesdays only from 2026-10-20 through 2026-10-27.
      { dayOfWeek: 2, isActive: true, effectiveFrom: "2026-10-20", effectiveUntil: "2026-10-27" },
    ],
    blocksByDate: new Map([
      ["2026-10-26", { type: "leave", reason: "Annual leave", allDay: true }],
    ]),
    countByDate: new Map([["2026-10-25", { confirmed: 2 }]]),
  });

  it("always renders a 42-day Sunday-first grid", () => {
    expect(grid.days).toHaveLength(42);
    // 2026-10-01 is a Thursday, so the grid starts on Sunday 2026-09-27.
    expect(grid.days[0]).toMatchObject({
      date: "2026-09-27",
      inMonth: false,
    });
    expect(grid.days[41].date).toBe("2026-11-07");
  });

  it("marks today and its appointment counts", () => {
    const today = grid.days.find((day) => day.date === "2026-10-25");
    expect(today).toMatchObject({
      inMonth: true,
      isToday: true,
      counts: { confirmed: 2 },
    });
    // Sunday without an active schedule.
    expect(today?.hasSchedule).toBe(false);
  });

  it("flags scheduled and blocked days", () => {
    const monday = grid.days.find((day) => day.date === "2026-10-26");
    expect(monday?.hasSchedule).toBe(true);
    expect(monday?.block).toEqual({
      type: "leave",
      reason: "Annual leave",
      allDay: true,
    });

    const friday = grid.days.find((day) => day.date === "2026-10-30");
    expect(friday?.hasSchedule).toBe(false); // inactive schedule row
    expect(friday?.block).toBeNull();
  });

  it("marks out-of-month days", () => {
    const september = grid.days.find((day) => day.date === "2026-09-30");
    expect(september?.inMonth).toBe(false);
    expect(september?.dayOfMonth).toBe(30);
  });

  it("marks schedule days only within a period's effective dates", () => {
    const tuesdays = grid.days
      .filter((day) => day.inMonth && new Date(`${day.date}T00:00:00Z`).getUTCDay() === 2)
      .map((day) => [day.date, day.hasSchedule]);
    expect(tuesdays).toEqual([
      ["2026-10-06", false],
      ["2026-10-13", false],
      ["2026-10-20", true],
      ["2026-10-27", true],
    ]);
  });
});

function exception(
  overrides: Partial<ScheduleException> & Pick<ScheduleException, "startsAt" | "endsAt">,
): ScheduleException {
  return {
    id: "00000000-0000-4000-8000-000000000951",
    doctorId: "00000000-0000-4000-8000-000000000101",
    exceptionType: "leave",
    reason: "Annual leave",
    ...overrides,
  };
}

describe("summarizeBlocksByDate", () => {
  it("marks a whole-day exception as all-day on its date", () => {
    const blocks = summarizeBlocksByDate([
      exception({
        startsAt: "2026-11-02T00:00:00+08:00",
        endsAt: "2026-11-03T00:00:00+08:00",
      }),
    ]);

    expect([...blocks]).toEqual([
      ["2026-11-02", { type: "leave", reason: "Annual leave", allDay: true }],
    ]);
  });

  it("covers every Manila date of a multi-day exception", () => {
    const blocks = summarizeBlocksByDate([
      exception({
        startsAt: "2026-11-02T00:00:00+08:00",
        endsAt: "2026-11-05T00:00:00+08:00",
      }),
    ]);

    expect([...blocks.keys()]).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
    expect([...blocks.values()].every((block) => block.allDay)).toBe(true);
  });

  it("marks a time-of-day exception as a partial block", () => {
    const blocks = summarizeBlocksByDate([
      exception({
        exceptionType: "blocked_period",
        reason: "Staff meeting",
        startsAt: "2026-11-02T14:00:00+08:00",
        endsAt: "2026-11-02T16:00:00+08:00",
      }),
    ]);

    expect(blocks.get("2026-11-02")).toEqual({
      type: "blocked_period",
      reason: "Staff meeting",
      allDay: false,
    });
  });

  it("prefers an all-day exception when a date also has a partial one", () => {
    const blocks = summarizeBlocksByDate([
      exception({
        exceptionType: "blocked_period",
        reason: "Staff meeting",
        startsAt: "2026-11-02T14:00:00+08:00",
        endsAt: "2026-11-02T16:00:00+08:00",
      }),
      exception({
        startsAt: "2026-11-02T00:00:00+08:00",
        endsAt: "2026-11-03T00:00:00+08:00",
      }),
    ]);

    expect(blocks.get("2026-11-02")).toEqual({
      type: "leave",
      reason: "Annual leave",
      allDay: true,
    });
  });

  it("only partially blocks the first and last day of a multi-day timed exception", () => {
    const blocks = summarizeBlocksByDate([
      exception({
        startsAt: "2026-11-02T13:00:00+08:00",
        endsAt: "2026-11-04T12:00:00+08:00",
      }),
    ]);

    expect([...blocks].map(([date, block]) => [date, block.allDay])).toEqual([
      ["2026-11-02", false],
      ["2026-11-03", true],
      ["2026-11-04", false],
    ]);
  });
});

describe("groupPeriodsByWeekday", () => {
  const period = (dayOfWeek: number, startTime: string) => ({ dayOfWeek, startTime });

  it("returns all seven days Monday-first with each day's periods by start time", () => {
    const days = groupPeriodsByWeekday([
      period(1, "13:00"),
      period(0, "09:00"),
      period(1, "08:00"),
    ]);

    expect(days.map((day) => day.label)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    expect(days[0].periods).toEqual([period(1, "08:00"), period(1, "13:00")]);
    expect(days[1].periods).toEqual([]);
    expect(days[6]).toMatchObject({ dayOfWeek: 0, periods: [period(0, "09:00")] });
  });
});
