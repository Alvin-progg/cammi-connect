import { describe, expect, it } from "vitest";

import {
  DOCTOR_VIEW_LABELS,
  calendarMonthLabel,
  parseAppointmentStatusFilter,
  parseCalendarMonth,
  parseDashboardView,
  parseStatsPeriod,
  parseWeekStart,
  shiftCalendarMonth,
  shiftWeek,
  weekRangeLabel,
} from "@/lib/appointments/dashboard";

const NOW = new Date("2026-10-25T04:00:00.000Z"); // 2026-10-25 12:00 PHT

describe("parseDashboardView", () => {
  it("defaults to the week schedule view", () => {
    expect(parseDashboardView(undefined)).toBe("week");
    expect(parseDashboardView("nonsense")).toBe("week");
  });

  it("falls back to the week schedule for the removed board and list views", () => {
    expect(parseDashboardView("board")).toBe("week");
    expect(parseDashboardView("list")).toBe("week");
    // Notifications moved from a page view to a modal.
    expect(parseDashboardView("notifications")).toBe("week");
  });

  it("accepts known views", () => {
    expect(parseDashboardView("calendar")).toBe("calendar");
    expect(parseDashboardView("stats")).toBe("stats");
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

describe("view labels", () => {
  it("names the week grid Schedule and the availability calendar Availability", () => {
    expect(DOCTOR_VIEW_LABELS.week).toBe("Schedule");
    expect(DOCTOR_VIEW_LABELS.calendar).toBe("Availability");
  });
});

describe("week helpers", () => {
  it("defaults to the Sunday of the current Manila week", () => {
    // NOW is Sunday 2026-10-25 in Manila.
    expect(parseWeekStart(undefined, NOW)).toBe("2026-10-25");
    expect(parseWeekStart("bogus", NOW)).toBe("2026-10-25");
    expect(parseWeekStart("2026-02-30", NOW)).toBe("2026-10-25");
  });

  it("snaps any valid date to the Sunday starting its week", () => {
    expect(parseWeekStart("2026-10-28", NOW)).toBe("2026-10-25");
    expect(parseWeekStart("2026-10-31", NOW)).toBe("2026-10-25");
    expect(parseWeekStart("2026-11-01", NOW)).toBe("2026-11-01");
  });

  it("shifts weeks across month and year boundaries", () => {
    expect(shiftWeek("2026-10-25", -1)).toBe("2026-10-18");
    expect(shiftWeek("2026-10-25", 1)).toBe("2026-11-01");
    expect(shiftWeek("2026-12-27", 1)).toBe("2027-01-03");
  });

  it("labels the week compactly", () => {
    expect(weekRangeLabel("2026-10-18")).toBe("18 – 24 Oct 2026");
    expect(weekRangeLabel("2026-10-25")).toBe("25 – 31 Oct 2026");
    expect(weekRangeLabel("2026-11-29")).toBe("29 Nov – 5 Dec 2026");
    expect(weekRangeLabel("2026-12-27")).toBe("27 Dec 2026 – 2 Jan 2027");
  });
});
