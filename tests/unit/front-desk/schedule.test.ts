import { describe, expect, it } from "vitest";

import { APPOINTMENT_STATUSES } from "@/lib/appointments/status";
import {
  ATTENDANCE_STATUSES,
  SCHEDULE_SEARCH_MAX_LENGTH,
  allowedAttendanceActions,
  isAttendanceStatus,
  parseScheduleFilters,
  recordAttendanceSchema,
} from "@/lib/front-desk/schedule";

const DOCTOR_ID = "00000000-0000-4000-8000-000000000101";
const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000202";

// 10:00 on 2026-11-04 in Manila (UTC+8).
const NOW = new Date("2026-11-04T02:00:00.000Z");
const TODAY_9AM = "2026-11-04T01:00:00.000Z";
const YESTERDAY_9AM = "2026-11-03T01:00:00.000Z";
const TOMORROW_9AM = "2026-11-05T01:00:00.000Z";

describe("allowedAttendanceActions", () => {
  it("offers check-in, completed, and no-show for a confirmed appointment today", () => {
    expect(allowedAttendanceActions("confirmed", TODAY_9AM, NOW)).toEqual([
      "checked_in",
      "completed",
      "no_show",
    ]);
  });

  it("offers only completed once the patient is checked in", () => {
    expect(allowedAttendanceActions("checked_in", TODAY_9AM, NOW)).toEqual([
      "completed",
    ]);
  });

  it("offers nothing for any other status", () => {
    for (const status of APPOINTMENT_STATUSES) {
      if (status === "confirmed" || status === "checked_in") continue;
      expect(allowedAttendanceActions(status, TODAY_9AM, NOW)).toEqual([]);
    }
  });

  it("still allows attendance for a past day", () => {
    expect(allowedAttendanceActions("confirmed", YESTERDAY_9AM, NOW)).toEqual([
      "checked_in",
      "completed",
      "no_show",
    ]);
  });

  it("refuses attendance before the appointment's Manila day", () => {
    expect(allowedAttendanceActions("confirmed", TOMORROW_9AM, NOW)).toEqual([]);
    expect(allowedAttendanceActions("checked_in", TOMORROW_9AM, NOW)).toEqual([]);
  });

  it("uses the Manila day boundary, not UTC", () => {
    // 23:30 UTC on Nov 3 is 07:30 on Nov 4 in Manila.
    const lateUtc = new Date("2026-11-03T23:30:00.000Z");
    // 00:30 on Nov 4 in Manila is still Nov 3 in UTC.
    expect(allowedAttendanceActions("confirmed", "2026-11-03T16:30:00.000Z", lateUtc)).toEqual([
      "checked_in",
      "completed",
      "no_show",
    ]);
    // 00:30 on Nov 5 in Manila is Nov 4 in UTC, but it is tomorrow in Manila.
    expect(
      allowedAttendanceActions("confirmed", "2026-11-04T16:30:00.000Z", lateUtc),
    ).toEqual([]);
  });
});

describe("isAttendanceStatus", () => {
  it("accepts only the three attendance statuses", () => {
    for (const status of ATTENDANCE_STATUSES) {
      expect(isAttendanceStatus(status)).toBe(true);
    }
    for (const status of ["requested", "confirmed", "cancelled", "rejected", "x"]) {
      expect(isAttendanceStatus(status)).toBe(false);
    }
  });
});

describe("recordAttendanceSchema", () => {
  it("accepts an appointment id and an attendance status", () => {
    expect(
      recordAttendanceSchema.parse({ appointmentId: APPOINTMENT_ID, status: "no_show" }),
    ).toEqual({ appointmentId: APPOINTMENT_ID, status: "no_show" });
  });

  it("rejects other statuses and malformed ids", () => {
    expect(
      recordAttendanceSchema.safeParse({ appointmentId: APPOINTMENT_ID, status: "confirmed" })
        .success,
    ).toBe(false);
    expect(
      recordAttendanceSchema.safeParse({ appointmentId: "202", status: "checked_in" }).success,
    ).toBe(false);
  });
});

describe("parseScheduleFilters", () => {
  it("defaults to today in Manila with no other filters", () => {
    expect(parseScheduleFilters({}, NOW)).toEqual({
      date: "2026-11-04",
      doctorId: null,
      status: "all",
      search: null,
    });
  });

  it("keeps a valid date, doctor, status, and trimmed search", () => {
    expect(
      parseScheduleFilters(
        { date: "2026-11-06", doctor: DOCTOR_ID, status: "checked_in", q: "  Reyes " },
        NOW,
      ),
    ).toEqual({
      date: "2026-11-06",
      doctorId: DOCTOR_ID,
      status: "checked_in",
      search: "Reyes",
    });
  });

  it("accepts every stored status", () => {
    for (const status of APPOINTMENT_STATUSES) {
      expect(parseScheduleFilters({ status }, NOW).status).toBe(status);
    }
  });

  it("drops invalid values", () => {
    expect(
      parseScheduleFilters(
        { date: "2026-02-30", doctor: "not-a-uuid", status: "pending", q: "   " },
        NOW,
      ),
    ).toEqual({ date: "2026-11-04", doctorId: null, status: "all", search: null });
  });

  it("caps the search length", () => {
    const search = parseScheduleFilters({ q: "a".repeat(200) }, NOW).search;
    expect(search).toHaveLength(SCHEDULE_SEARCH_MAX_LENGTH);
  });

  it("uses the first value of repeated params", () => {
    expect(
      parseScheduleFilters({ date: ["2026-11-05", "2026-11-06"], q: ["Ana", "Ben"] }, NOW),
    ).toMatchObject({ date: "2026-11-05", search: "Ana" });
  });
});
