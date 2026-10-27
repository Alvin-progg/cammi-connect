import { describe, expect, it } from "vitest";

import {
  calendarMonthLabel,
  parseAppointmentRange,
  parseAppointmentStatusFilter,
  parseCalendarMonth,
  parseDashboardView,
  parseStatsPeriod,
  resolveRangeBounds,
  shiftCalendarMonth,
} from "@/lib/appointments/dashboard";

const NOW = new Date("2026-10-25T04:00:00.000Z"); // 2026-10-25 12:00 PHT

describe("parseDashboardView", () => {
  it("defaults to the board view", () => {
    expect(parseDashboardView(undefined)).toBe("board");
    expect(parseDashboardView("nonsense")).toBe("board");
  });

  it("accepts known views", () => {
    expect(parseDashboardView("list")).toBe("list");
    expect(parseDashboardView("calendar")).toBe("calendar");
    expect(parseDashboardView("stats")).toBe("stats");
    expect(parseDashboardView("notifications")).toBe("notifications");
    expect(parseDashboardView("profile")).toBe("profile");
  });
});

describe("parseAppointmentStatusFilter", () => {
  it("passes through valid statuses only", () => {
    expect(parseAppointmentStatusFilter("confirmed")).toBe("confirmed");
    expect(parseAppointmentStatusFilter("bogus")).toBeNull();
    expect(parseAppointmentStatusFilter(undefined)).toBeNull();
  });
});

describe("parseAppointmentRange", () => {
  it("lets a valid specific date win and implies the day range", () => {
    expect(
      parseAppointmentRange({ range: "upcoming", date: "2026-10-20" }),
    ).toEqual({ range: "day", date: "2026-10-20" });
  });

  it("rejects invalid dates and falls back to the range parameter", () => {
    const parsed = parseAppointmentRange({ range: "history", date: "20-10" });
    expect(parsed.range).toBe("history");
  });

  it("defaults to today", () => {
    const parsed = parseAppointmentRange({});
    expect(parsed.range).toBe("today");
    expect(parsed.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("resolveRangeBounds", () => {
  it("resolves a single Manila day", () => {
    const bounds = resolveRangeBounds({ range: "day", date: "2026-10-20" });
    expect(bounds.start.toISOString()).toBe("2026-10-19T16:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-10-20T16:00:00.000Z");
  });

  it("resolves the upcoming window to seven days from today", () => {
    const bounds = resolveRangeBounds({ range: "upcoming", date: "2026-10-25" });
    expect(bounds.end.getTime() - bounds.start.getTime()).toBe(
      7 * 24 * 60 * 60 * 1000,
    );
  });

  it("resolves history to the thirty days before today", () => {
    const bounds = resolveRangeBounds({ range: "history", date: "2026-10-25" });
    expect(bounds.end.getTime() - bounds.start.getTime()).toBe(
      30 * 24 * 60 * 60 * 1000,
    );
  });
});

describe("parseStatsPeriod", () => {
  it("defaults to 30d", () => {
    expect(parseStatsPeriod(undefined)).toBe("30d");
    expect(parseStatsPeriod("bogus")).toBe("30d");
  });

  it("accepts known periods", () => {
    expect(parseStatsPeriod("7d")).toBe("7d");
    expect(parseStatsPeriod("all")).toBe("all");
  });
});

describe("calendar month helpers", () => {
  it("defaults to the current Manila month", () => {
    expect(parseCalendarMonth(undefined, NOW)).toBe("2026-10");
  });

  it("accepts a valid month and rejects malformed ones", () => {
    expect(parseCalendarMonth("2026-11", NOW)).toBe("2026-11");
    expect(parseCalendarMonth("2026-13", NOW)).toBe("2026-10");
    expect(parseCalendarMonth("next", NOW)).toBe("2026-10");
  });

  it("shifts months across year boundaries", () => {
    expect(shiftCalendarMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftCalendarMonth("2026-01", -1)).toBe("2025-12");
  });

  it("labels months in English with the year", () => {
    expect(calendarMonthLabel("2026-10")).toBe("October 2026");
  });
});
