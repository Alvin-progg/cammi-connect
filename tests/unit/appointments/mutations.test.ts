// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DoctorAppointment } from "@/lib/appointments/types";
import {
  rescheduleDoctorAppointment,
  transitionDoctorAppointment,
  type DoctorAppointmentsReader,
} from "@/server/appointments/service";

vi.mock("server-only", () => ({}));

const CONFIRMED: DoctorAppointment = {
  id: "22222222-2222-4222-8222-222222222222",
  patientName: "Synthetic Patient B",
  reason: "Follow-up check-up",
  scheduledAt: "2026-10-26T02:00:00.000Z",
  durationMinutes: 30,
  status: "confirmed",
};

const REQUESTED: DoctorAppointment = {
  id: "11111111-1111-4111-8111-111111111111",
  patientName: "Synthetic Patient A",
  reason: "Routine consultation",
  scheduledAt: "2026-10-26T01:00:00.000Z", // 09:00 PHT, Monday
  durationMinutes: 30,
  status: "requested",
};

function createReader(
  overrides: Partial<DoctorAppointmentsReader> = {},
): DoctorAppointmentsReader {
  return {
    listForDoctor: vi.fn().mockResolvedValue([]),
    countForDoctor: vi.fn().mockResolvedValue(0),
    getForDoctor: vi.fn().mockResolvedValue(REQUESTED),
    listActiveIntervals: vi.fn().mockResolvedValue([]),
    applyTransition: vi.fn().mockResolvedValue(true),
    reschedule: vi.fn().mockResolvedValue(true),
    insertHistory: vi.fn().mockResolvedValue(undefined),
    listHistory: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const AVAILABILITY = {
  listSchedulesForDoctor: vi.fn().mockResolvedValue([
    {
      id: "00000000-0000-4000-8000-000000000901",
      doctorId: "doctor-1",
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "17:00",
      slotDurationMinutes: 30,
      effectiveFrom: "2026-01-01",
      effectiveUntil: null,
      isActive: true,
    },
  ]),
  listExceptionsForDoctor: vi.fn().mockResolvedValue([]),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("transitionDoctorAppointment", () => {
  it("completes a confirmed appointment and writes history", async () => {
    const reader = createReader({
      getForDoctor: vi.fn().mockResolvedValue(CONFIRMED),
    });

    const result = await transitionDoctorAppointment(
      {
        doctorId: "doctor-1",
        appointmentId: CONFIRMED.id,
        action: "complete",
      },
      reader,
    );

    expect(result).toEqual({ ok: true });
    expect(reader.applyTransition).toHaveBeenCalledWith({
      appointmentId: CONFIRMED.id,
      from: ["confirmed", "checked_in"],
      to: "completed",
      cancellationReason: null,
    });
    expect(reader.insertHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: CONFIRMED.id,
        fromStatus: "confirmed",
        toStatus: "completed",
        changedByProfileId: "doctor-1",
      }),
    );
  });

  it("completes an appointment front desk checked in (FD-001 PR 5)", async () => {
    const reader = createReader({
      getForDoctor: vi.fn().mockResolvedValue({ ...CONFIRMED, status: "checked_in" }),
    });

    const result = await transitionDoctorAppointment(
      { doctorId: "doctor-1", appointmentId: CONFIRMED.id, action: "complete" },
      reader,
    );

    expect(result).toEqual({ ok: true });
    expect(reader.insertHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        fromStatus: "checked_in",
        toStatus: "completed",
        changedByProfileId: "doctor-1",
      }),
    );
  });

  it("requires a reason when cancelling", async () => {
    const reader = createReader();

    const result = await transitionDoctorAppointment(
      { doctorId: "doctor-1", appointmentId: REQUESTED.id, action: "cancel" },
      reader,
    );

    expect(result).toEqual({
      ok: false,
      message: "A reason is required to cancel.",
    });
    expect(reader.applyTransition).not.toHaveBeenCalled();
  });

  it("stores the cancellation reason and role", async () => {
    const reader = createReader();

    const result = await transitionDoctorAppointment(
      {
        doctorId: "doctor-1",
        appointmentId: REQUESTED.id,
        action: "cancel",
        reason: "Patient requested it",
      },
      reader,
    );

    expect(result).toEqual({ ok: true });
    expect(reader.applyTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "cancelled",
        cancellationReason: "Patient requested it",
      }),
    );
  });

  it("rejects illegal transitions before writing", async () => {
    const reader = createReader({
      getForDoctor: vi.fn().mockResolvedValue({
        ...REQUESTED,
        status: "completed",
      }),
    });

    const result = await transitionDoctorAppointment(
      {
        doctorId: "doctor-1",
        appointmentId: REQUESTED.id,
        action: "complete",
      },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(reader.applyTransition).not.toHaveBeenCalled();
  });

  it("denies appointments outside the doctor's scope", async () => {
    const reader = createReader({
      getForDoctor: vi.fn().mockResolvedValue(null),
    });

    const result = await transitionDoctorAppointment(
      {
        doctorId: "doctor-1",
        appointmentId: REQUESTED.id,
        action: "complete",
      },
      reader,
    );

    expect(result).toEqual({ ok: false, message: "Appointment not found." });
  });

  it("reports a concurrent status change from the guarded write", async () => {
    const reader = createReader({
      getForDoctor: vi.fn().mockResolvedValue(CONFIRMED),
      applyTransition: vi.fn().mockResolvedValue(false),
    });

    const result = await transitionDoctorAppointment(
      {
        doctorId: "doctor-1",
        appointmentId: REQUESTED.id,
        action: "complete",
      },
      reader,
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toMatch(/just changed/);
  });
});

