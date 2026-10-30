// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { bookAppointmentSchema } from "@/lib/appointments/schemas";
import {
  bookAppointment,
  type AppointmentBooker,
} from "@/server/appointments/service";

vi.mock("server-only", () => ({}));

const DOCTOR_ID = "00000000-0000-4000-8000-000000000101";
const PATIENT_ID = "00000000-0000-4000-8000-000000000001";
const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000201";
const SLOT = new Date("2026-11-02T09:00:00+08:00");

function bookerReturning(
  result: Awaited<ReturnType<AppointmentBooker["book"]>>,
): AppointmentBooker {
  return { book: vi.fn().mockResolvedValue(result) };
}

const REQUEST = {
  patientId: PATIENT_ID,
  doctorId: DOCTOR_ID,
  scheduledAt: SLOT,
  reason: "Routine consultation",
};

describe("bookAppointment", () => {
  it("passes the session patient and requested slot to the atomic booker", async () => {
    const booker = bookerReturning({ ok: true, appointmentId: APPOINTMENT_ID });

    await expect(bookAppointment(REQUEST, booker)).resolves.toEqual({
      ok: true,
      appointmentId: APPOINTMENT_ID,
    });
    expect(booker.book).toHaveBeenCalledWith({
      doctorId: DOCTOR_ID,
      patientId: PATIENT_ID,
      scheduledAt: SLOT.toISOString(),
      reason: "Routine consultation",
    });
  });

  it.each([
    ["inactive_doctor", "This doctor is not accepting appointments."],
    ["past", "Choose a future appointment time."],
    ["outside_hours", "That time is outside the doctor's consultation hours."],
    ["blocked", "The doctor is unavailable at that time."],
  ])("maps the %s booking rejection", async (code, message) => {
    const booker = bookerReturning({
      ok: false,
      error: { code: "P0001", message: code },
    });

    await expect(bookAppointment(REQUEST, booker)).resolves.toEqual({
      ok: false,
      message,
    });
  });

  it("maps the database overlap constraint to a slot-taken message", async () => {
    const booker = bookerReturning({
      ok: false,
      error: { code: "23P01", message: "conflicting key value violates exclusion constraint" },
    });

    await expect(bookAppointment(REQUEST, booker)).resolves.toEqual({
      ok: false,
      message: "That slot was just booked. Choose another time.",
    });
  });

  it("treats an unknown raised message as an unexpected error", async () => {
    const booker = bookerReturning({
      ok: false,
      error: { code: "P0001", message: "toString" },
    });

    await expect(bookAppointment(REQUEST, booker)).rejects.toThrow(
      "Unable to book the appointment.",
    );
  });

  it("does not leak unexpected database errors", async () => {
    const booker = bookerReturning({
      ok: false,
      error: { code: "XX000", message: "internal detail" },
    });

    await expect(bookAppointment(REQUEST, booker)).rejects.toThrow(
      "Unable to book the appointment.",
    );
  });
});

describe("bookAppointmentSchema", () => {
  it("accepts a doctor, an ISO time, and an optional reason", () => {
    expect(
      bookAppointmentSchema.parse({
        doctorId: DOCTOR_ID,
        scheduledAt: SLOT.toISOString(),
        reason: "",
      }),
    ).toEqual({ doctorId: DOCTOR_ID, scheduledAt: SLOT, reason: null });
  });

  it("rejects a missing doctor or an invalid time", () => {
    expect(
      bookAppointmentSchema.safeParse({ doctorId: "", scheduledAt: SLOT.toISOString() })
        .success,
    ).toBe(false);
    expect(
      bookAppointmentSchema.safeParse({ doctorId: DOCTOR_ID, scheduledAt: "soon" }).success,
    ).toBe(false);
  });
});
