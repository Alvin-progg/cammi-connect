// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DoctorAppointment } from "@/lib/appointments/types";
import {
  listDoctorAppointments,
  type DoctorAppointmentsReader,
} from "@/server/appointments/service";

vi.mock("server-only", () => ({}));

const APPOINTMENT: DoctorAppointment = {
  id: "appointment-1",
  patientName: "Synthetic Patient A",
  reason: "Routine consultation",
  scheduledAt: "2026-10-25T01:00:00.000Z",
  durationMinutes: 30,
  status: "confirmed",
};

function createReader(
  appointments: DoctorAppointment[] = [APPOINTMENT],
): DoctorAppointmentsReader {
  return {
    listForDoctor: vi.fn().mockResolvedValue(appointments),
    countForDoctor: vi.fn().mockResolvedValue(appointments.length),
    getForDoctor: vi.fn().mockResolvedValue(appointments[0] ?? null),
    listActiveIntervals: vi.fn().mockResolvedValue([]),
    applyTransition: vi.fn().mockResolvedValue(true),
    reschedule: vi.fn().mockResolvedValue(true),
    insertHistory: vi.fn().mockResolvedValue(undefined),
    listHistory: vi.fn().mockResolvedValue([]),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listDoctorAppointments", () => {
  it("queries only the session doctor's appointments for the Manila day", async () => {
    const reader = createReader();

    await listDoctorAppointments(
      {
        doctorId: "doctor-profile-1",
        filters: { date: "2026-10-25", status: null },
      },
      reader,
    );

    expect(reader.listForDoctor).toHaveBeenCalledWith({
      doctorId: "doctor-profile-1",
      start: "2026-10-24T16:00:00.000Z",
      end: "2026-10-25T16:00:00.000Z",
      status: null,
    });
  });

  it("passes an approved status filter through to the reader", async () => {
    const reader = createReader();

    await listDoctorAppointments(
      {
        doctorId: "doctor-profile-1",
        filters: { date: "2026-10-25", status: "requested" },
      },
      reader,
    );

    expect(reader.listForDoctor).toHaveBeenCalledWith(
      expect.objectContaining({ status: "requested" }),
    );
  });

  it("returns the reader's appointment DTOs unchanged", async () => {
    const reader = createReader([APPOINTMENT]);

    const result = await listDoctorAppointments(
      {
        doctorId: "doctor-profile-1",
        filters: { date: "2026-10-25", status: null },
      },
      reader,
    );

    expect(result).toEqual([APPOINTMENT]);
  });
});