describe("rescheduleDoctorAppointment", () => {
  it("moves the appointment inside regular hours and writes history", async () => {
    const reader = createReader();

    const result = await rescheduleDoctorAppointment(
      {
        doctorId: "doctor-1",
        appointmentId: REQUESTED.id,
        newScheduledAt: new Date("2026-10-26T03:00:00.000Z"), // 11:00 PHT Monday
        now: new Date("2026-10-25T04:00:00.000Z"),
      },
      { appointments: reader, availability: AVAILABILITY },
    );

    expect(result).toEqual({ ok: true });
    expect(reader.reschedule).toHaveBeenCalledWith({
      appointmentId: REQUESTED.id,
      scheduledAt: "2026-10-26T03:00:00.000Z",
      rescheduledFromAt: REQUESTED.scheduledAt,
    });
    expect(reader.listActiveIntervals).toHaveBeenCalledWith(
      expect.objectContaining({ excludeId: REQUESTED.id }),
    );
    expect(reader.insertHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        fromStatus: "requested",
        toStatus: "requested",
        reason: expect.stringContaining("Rescheduled from"),
      }),
    );
  });

  it("rejects a slot outside regular hours", async () => {
    const reader = createReader();

    const result = await rescheduleDoctorAppointment(
      {
        doctorId: "doctor-1",
        appointmentId: REQUESTED.id,
        newScheduledAt: new Date("2026-10-26T11:30:00.000Z"), // 19:30 PHT
        now: new Date("2026-10-25T04:00:00.000Z"),
      },
      { appointments: reader, availability: AVAILABILITY },
    );

    expect(result).toEqual({
      ok: false,
      message:
        "That time is outside your regular consultation hours. Adjust your schedule first if needed.",
    });
    expect(reader.reschedule).not.toHaveBeenCalled();
  });

  it("rejects a slot overlapping another active appointment", async () => {
    const reader = createReader({
      listActiveIntervals: vi.fn().mockResolvedValue([
        {
          start: "2026-10-26T03:00:00.000Z",
          end: "2026-10-26T03:30:00.000Z",
        },
      ]),
    });

    const result = await rescheduleDoctorAppointment(
      {
        doctorId: "doctor-1",
        appointmentId: REQUESTED.id,
        newScheduledAt: new Date("2026-10-26T03:00:00.000Z"),
        now: new Date("2026-10-25T04:00:00.000Z"),
      },
      { appointments: reader, availability: AVAILABILITY },
    );

    expect(result).toEqual({
      ok: false,
      message: "That time overlaps another appointment.",
    });
  });

  it("rejects rescheduling terminal appointments", async () => {
    const reader = createReader({
      getForDoctor: vi.fn().mockResolvedValue({
        ...REQUESTED,
        status: "cancelled",
      }),
    });

    const result = await rescheduleDoctorAppointment(
      {
        doctorId: "doctor-1",
        appointmentId: REQUESTED.id,
        newScheduledAt: new Date("2026-10-26T03:00:00.000Z"),
        now: new Date("2026-10-25T04:00:00.000Z"),
      },
      { appointments: reader, availability: AVAILABILITY },
    );

    expect(result).toEqual({
      ok: false,
      message: "Only requested or confirmed appointments can be rescheduled.",
    });
  });
});
