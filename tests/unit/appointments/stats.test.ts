import { describe, expect, it } from "vitest";

import {
  manilaDateOfTimestamp,
  summarizeAppointments,
} from "@/lib/appointments/stats";

describe("manilaDateOfTimestamp", () => {
  it("uses the Manila calendar date", () => {
    expect(manilaDateOfTimestamp("2026-10-25T16:30:00.000Z")).toBe(
      "2026-10-26",
    );
    expect(manilaDateOfTimestamp("2026-10-25T01:00:00.000Z")).toBe(
      "2026-10-25",
    );
  });
});

describe("summarizeAppointments", () => {
  it("counts statuses and groups by Manila day", () => {
    const summary = summarizeAppointments([
      { scheduledAt: "2026-10-25T01:00:00.000Z", status: "completed" },
      { scheduledAt: "2026-10-25T03:00:00.000Z", status: "completed" },
      { scheduledAt: "2026-10-25T05:00:00.000Z", status: "cancelled" },
      { scheduledAt: "2026-10-26T01:00:00.000Z", status: "requested" },
      { scheduledAt: "2026-10-26T02:00:00.000Z", status: "no_show" },
    ]);

    expect(summary.total).toBe(5);
    expect(summary.completed).toBe(2);
    expect(summary.cancelled).toBe(1);
    expect(summary.requested).toBe(1);
    expect(summary.noShow).toBe(1);
    expect(summary.days.map((day) => day.date)).toEqual([
      "2026-10-25",
      "2026-10-26",
    ]);
    expect(summary.days[0]).toMatchObject({
      total: 3,
      counts: { completed: 2, cancelled: 1 },
    });
    expect(summary.maxDayTotal).toBe(3);
  });

  it("computes the completion rate over terminal appointments", () => {
    const summary = summarizeAppointments([
      { scheduledAt: "2026-10-25T01:00:00.000Z", status: "completed" },
      { scheduledAt: "2026-10-25T03:00:00.000Z", status: "cancelled" },
      { scheduledAt: "2026-10-25T05:00:00.000Z", status: "no_show" },
      { scheduledAt: "2026-10-26T01:00:00.000Z", status: "requested" },
    ]);
    expect(summary.completionRate).toBe(33);
  });

  it("returns a null completion rate without terminal appointments", () => {
    const summary = summarizeAppointments([
      { scheduledAt: "2026-10-26T01:00:00.000Z", status: "requested" },
    ]);
    expect(summary.completionRate).toBeNull();
  });

  it("handles an empty period", () => {
    const summary = summarizeAppointments([]);
    expect(summary.total).toBe(0);
    expect(summary.days).toEqual([]);
    expect(summary.maxDayTotal).toBe(0);
    expect(summary.completionRate).toBeNull();
  });
});
