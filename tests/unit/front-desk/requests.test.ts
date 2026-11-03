import { describe, expect, it } from "vitest";

import {
  REQUEST_STATUS_FILTERS,
  formatRequestId,
  parseRequestQueueFilters,
} from "@/lib/front-desk/requests";

const DOCTOR_ID = "00000000-0000-4000-8000-000000000101";
const SPECIALTY_ID = "00000000-0000-4000-8000-000000000501";

describe("parseRequestQueueFilters", () => {
  it("defaults to pending requests with no other filters", () => {
    expect(parseRequestQueueFilters({})).toEqual({
      status: "pending",
      date: null,
      doctorId: null,
      specialtyId: null,
    });
  });

  it("accepts every supported status filter", () => {
    for (const status of REQUEST_STATUS_FILTERS) {
      expect(parseRequestQueueFilters({ status }).status).toBe(status);
    }
  });

  it("keeps a valid Manila date, doctor, and specialty", () => {
    expect(
      parseRequestQueueFilters({
        status: "confirmed",
        date: "2026-11-04",
        doctor: DOCTOR_ID,
        specialty: SPECIALTY_ID,
      }),
    ).toEqual({
      status: "confirmed",
      date: "2026-11-04",
      doctorId: DOCTOR_ID,
      specialtyId: SPECIALTY_ID,
    });
  });

  it("drops unknown statuses, invalid dates, and malformed ids", () => {
    expect(
      parseRequestQueueFilters({
        status: "requested",
        date: "2026-02-30",
        doctor: "not-a-uuid",
        specialty: "1; drop table",
      }),
    ).toEqual({
      status: "pending",
      date: null,
      doctorId: null,
      specialtyId: null,
    });
  });

  it("uses the first value of repeated params", () => {
    expect(
      parseRequestQueueFilters({
        status: ["rejected", "cancelled"],
        date: ["2026-11-05", "2026-11-06"],
      }),
    ).toMatchObject({ status: "rejected", date: "2026-11-05" });
  });
});

describe("formatRequestId", () => {
  it("shows the first eight characters in upper case", () => {
    expect(formatRequestId("ab12cd34-0000-4000-8000-000000000201")).toBe(
      "AB12CD34",
    );
  });
});
