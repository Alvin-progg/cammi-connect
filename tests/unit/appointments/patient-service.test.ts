// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { PatientAppointment } from "@/lib/appointments/types";
import {
  listPatientAppointments,
  type PatientAppointmentsReader,
} from "@/server/appointments/service";

vi.mock("server-only", () => ({}));

const PATIENT_ID = "00000000-0000-4000-8000-000000000201";
const APPOINTMENT: PatientAppointment = {
  id: "appointment-1",
  doctorName: "Dr. Maya Santos",
  departmentName: "Cardiology",
  reason: "Follow-up",
  scheduledAt: "2026-11-02T01:00:00.000Z",
  durationMinutes: 30,
  status: "requested",
};

describe("listPatientAppointments", () => {
  it("reads only the signed-in patient's appointments", async () => {
    const reader: PatientAppointmentsReader = {
      listForPatient: vi.fn().mockResolvedValue([APPOINTMENT]),
    };

    await expect(listPatientAppointments(PATIENT_ID, reader)).resolves.toEqual([APPOINTMENT]);
    expect(reader.listForPatient).toHaveBeenCalledWith(PATIENT_ID);
  });
});
