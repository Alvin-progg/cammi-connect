// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { PatientAppointment } from "@/lib/appointments/types";
import {
  cancelAppointmentForPatient,
  listPatientAppointments,
  type PatientAppointmentsReader,
  type PatientAppointmentsStore,
} from "@/server/appointments/service";

vi.mock("server-only", () => ({}));

const PATIENT_ID = "00000000-0000-4000-8000-000000000201";
const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000301";
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

function makeStore(overrides: Partial<PatientAppointmentsStore> = {}): PatientAppointmentsStore {
  return {
    listForPatient: vi.fn().mockResolvedValue([]),
    getForPatient: vi.fn().mockResolvedValue({
      id: APPOINTMENT_ID,
      doctorName: "Dr. Maya Santos",
      scheduledAt: "2026-11-02T01:00:00.000Z",
      status: "confirmed",
    }),
    cancelForPatient: vi.fn().mockResolvedValue(true),
    insertHistory: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("cancelAppointmentForPatient", () => {
  it("cancels the patient's own appointment and records the patient as the actor", async () => {
    const store = makeStore();

    const result = await cancelAppointmentForPatient(
      { patientId: PATIENT_ID, appointmentId: APPOINTMENT_ID },
      store,
    );

    expect(result).toEqual({
      ok: true,
      appointment: {
        id: APPOINTMENT_ID,
        doctorName: "Dr. Maya Santos",
        scheduledAt: "2026-11-02T01:00:00.000Z",
        status: "confirmed",
      },
    });
    expect(store.getForPatient).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
    });
    expect(store.cancelForPatient).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
      from: ["requested", "confirmed"],
    });
    expect(store.insertHistory).toHaveBeenCalledWith({
      appointmentId: APPOINTMENT_ID,
      fromStatus: "confirmed",
      toStatus: "cancelled",
      changedByProfileId: PATIENT_ID,
      reason: null,
      scheduledAtSnapshot: "2026-11-02T01:00:00.000Z",
    });
  });

  it("reports another patient's or a missing appointment as not found", async () => {
    const store = makeStore({ getForPatient: vi.fn().mockResolvedValue(null) });

    const result = await cancelAppointmentForPatient(
      { patientId: PATIENT_ID, appointmentId: APPOINTMENT_ID },
      store,
    );

    expect(result).toEqual({ ok: false, code: "not_found", message: "Appointment not found." });
    expect(store.cancelForPatient).not.toHaveBeenCalled();
    expect(store.insertHistory).not.toHaveBeenCalled();
  });

  it.each(["completed", "cancelled", "no_show"] as const)(
    "refuses to cancel a %s appointment",
    async (status) => {
      const store = makeStore({
        getForPatient: vi.fn().mockResolvedValue({
          id: APPOINTMENT_ID,
          doctorName: "Dr. Maya Santos",
          scheduledAt: "2026-11-02T01:00:00.000Z",
          status,
        }),
      });

      const result = await cancelAppointmentForPatient(
        { patientId: PATIENT_ID, appointmentId: APPOINTMENT_ID },
        store,
      );

      expect(result).toEqual({
        ok: false,
        code: "not_cancellable",
        message: "This appointment can no longer be cancelled.",
      });
      expect(store.cancelForPatient).not.toHaveBeenCalled();
    },
  );

  it("reports a concurrent status change and writes no history", async () => {
    const store = makeStore({ cancelForPatient: vi.fn().mockResolvedValue(false) });

    const result = await cancelAppointmentForPatient(
      { patientId: PATIENT_ID, appointmentId: APPOINTMENT_ID },
      store,
    );

    expect(result).toEqual({
      ok: false,
      code: "changed",
      message: "The appointment status just changed. Refresh and try again.",
    });
    expect(store.insertHistory).not.toHaveBeenCalled();
  });
});
