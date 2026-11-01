// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { Department, DoctorSummary, Specialty } from "@/lib/directory/types";
import type { AppointmentBooker } from "@/server/appointments/service";
import type { AvailabilitySource } from "@/server/availability/service";
import { createChatTools, type ChatToolDeps } from "@/server/chat/tools";
import type { DirectoryStore } from "@/server/directory/service";

vi.mock("server-only", () => ({}));

const DEPARTMENTS: Department[] = [
  { id: "dep1", name: "Cardiology", code: "CARD", description: null, isActive: true },
  { id: "dep2", name: "Closed Wing", code: "CLSD", description: null, isActive: false },
];
const SPECIALTIES: Specialty[] = [
  { id: "sp1", name: "Interventional Cardiology", description: null, isActive: true },
  { id: "sp2", name: "Retired Specialty", description: null, isActive: false },
];
const MAYA: DoctorSummary = {
  id: "d1",
  fullName: "Maya Santos",
  departmentId: "dep1",
  departmentName: "Cardiology",
  isActive: true,
  specialties: [{ id: "sp1", name: "Interventional Cardiology" }],
};
const JOSE: DoctorSummary = { ...MAYA, id: "d2", fullName: "José Santos" };

function fakeStore(): DirectoryStore {
  return {
    listDepartments: vi.fn(async () => DEPARTMENTS),
    listSpecialties: vi.fn(async () => SPECIALTIES),
    listDoctors: vi.fn(async () => [MAYA, JOSE]),
    getDoctor: vi.fn(),
    saveDepartment: vi.fn(),
    saveSpecialty: vi.fn(),
    saveDoctor: vi.fn(),
    listLinkableAccounts: vi.fn(),
  };
}

// 2026-10-31 09:00 in Manila.
const NOW = new Date("2026-10-31T01:00:00Z");
const PATIENT_ID = "00000000-0000-4000-8000-000000000201";
const DOCTOR_ID = "00000000-0000-4000-8000-0000000000d1";
const SPECIALTY_ID = "00000000-0000-4000-8000-0000000005a1";

function fakeAvailability(): AvailabilitySource {
  const doctor: DoctorSummary = {
    ...MAYA,
    id: DOCTOR_ID,
    specialties: [{ id: SPECIALTY_ID, name: "Interventional Cardiology" }],
  };
  return {
    listSpecialties: vi.fn(async () => [{ ...SPECIALTIES[0], id: SPECIALTY_ID }]),
    listDoctors: vi.fn(async () => [doctor]),
    getDoctor: vi.fn(async () => doctor),
    listSchedulesForDoctor: vi.fn(async () => []),
    listExceptionsForDoctor: vi.fn(async () => []),
    listActiveIntervals: vi.fn(async () => []),
  };
}

function fakeBooker(): AppointmentBooker {
  return { book: vi.fn(async () => ({ ok: true as const, appointmentId: "a1" })) };
}

function toolDeps(store: DirectoryStore = fakeStore()): ChatToolDeps {
  return { directory: store, availability: fakeAvailability(), booker: fakeBooker(), now: () => NOW };
}

describe("chat directory tools", () => {
  it("returns active departments only", async () => {
    const tools = createChatTools(toolDeps());

    expect(await tools.getDepartments()).toEqual([DEPARTMENTS[0]]);
  });

  it("returns active specialties only", async () => {
    const tools = createChatTools(toolDeps());

    expect(await tools.getSpecialties()).toEqual([SPECIALTIES[0]]);
  });

  it("looks doctors up among active doctors only", async () => {
    const store = fakeStore();
    const tools = createChatTools(toolDeps(store));

    await tools.getDoctorDetails({ doctorName: "Maya Santos" });

    expect(store.listDoctors).toHaveBeenCalledWith(expect.objectContaining({ activeOnly: true }));
  });

  it("finds one doctor by name", async () => {
    const tools = createChatTools(toolDeps());

    expect(await tools.getDoctorDetails({ doctorName: "Dr. Maya Santos" })).toEqual({
      status: "found",
      doctor: MAYA,
    });
  });

  it("returns every match when the name is ambiguous", async () => {
    const tools = createChatTools(toolDeps());

    expect(await tools.getDoctorDetails({ doctorName: "Dr. Santos" })).toEqual({
      status: "several",
      doctors: [MAYA, JOSE],
    });
  });

  it("reports an unknown doctor", async () => {
    const tools = createChatTools(toolDeps());

    expect(await tools.getDoctorDetails({ doctorName: "Dr. House" })).toEqual({
      status: "unknown",
    });
  });

  it("rejects an invalid name before querying", async () => {
    const store = fakeStore();
    const tools = createChatTools(toolDeps(store));

    await expect(tools.getDoctorDetails({ doctorName: "   " })).rejects.toThrow();
    await expect(tools.getDoctorDetails({ doctorName: "x".repeat(201) })).rejects.toThrow();
    expect(store.listDoctors).not.toHaveBeenCalled();
  });
});

