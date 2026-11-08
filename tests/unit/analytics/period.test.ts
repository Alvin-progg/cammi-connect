import { describe, expect, it } from "vitest";

import {
  analyticsPeriodBounds,
  analyticsPeriodDays,
  analyticsPeriodMonths,
  previousPeriod,
} from "@/lib/analytics/period";

const QUERY = { from: "2026-10-01", to: "2026-12-01", doctorId: null, departmentId: null };

describe("analyticsPeriodBounds", () => {
  it("turns the Manila [from, to) dates into UTC instants with an exclusive end", () => {
    expect(analyticsPeriodBounds(QUERY)).toEqual({
      start: "2026-09-30T16:00:00.000Z",
      end: "2026-11-30T16:00:00.000Z",
    });
  });

  it("rejects malformed dates and empty or inverted periods", () => {
    expect(() => analyticsPeriodBounds({ ...QUERY, from: "2026-13-01" })).toThrow(RangeError);
    expect(() => analyticsPeriodBounds({ ...QUERY, to: "2026-10-01" })).toThrow(RangeError);
    expect(() => analyticsPeriodBounds({ ...QUERY, to: "2026-09-01" })).toThrow(RangeError);
  });
});

describe("analyticsPeriodMonths", () => {
  it("lists every Manila month the period touches", () => {
    expect(analyticsPeriodMonths(QUERY)).toEqual(["2026-10", "2026-11"]);
    expect(analyticsPeriodMonths({ ...QUERY, from: "2026-11-15", to: "2027-01-02" })).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
    ]);
    expect(analyticsPeriodMonths({ ...QUERY, from: "2026-11-05", to: "2026-11-06" })).toEqual(["2026-11"]);
  });
});

describe("analyticsPeriodDays", () => {
  it("lists every Manila date in [from, to)", () => {
    expect(analyticsPeriodDays({ ...QUERY, from: "2026-10-30", to: "2026-11-02" })).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });
});

describe("previousPeriod", () => {
  it("is the equal-length window that ends where the period starts", () => {
    // A Monday-to-Sunday week becomes the previous Monday-to-Sunday week.
    expect(previousPeriod({ ...QUERY, from: "2026-11-02", to: "2026-11-09" })).toEqual({
      ...QUERY,
      from: "2026-10-26",
      to: "2026-11-02",
    });
    expect(previousPeriod({ ...QUERY, from: "2026-11-05", to: "2026-11-06", doctorId: "d" })).toEqual({
      ...QUERY,
      from: "2026-11-04",
      to: "2026-11-05",
      doctorId: "d",
    });
    // November has 30 days, so the previous window is the 30 days before it.
    expect(previousPeriod({ ...QUERY, from: "2026-11-01", to: "2026-12-01" })).toMatchObject({
      from: "2026-10-02",
      to: "2026-11-01",
    });
  });
});
