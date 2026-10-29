import { describe, expect, it } from "vitest";

import type { DoctorAppointment } from "@/lib/appointments/types";
import { buildWeekLayout } from "@/lib/appointments/week";

function appointment(
  overrides: Partial<DoctorAppointment> & Pick<DoctorAppointment, "id" | "scheduledAt">,
): DoctorAppointment {
  return {
    patientName: "Synthetic Patient",
    reason: null,
    durationMinutes: 30,
    status: "confirmed",
    ...overrides,
  };
}

const WEEK_START = "2026-10-25"; // Sunday
const NOW = new Date("2026-10-27T03:48:00.000Z"); // Tue 11:48 PHT

describe("buildWeekLayout", () => {
  it("lists the seven days from Sunday and marks today", () => {
    const layout = buildWeekLayout({
      weekStart: WEEK_START,
      appointments: [],
      now: NOW,
    });

    expect(layout.days.map((day) => day.date)).toEqual([
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
    ]);
    expect(layout.days.map((day) => day.weekdayLabel)).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
    expect(layout.days[0].dayNumber).toBe(25);
    expect(layout.days.filter((day) => day.isToday).map((day) => day.date)).toEqual([
      "2026-10-27",
    ]);
  });

  it("uses an 08:00–18:00 grid by default", () => {
    const layout = buildWeekLayout({
      weekStart: WEEK_START,
      appointments: [],
      now: NOW,
    });
    expect(layout.startHour).toBe(8);
    expect(layout.endHour).toBe(18);
    expect(layout.hours).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });

  it("positions a block by Manila day and time of day", () => {
    const layout = buildWeekLayout({
      weekStart: WEEK_START,
      // Mon 26 Oct, 09:00 PHT, 30 minutes.
      appointments: [appointment({ id: "a", scheduledAt: "2026-10-26T01:00:00.000Z" })],
      now: NOW,
    });

    expect(layout.blocks).toHaveLength(1);
    const [block] = layout.blocks;
    expect(block.dayIndex).toBe(1);
    expect(block.topPct).toBeCloseTo(10); // 60 of 600 minutes
    expect(block.heightPct).toBeCloseTo(5); // 30 of 600 minutes
    expect(block.lane).toBe(0);
    expect(block.laneCount).toBe(1);
    expect(block.endsAt).toBe("2026-10-26T01:30:00.000Z");
  });

  it("widens the grid to cover appointments outside the default hours", () => {
    const layout = buildWeekLayout({
      weekStart: WEEK_START,
      appointments: [
        appointment({ id: "early", scheduledAt: "2026-10-25T22:30:00.000Z" }), // Mon 06:30
        appointment({
          id: "late",
          scheduledAt: "2026-10-28T11:00:00.000Z", // Wed 19:00
          durationMinutes: 45,
        }),
      ],
      now: NOW,
    });
    expect(layout.startHour).toBe(6);
    expect(layout.endHour).toBe(20);
  });

  it("places overlapping blocks in side-by-side lanes", () => {
    const layout = buildWeekLayout({
      weekStart: WEEK_START,
      appointments: [
        appointment({
          id: "cancelled",
          scheduledAt: "2026-10-26T01:00:00.000Z",
          durationMinutes: 60,
          status: "cancelled",
        }),
        appointment({ id: "confirmed", scheduledAt: "2026-10-26T01:30:00.000Z" }),
        appointment({ id: "later", scheduledAt: "2026-10-26T04:00:00.000Z" }),
      ],
      now: NOW,
    });

    const byId = new Map(layout.blocks.map((block) => [block.appointment.id, block]));
    expect(byId.get("cancelled")).toMatchObject({ lane: 0, laneCount: 2 });
    expect(byId.get("confirmed")).toMatchObject({ lane: 1, laneCount: 2 });
    expect(byId.get("later")).toMatchObject({ lane: 0, laneCount: 1 });
  });

  it("ignores appointments outside the week", () => {
    const layout = buildWeekLayout({
      weekStart: WEEK_START,
      appointments: [appointment({ id: "next", scheduledAt: "2026-11-01T01:00:00.000Z" })],
      now: NOW,
    });
    expect(layout.blocks).toEqual([]);
  });

  it("draws the now line on today's column", () => {
    const layout = buildWeekLayout({
      weekStart: WEEK_START,
      appointments: [],
      now: NOW,
    });
    expect(layout.nowLine).not.toBeNull();
    expect(layout.nowLine?.dayIndex).toBe(2);
    expect(layout.nowLine?.topPct).toBeCloseTo((228 / 600) * 100);
    expect(layout.nowLine?.label).toBe("11:48");
  });

  it("omits the now line for other weeks", () => {
    const layout = buildWeekLayout({
      weekStart: "2026-11-01",
      appointments: [],
      now: NOW,
    });
    expect(layout.nowLine).toBeNull();
  });
});