describe("chat booking tools", () => {
  it("lists active doctors of a specialty", async () => {
    const store = fakeStore();
    const tools = createChatTools(toolDeps(store));

    expect(await tools.getDoctorsBySpecialty({ specialtyId: SPECIALTY_ID })).toEqual([MAYA, JOSE]);
    expect(store.listDoctors).toHaveBeenCalledWith({
      specialtyId: SPECIALTY_ID,
      departmentId: undefined,
      activeOnly: true,
    });
  });

  it("returns an active doctor by ID and hides inactive ones", async () => {
    const store = fakeStore();
    vi.mocked(store.getDoctor)
      .mockResolvedValueOnce(MAYA)
      .mockResolvedValueOnce({ ...MAYA, isActive: false })
      .mockResolvedValueOnce(null);
    const tools = createChatTools(toolDeps(store));

    expect(await tools.getDoctor({ doctorId: DOCTOR_ID })).toEqual(MAYA);
    expect(await tools.getDoctor({ doctorId: DOCTOR_ID })).toBeNull();
    expect(await tools.getDoctor({ doctorId: DOCTOR_ID })).toBeNull();
  });

  it("rejects malformed IDs before querying", async () => {
    const store = fakeStore();
    const tools = createChatTools(toolDeps(store));

    await expect(tools.getDoctor({ doctorId: "d1" })).rejects.toThrow();
    await expect(tools.getDoctorsBySpecialty({ specialtyId: "sp1" })).rejects.toThrow();
    expect(store.getDoctor).not.toHaveBeenCalled();
    expect(store.listDoctors).not.toHaveBeenCalled();
  });

  it("reads availability from the doctor's schedules for the requested window", async () => {
    const deps = toolDeps();
    // Tuesday 08:00-10:00 Manila, 30-minute slots.
    vi.mocked(deps.availability.listSchedulesForDoctor).mockResolvedValue([
      {
        id: "sch1",
        doctorId: DOCTOR_ID,
        dayOfWeek: 2,
        startTime: "08:00",
        endTime: "10:00",
        slotDurationMinutes: 30,
        effectiveFrom: "2026-01-01",
        effectiveUntil: null,
        isActive: true,
      },
    ]);
    const tools = createChatTools(deps);

    const slots = await tools.getDoctorAvailability({
      doctorId: DOCTOR_ID,
      specialtyId: SPECIALTY_ID,
      fromDate: "2026-11-03",
      days: 1,
      preferredTime: "9am",
    });

    expect(deps.availability.getDoctor).toHaveBeenCalledWith(DOCTOR_ID);
    expect(slots).toEqual([
      { start: "2026-11-03T01:00:00.000Z", end: "2026-11-03T01:30:00.000Z" },
      { start: "2026-11-03T01:30:00.000Z", end: "2026-11-03T02:00:00.000Z" },
    ]);
  });

  it("returns no slots for a doctor the availability service does not offer", async () => {
    const deps = toolDeps();
    vi.mocked(deps.availability.getDoctor).mockResolvedValue(null);
    const tools = createChatTools(deps);

    expect(
      await tools.getDoctorAvailability({ doctorId: DOCTOR_ID, fromDate: "2026-11-03", days: 7 }),
    ).toEqual([]);
  });

  it("rejects an availability window longer than the service allows", async () => {
    const tools = createChatTools(toolDeps());

    await expect(
      tools.getDoctorAvailability({ doctorId: DOCTOR_ID, fromDate: "2026-11-03", days: 15 }),
    ).rejects.toThrow();
  });

  it("books through the atomic booker with the patient from the caller", async () => {
    const deps = toolDeps();
    const tools = createChatTools(deps);

    const result = await tools.createAppointment({
      patientId: PATIENT_ID,
      doctorId: DOCTOR_ID,
      start: "2026-11-03T01:00:00.000Z",
      reason: "Follow-up",
    });

    expect(result).toEqual({ ok: true, appointmentId: "a1" });
    expect(deps.booker.book).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      doctorId: DOCTOR_ID,
      scheduledAt: "2026-11-03T01:00:00.000Z",
      reason: "Follow-up",
    });
  });

  it("returns the mapped message when the slot was just taken", async () => {
    const deps = toolDeps();
    vi.mocked(deps.booker.book).mockResolvedValue({
      ok: false,
      error: { code: "23P01", message: "conflicting key value" },
    });
    const tools = createChatTools(deps);

    const result = await tools.createAppointment({
      patientId: PATIENT_ID,
      doctorId: DOCTOR_ID,
      start: "2026-11-03T01:00:00.000Z",
      reason: null,
    });

    expect(result).toEqual({ ok: false, message: "That slot was just booked. Choose another time." });
  });
});
