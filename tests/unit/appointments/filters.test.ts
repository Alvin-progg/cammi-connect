// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  isValidManilaDate,
  manilaDayRange,
  parseAppointmentFilters,
  todayInManila,
} from "@/lib/appointments/filters";

const NOW = new Date("2026-10-24T16:30:00.000Z"); // 2026-10-25 00:30 Asia/Manila

describe("todayInManila", () => {
  it("uses the Manila calendar date, not the UTC date", () => {
    expect(todayInManila(NOW)).toBe("2026-10-25");
  });
});

describe("isValidManilaDate", () => {
  it("accepts a real calendar date", () => {
    expect(isValidManilaDate("2026-10-25")).toBe(true);
  });

  it("rejects malformed and impossible dates", () => {
    expect(isValidManilaDate("25-10-2026")).toBe(false);
    expect(isValidManilaDate("2026-02-31")).toBe(false);
    expect(isValidManilaDate("2026-13-01")).toBe(false);
  });
});

describe("parseAppointmentFilters", () => {
  it("defaults to today in Manila when no filters are present", () => {
    expect(parseAppointmentFilters({}, NOW)).toEqual({
      date: "2026-10-25",
      status: null,
    });
  });

  it("defaults invalid input instead of trusting the query string", () => {
    expect(
      parseAppointmentFilters(
        { date: "not-a-date", status: "not-a-status" },
        NOW,
      ),
    ).toEqual({ date: "2026-10-25", status: null });
  });

  it("accepts valid filters and the first value of repeated parameters", () => {
    expect(
      parseAppointmentFilters(
        {
          date: ["2026-10-26", "2026-10-27"],
          status: ["confirmed", "cancelled"],
        },
        NOW,
      ),
    ).toEqual({ date: "2026-10-26", status: "confirmed" });
  });

  it("treats the all-status option as no status filter", () => {
    expect(parseAppointmentFilters({ status: "all" }, NOW).status).toBeNull();
  });
});

describe("manilaDayRange", () => {
  it("returns the UTC instants for a Manila calendar day", () => {
    const range = manilaDayRange("2026-10-25");
    expect(range.start.toISOString()).toBe("2026-10-24T16:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-25T16:00:00.000Z");
  });
});
