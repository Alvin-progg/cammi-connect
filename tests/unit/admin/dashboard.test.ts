import { describe, expect, it } from "vitest";

import {
  dashboardHref,
  parseDashboardFilters,
  parseRecordIdParam,
  toDashboardQuery,
} from "@/lib/admin/dashboard";

const DOCTOR_ID = "00000000-0000-4000-8000-000000000101";

describe("parseRecordIdParam", () => {
  it("accepts a UUID and rejects anything else", () => {
    expect(parseRecordIdParam(DOCTOR_ID)).toBe(DOCTOR_ID);
    expect(parseRecordIdParam([DOCTOR_ID])).toBe(DOCTOR_ID);
    expect(parseRecordIdParam("not-a-uuid")).toBeNull();
    expect(parseRecordIdParam(undefined)).toBeNull();
  });
});

describe("parseDashboardFilters", () => {
  // Thursday 2026-11-05, noon Manila.
  const NOW = new Date("2026-11-05T04:00:00.000Z");
  const DEPARTMENT_ID = "00000000-0000-4000-8000-000000000201";

  it("defaults to this Manila month and keeps valid doctor and department ids", () => {
    expect(parseDashboardFilters({ doctor: DOCTOR_ID, department: "bad" }, NOW)).toEqual({
      range: "this_month",
      from: "2026-11-01",
      to: "2026-11-30",
      doctorId: DOCTOR_ID,
      departmentId: null,
    });
  });

  it("computes today and this Monday-to-Sunday week in Manila", () => {
    expect(parseDashboardFilters({ range: "today" }, NOW)).toMatchObject({ from: "2026-11-05", to: "2026-11-05" });
    expect(parseDashboardFilters({ range: "this_week" }, NOW)).toMatchObject({
      from: "2026-11-02",
      to: "2026-11-08",
    });
    // 2026-11-08T15:30Z is Sunday 23:30 in Manila: still the same week.
    expect(parseDashboardFilters({ range: "this_week" }, new Date("2026-11-08T15:30:00.000Z"))).toMatchObject({
      from: "2026-11-02",
      to: "2026-11-08",
    });
    // 2026-11-08T16:30Z is Monday 00:30 in Manila: the next week.
    expect(parseDashboardFilters({ range: "this_week" }, new Date("2026-11-08T16:30:00.000Z"))).toMatchObject({
      from: "2026-11-09",
      to: "2026-11-15",
    });
  });

  it("accepts a valid custom range and falls back to this month otherwise", () => {
    expect(parseDashboardFilters({ from: "2026-10-01", to: "2026-10-15" }, NOW)).toMatchObject({
      range: "custom",
      from: "2026-10-01",
      to: "2026-10-15",
    });
    expect(parseDashboardFilters({ from: "2026-10-15", to: "2026-10-01" }, NOW)).toMatchObject({
      range: "this_month",
    });
    expect(parseDashboardFilters({ from: "2020-01-01", to: "2026-10-01" }, NOW)).toMatchObject({
      range: "this_month",
    });
  });

  it("round-trips through the dashboard URL and makes an exclusive-end query", () => {
    const custom = parseDashboardFilters(
      { range: "custom", from: "2026-10-01", to: "2026-10-15", department: DEPARTMENT_ID },
      NOW,
    );
    const href = dashboardHref(custom);
    expect(href).toBe(`/admin?range=custom&from=2026-10-01&to=2026-10-15&department=${DEPARTMENT_ID}`);
    const params = Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(parseDashboardFilters(params, NOW)).toEqual(custom);
    expect(dashboardHref(parseDashboardFilters({}, NOW))).toBe("/admin");
    expect(dashboardHref(parseDashboardFilters({ range: "today" }, NOW))).toBe("/admin?range=today");
    expect(toDashboardQuery(custom)).toEqual({
      from: "2026-10-01",
      to: "2026-10-16",
      doctorId: null,
      departmentId: DEPARTMENT_ID,
    });
  });
});
