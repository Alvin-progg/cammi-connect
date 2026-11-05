import { describe, expect, it } from "vitest";

import {
  monitoringDateBounds,
  monitoringListHref,
  parseAppointmentMonitoringFilters,
  type AppointmentMonitoringFilters,
} from "@/lib/appointments/monitoring";

const DOCTOR_ID = "00000000-0000-4000-8000-000000000010";
const DEPARTMENT_ID = "00000000-0000-4000-8000-000000000020";

const DEFAULTS: AppointmentMonitoringFilters = {
  search: "",
  doctorId: null,
  departmentId: null,
  statuses: [],
  source: null,
  from: null,
  to: null,
  page: 1,
};

describe("parseAppointmentMonitoringFilters", () => {
  it("defaults to no filters on page 1", () => {
    expect(parseAppointmentMonitoringFilters({})).toEqual(DEFAULTS);
  });

  it("reads every filter from the search params", () => {
    expect(
      parseAppointmentMonitoringFilters({
        q: "  Synthetic Patient ",
        doctor: DOCTOR_ID,
        department: DEPARTMENT_ID,
        status: ["confirmed", "completed"],
        source: "front_desk",
        from: "2026-11-01",
        to: "2026-11-30",
        page: "3",
      }),
    ).toEqual({
      search: "Synthetic Patient",
      doctorId: DOCTOR_ID,
      departmentId: DEPARTMENT_ID,
      statuses: ["confirmed", "completed"],
      source: "front_desk",
      from: "2026-11-01",
      to: "2026-11-30",
      page: 3,
    });
  });

  it("accepts a single status and drops unknown or repeated ones", () => {
    expect(parseAppointmentMonitoringFilters({ status: "no_show" }).statuses).toEqual(["no_show"]);
    expect(
      parseAppointmentMonitoringFilters({ status: ["confirmed", "bogus", "confirmed"] }).statuses,
    ).toEqual(["confirmed"]);
  });

  it("falls back to defaults for malformed values", () => {
    expect(
      parseAppointmentMonitoringFilters({
        doctor: "not-a-uuid",
        department: "1",
        source: "fax",
        from: "2026-02-30",
        to: "yesterday",
        page: "0",
      }),
    ).toEqual(DEFAULTS);
    expect(parseAppointmentMonitoringFilters({ page: "-2" }).page).toBe(1);
    expect(parseAppointmentMonitoringFilters({ page: "abc" }).page).toBe(1);
  });

  it("caps the patient search length", () => {
    expect(parseAppointmentMonitoringFilters({ q: "a".repeat(150) }).search).toHaveLength(100);
  });

  it("swaps a reversed date range", () => {
    const filters = parseAppointmentMonitoringFilters({ from: "2026-11-30", to: "2026-11-01" });
    expect(filters.from).toBe("2026-11-01");
    expect(filters.to).toBe("2026-11-30");
  });
});

describe("monitoringDateBounds", () => {
  it("covers whole Manila days, end exclusive", () => {
    expect(monitoringDateBounds({ from: "2026-11-01", to: "2026-11-02" })).toEqual({
      start: "2026-10-31T16:00:00.000Z",
      end: "2026-11-02T16:00:00.000Z",
    });
  });

  it("leaves an open side unbounded", () => {
    expect(monitoringDateBounds({ from: null, to: "2026-11-02" })).toEqual({
      start: null,
      end: "2026-11-02T16:00:00.000Z",
    });
    expect(monitoringDateBounds({ from: null, to: null })).toEqual({ start: null, end: null });
  });
});

describe("monitoringListHref", () => {
  it("is the bare path without filters", () => {
    expect(monitoringListHref(DEFAULTS)).toBe("/admin/appointments");
  });

  it("round-trips the filters through the URL", () => {
    const filters: AppointmentMonitoringFilters = {
      search: "Synthetic",
      doctorId: DOCTOR_ID,
      departmentId: DEPARTMENT_ID,
      statuses: ["requested", "confirmed"],
      source: "ai_chatbot",
      from: "2026-11-01",
      to: "2026-11-07",
      page: 1,
    };
    const href = monitoringListHref(filters, 2);
    const params = new URL(href, "http://localhost").searchParams;

    expect(
      parseAppointmentMonitoringFilters({
        q: params.get("q") ?? undefined,
        doctor: params.get("doctor") ?? undefined,
        department: params.get("department") ?? undefined,
        status: params.getAll("status"),
        source: params.get("source") ?? undefined,
        from: params.get("from") ?? undefined,
        to: params.get("to") ?? undefined,
        page: params.get("page") ?? undefined,
      }),
    ).toEqual({ ...filters, page: 2 });
  });
});
