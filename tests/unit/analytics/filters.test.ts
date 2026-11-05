import { describe, expect, it } from "vitest";

import {
  analyticsHref,
  analyticsSearchParams,
  parseAnalyticsFilters,
  toAnalyticsQuery,
  type AnalyticsFilters,
} from "@/lib/analytics/filters";

/** Manila noon, 2026-11-05. */
const NOW = new Date("2026-11-05T04:00:00.000Z");
const DOCTOR_ID = "00000000-0000-4000-8000-000000000010";
const DEPARTMENT_ID = "00000000-0000-4000-8000-000000000020";

const THIS_MONTH: AnalyticsFilters = {
  range: "this_month",
  from: "2026-11-01",
  to: "2026-11-30",
  doctorId: null,
  departmentId: null,
};

describe("parseAnalyticsFilters", () => {
  it("defaults to this Manila month", () => {
    expect(parseAnalyticsFilters({}, NOW)).toEqual(THIS_MONTH);
  });

  it("uses Manila today, not UTC, near midnight", () => {
    // 2026-11-30T16:30Z is 00:30 on December 1 in Manila.
    expect(parseAnalyticsFilters({}, new Date("2026-11-30T16:30:00.000Z"))).toMatchObject({
      from: "2026-12-01",
      to: "2026-12-31",
    });
  });

  it("computes presets that include the current month", () => {
    expect(parseAnalyticsFilters({ range: "last_3_months" }, NOW)).toMatchObject({
      range: "last_3_months",
      from: "2026-09-01",
      to: "2026-11-30",
    });
    expect(parseAnalyticsFilters({ range: "last_12_months" }, NOW)).toMatchObject({
      range: "last_12_months",
      from: "2025-12-01",
      to: "2026-11-30",
    });
  });

  it("rolls presets back across the year boundary", () => {
    const january = new Date("2026-01-15T04:00:00.000Z");

    expect(parseAnalyticsFilters({ range: "last_3_months" }, january)).toMatchObject({
      from: "2025-11-01",
      to: "2026-01-31",
    });
    expect(parseAnalyticsFilters({ range: "last_12_months" }, january)).toMatchObject({
      from: "2025-02-01",
      to: "2026-01-31",
    });
  });

  it("accepts a custom inclusive range", () => {
    expect(parseAnalyticsFilters({ range: "custom", from: "2026-03-10", to: "2026-04-02" }, NOW)).toMatchObject({
      range: "custom",
      from: "2026-03-10",
      to: "2026-04-02",
    });
  });

  it("treats valid dates without a range as custom, and an explicit preset wins over dates", () => {
    expect(parseAnalyticsFilters({ from: "2026-03-10", to: "2026-03-10" }, NOW)).toMatchObject({
      range: "custom",
      from: "2026-03-10",
      to: "2026-03-10",
    });
    expect(parseAnalyticsFilters({ range: "last_3_months", from: "2026-03-10", to: "2026-04-02" }, NOW)).toMatchObject(
      { range: "last_3_months", from: "2026-09-01" },
    );
  });

  it("falls back to this month for an invalid custom range", () => {
    for (const params of [
      { range: "custom", from: "2026-04-02", to: "2026-03-10" },
      { range: "custom", from: "2026-02-30", to: "2026-03-10" },
      { range: "custom", from: "2026-03-10" },
      { range: "custom", from: "2024-01-01", to: "2026-01-01" },
      { range: "yearly" },
    ]) {
      expect(parseAnalyticsFilters(params, NOW)).toEqual(THIS_MONTH);
    }
  });

  it("allows a custom range of up to 24 months", () => {
    expect(parseAnalyticsFilters({ range: "custom", from: "2024-01-01", to: "2025-12-31" }, NOW)).toMatchObject({
      range: "custom",
      from: "2024-01-01",
      to: "2025-12-31",
    });
  });

  it("keeps valid doctor and department ids and drops malformed ones", () => {
    expect(parseAnalyticsFilters({ doctor: DOCTOR_ID, department: DEPARTMENT_ID }, NOW)).toMatchObject({
      doctorId: DOCTOR_ID,
      departmentId: DEPARTMENT_ID,
    });
    expect(parseAnalyticsFilters({ doctor: "nope", department: "1; drop" }, NOW)).toMatchObject({
      doctorId: null,
      departmentId: null,
    });
  });
});

describe("toAnalyticsQuery", () => {
  it("turns the inclusive end date into the metric layer's exclusive end", () => {
    expect(toAnalyticsQuery({ ...THIS_MONTH, doctorId: DOCTOR_ID })).toEqual({
      from: "2026-11-01",
      to: "2026-12-01",
      doctorId: DOCTOR_ID,
      departmentId: null,
    });
    expect(toAnalyticsQuery({ ...THIS_MONTH, range: "custom", from: "2026-12-31", to: "2026-12-31" })).toMatchObject({
      to: "2027-01-01",
    });
  });
});

describe("analyticsSearchParams and analyticsHref", () => {
  it("omits defaults so the plain page URL stays short", () => {
    expect(analyticsSearchParams(THIS_MONTH).toString()).toBe("");
    expect(analyticsHref(THIS_MONTH)).toBe("/admin/analytics");
  });

  it("round-trips presets and custom ranges with filters", () => {
    const cases: AnalyticsFilters[] = [
      { ...THIS_MONTH, range: "last_12_months", from: "2025-12-01", doctorId: DOCTOR_ID },
      { range: "custom", from: "2026-03-10", to: "2026-04-02", doctorId: null, departmentId: DEPARTMENT_ID },
    ];
    for (const filters of cases) {
      const params = Object.fromEntries(analyticsSearchParams(filters));
      expect(parseAnalyticsFilters(params, NOW)).toEqual(filters);
    }
  });

  it("writes presets without dates, since the dates follow from today", () => {
    expect(analyticsHref({ ...THIS_MONTH, range: "last_3_months", from: "2026-09-01" })).toBe(
      "/admin/analytics?range=last_3_months",
    );
  });
});
