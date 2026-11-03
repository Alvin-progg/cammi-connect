import { describe, expect, it } from "vitest";

import {
  frontDeskBookingSchema,
  normalizePhone,
  parseBookingParams,
  patientSearchSchema,
  registerPatientSchema,
} from "@/lib/front-desk/booking";

const PATIENT_ID = "00000000-0000-4000-8000-000000000401";
const DOCTOR_ID = "00000000-0000-4000-8000-000000000101";
const SPECIALTY_ID = "00000000-0000-4000-8000-000000000501";
const NOW = new Date("2026-11-03T02:00:00.000Z");

describe("patientSearchSchema", () => {
  it("trims the query", () => {
    expect(patientSearchSchema.parse({ q: "  Santos  " })).toEqual({ q: "Santos" });
  });

  it("refuses a query shorter than two characters", () => {
    const parsed = patientSearchSchema.safeParse({ q: " a " });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(
      "Enter at least 2 characters of the name or phone number.",
    );
  });

  it("refuses a query longer than 80 characters", () => {
    expect(patientSearchSchema.safeParse({ q: "x".repeat(81) }).success).toBe(false);
  });
});

describe("registerPatientSchema", () => {
  it("trims the name and phone", () => {
    expect(
      registerPatientSchema.parse({ fullName: "  Test Walkin  ", phone: " +63 900 000 0000 " }),
    ).toEqual({ fullName: "Test Walkin", phone: "+63 900 000 0000" });
  });

  it("requires a name", () => {
    const parsed = registerPatientSchema.safeParse({ fullName: "  ", phone: "09000000000" });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("Enter the patient's full name.");
  });

  it("requires a valid phone number", () => {
    for (const phone of ["", "abc", "12"]) {
      expect(
        registerPatientSchema.safeParse({ fullName: "Test Walkin", phone }).success,
      ).toBe(false);
    }
  });

  it("refuses an overlong name", () => {
    expect(
      registerPatientSchema.safeParse({ fullName: "x".repeat(121), phone: "09000000000" })
        .success,
    ).toBe(false);
  });
});

describe("frontDeskBookingSchema", () => {
  const scheduledAt = "2026-11-05T01:30:00.000Z";

  it("returns the booking with an optional specialty and reason", () => {
    expect(
      frontDeskBookingSchema.parse({
        patientId: PATIENT_ID,
        doctorId: DOCTOR_ID,
        specialtyId: SPECIALTY_ID,
        scheduledAt,
        reason: "  Follow-up  ",
      }),
    ).toEqual({
      patientId: PATIENT_ID,
      doctorId: DOCTOR_ID,
      specialtyId: SPECIALTY_ID,
      scheduledAt,
      reason: "Follow-up",
    });
  });

  it("turns an empty specialty and reason into null", () => {
    expect(
      frontDeskBookingSchema.parse({
        patientId: PATIENT_ID,
        doctorId: DOCTOR_ID,
        specialtyId: "",
        scheduledAt,
        reason: "   ",
      }),
    ).toMatchObject({ specialtyId: null, reason: null });
  });

  it("requires a chosen time", () => {
    const parsed = frontDeskBookingSchema.safeParse({
      patientId: PATIENT_ID,
      doctorId: DOCTOR_ID,
      specialtyId: "",
      scheduledAt: null,
      reason: "",
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("Choose a time.");
  });

  it("refuses malformed ids and an overlong reason", () => {
    expect(
      frontDeskBookingSchema.safeParse({
        patientId: "401",
        doctorId: DOCTOR_ID,
        scheduledAt,
      }).success,
    ).toBe(false);
    expect(
      frontDeskBookingSchema.safeParse({
        patientId: PATIENT_ID,
        doctorId: DOCTOR_ID,
        scheduledAt,
        reason: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
});

describe("parseBookingParams", () => {
  it("defaults to today in Manila with nothing chosen", () => {
    expect(parseBookingParams({}, NOW)).toEqual({
      search: null,
      patientId: null,
      specialtyId: null,
      doctorId: null,
      date: "2026-11-03",
    });
  });

  it("keeps valid values and drops invalid ones", () => {
    expect(
      parseBookingParams(
        {
          q: "  Santos ",
          patient: PATIENT_ID,
          specialty: "not-a-uuid",
          doctor: [DOCTOR_ID],
          date: "2026-02-30",
        },
        NOW,
      ),
    ).toEqual({
      search: "Santos",
      patientId: PATIENT_ID,
      specialtyId: null,
      doctorId: DOCTOR_ID,
      date: "2026-11-03",
    });
  });

  it("keeps a valid date", () => {
    expect(parseBookingParams({ date: "2026-11-10" }, NOW).date).toBe("2026-11-10");
  });
});

describe("normalizePhone", () => {
  it("drops spaces, dots, dashes, and parentheses but keeps a leading plus", () => {
    expect(normalizePhone(" +63 (900) 000-00.00 ")).toBe("+639000000000");
    expect(normalizePhone("0900 000 0000")).toBe("09000000000");
  });
});
