import { describe, expect, it } from "vitest";

import { buildMonthGrid } from "@/lib/schedules/calendar";

describe("buildMonthGrid", () => {
  const grid = buildMonthGrid({
    month: "2026-10",
    today: "2026-10-25",
    schedules: [
      { dayOfWeek: 1, isActive: true },
      { dayOfWeek: 3, isActive: true },
      { dayOfWeek: 5, isActive: false },
    ],
    blockedDates: ["2026-10-26"],
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
    expect(monday?.blocked).toBe(true);

    const friday = grid.days.find((day) => day.date === "2026-10-30");
    expect(friday?.hasSchedule).toBe(false); // inactive schedule row
    expect(friday?.blocked).toBe(false);
  });

  it("marks out-of-month days", () => {
    const september = grid.days.find((day) => day.date === "2026-09-30");
    expect(september?.inMonth).toBe(false);
    expect(september?.dayOfMonth).toBe(30);
  });
});
