import { describe, expect, it } from "vitest";

import { analyticsPeriodBounds, analyticsPeriodMonths } from "@/lib/analytics/period";

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
