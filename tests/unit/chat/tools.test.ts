// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { Department, DoctorSummary, Specialty } from "@/lib/directory/types";
import type { PatientAppointment } from "@/lib/appointments/types";
import type {
  AppointmentBooker,
  PatientAppointmentsStore,
} from "@/server/appointments/service";
import type { AvailabilitySource } from "@/server/availability/service";
import { createChatTools, type ChatToolDeps } from "@/server/chat/tools";
import type { DirectoryStore } from "@/server/directory/service";
import type { ChargeStore } from "@/server/payments/service";
import type { ServiceBookingStore } from "@/server/service-booking/service";

vi.mock("server-only", () => ({}));

const DEPARTMENTS: Department[] = [
  { id: "dep1", name: "Cardiology", code: "CARD", description: null, isActive: true },
  { id: "dep2", name: "Closed Wing", code: "CLSD", description: null, isActive: false },
];
const SPECIALTIES: Specialty[] = [
  { id: "sp1", name: "Interventional Cardiology", description: null, routingHints: null, isActive: true },
  { id: "sp2", name: "Retired Specialty", description: null, routingHints: null, isActive: false },
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

const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000301";

function patientAppointment(overrides: Partial<PatientAppointment>): PatientAppointment {
  return {
    id: APPOINTMENT_ID,
    doctorName: "Dr. Maya Santos",
    departmentName: "Cardiology",
    reason: null,
    scheduledAt: "2026-11-03T01:00:00.000Z",
    durationMinutes: 30,
    status: "requested",
    ...overrides,
  };
}

function fakePatientAppointments(): PatientAppointmentsStore {
  return {
    listForPatient: vi.fn(async () => [
      patientAppointment({ id: "later", scheduledAt: "2026-11-05T01:00:00.000Z" }),
      patientAppointment({ id: "past", scheduledAt: "2026-10-20T01:00:00.000Z" }),
      patientAppointment({ id: "done", status: "cancelled" }),
      patientAppointment({ id: "sooner", status: "confirmed" }),
    ]),
    getForPatient: vi.fn(async () => ({
      id: APPOINTMENT_ID,
      doctorName: "Dr. Maya Santos",
      scheduledAt: "2026-11-03T01:00:00.000Z",
      status: "requested" as const,
    })),
    cancelForPatient: vi.fn(async () => true),
    insertHistory: vi.fn(async () => undefined),
  };
}

function toolDeps(
  store: DirectoryStore = fakeStore(),
  patientAppointments: PatientAppointmentsStore = fakePatientAppointments(),
): ChatToolDeps {
  return {
    directory: store,
    availability: fakeAvailability(),
    booker: fakeBooker(),
    patientAppointments,
    charges: fakeCharges(),
    services: fakeServices(),
    now: () => NOW,
    minLeadHours: async () => 0,
  };
}

const CBC_ID = "00000000-0000-4000-8000-0000000c0001";

function fakeServices(): ServiceBookingStore {
  return {
    listBookableServices: vi.fn(async () => [
      {
        id: CBC_ID,
        name: "CBC with platelet count",
        category: "laboratory" as const,
        bookingMode: "walk_in" as const,
        priceCentavos: 25000,
        vatable: false,
        philhealthBenefitCentavos: 0,
        hmoCoverable: true,
        requiresDoctorRequest: true,
        dailyCapacity: null,
      },
    ]),
    // Saturday hours, 09:00–12:00 Manila.
    listPeriods: vi.fn(async () => [
      {
        serviceId: CBC_ID,
        dayOfWeek: 6,
        startTime: "09:00",
        endTime: "12:00",
        slotMinutes: 60,
        capacityPerSlot: 1,
        effectiveFrom: "2026-01-01",
        effectiveUntil: null,
        isActive: true,
      },
    ]),
    listHolidays: vi.fn(async () => []),
    getLoad: vi.fn(async () => []),
    listRequirements: vi.fn(async () => []),
    bookService: vi.fn(),
  };
}

function fakeCharges(): ChargeStore {
  return {
    getConsultationFee: vi.fn(async () => 70000),
    listHmoOptions: vi.fn(async () => [
      {
        patientHmoId: "00000000-0000-4000-8000-00000000b0b1",
        providerId: "00000000-0000-4000-8000-00000000a0a1",
        name: "Maxicare",
        copayCentavos: 0,
        maskedNumber: "••••4417",
        offer: { kind: "offered" as const },
      },
    ]),
    bookWithCharge: vi.fn(async () => ({
      ok: true as const,
      appointmentId: "a1",
      payment: {
        status: "awaiting_payment" as const,
        amountDueCentavos: 56000,
        referenceCode: "CC-7F3K2",
        deadline: "2026-10-31T03:00:00.000Z",
      },
    })),
  };
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

  it("marks which active specialties have an active doctor, for routing (AI-APT-002)", async () => {
    const store = fakeStore();
    const lonely: Specialty = {
      id: "sp3",
      name: "No Doctors Yet",
      description: null,
      routingHints: "Hints",
      isActive: true,
    };
    vi.mocked(store.listSpecialties).mockResolvedValue([...SPECIALTIES, lonely]);
    const tools = createChatTools(toolDeps(store));

    expect(await tools.getRoutableSpecialties()).toEqual([
      { ...SPECIALTIES[0], hasActiveDoctors: true },
      { ...lonely, hasActiveDoctors: false },
    ]);
    expect(store.listDoctors).toHaveBeenCalledWith(expect.objectContaining({ activeOnly: true }));
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

  it("offers only slots at least the admin's lead hours away (appointment.min_lead_hours)", async () => {
    // 06:45 Manila on Tuesday 2026-11-03; with 2 lead hours the first slot is after 08:45.
    const deps = { ...toolDeps(), now: () => new Date("2026-11-02T22:45:00Z"), minLeadHours: async () => 2 };
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
      fromDate: "2026-11-03",
      days: 1,
    });

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

  it("books as an AI request created by the patient from the caller", async () => {
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
      bookingSource: "ai_chatbot",
      createdByProfileId: PATIENT_ID,
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

  it("returns the booking-cap message when the patient is at the upcoming-appointment cap", async () => {
    const deps = toolDeps();
    vi.mocked(deps.booker.book).mockResolvedValue({
      ok: false,
      error: { code: "P0001", message: "too_many_upcoming" },
    });
    const tools = createChatTools(deps);

    const result = await tools.createAppointment({
      patientId: PATIENT_ID,
      doctorId: DOCTOR_ID,
      start: "2026-11-03T01:00:00.000Z",
      reason: null,
    });

    expect(result).toEqual({
      ok: false,
      message:
        "You already have the maximum number of upcoming appointments. Cancel one first, or call the front desk to book another.",
    });
  });
});

describe("chat payment tools (PAY-03)", () => {
  it("reads the consultation fee for the doctor and specialty", async () => {
    const deps = toolDeps();
    const tools = createChatTools(deps);

    await expect(
      tools.getConsultationFee({ doctorId: DOCTOR_ID, specialtyId: SPECIALTY_ID }),
    ).resolves.toBe(70000);
    expect(deps.charges.getConsultationFee).toHaveBeenCalledWith({
      doctorId: DOCTOR_ID,
      specialtyId: SPECIALTY_ID,
    });
  });

  it("books with a charge for the patient from the caller", async () => {
    const deps = toolDeps();
    const tools = createChatTools(deps);
    const input = {
      patientId: PATIENT_ID,
      doctorId: DOCTOR_ID,
      specialtyId: SPECIALTY_ID,
      start: "2026-11-03T01:00:00.000Z",
      reason: null,
      privilege: "senior" as const,
      payment: { payer: "self" as const, method: "qr_ph" as const },
      expectedAmountDueCentavos: 56000,
    };

    const result = await tools.createChargedAppointment(input);

    expect(result).toMatchObject({ ok: true, payment: { referenceCode: "CC-7F3K2" } });
    expect(deps.charges.bookWithCharge).toHaveBeenCalledWith(input);
  });

  it("rejects a malformed charged booking before the database", async () => {
    const deps = toolDeps();
    const tools = createChatTools(deps);

    await expect(
      tools.createChargedAppointment({
        patientId: PATIENT_ID,
        doctorId: DOCTOR_ID,
        specialtyId: SPECIALTY_ID,
        start: "2026-11-03T01:00:00.000Z",
        reason: null,
        privilege: "none",
        payment: { payer: "self", method: "qr_ph" },
        expectedAmountDueCentavos: -1,
      }),
    ).rejects.toThrow();
    expect(deps.charges.bookWithCharge).not.toHaveBeenCalled();
  });
});

describe("chat patient appointment tools", () => {
  it("returns only the patient's upcoming requested or confirmed appointments, soonest first", async () => {
    const store = fakePatientAppointments();
    const tools = createChatTools(toolDeps(fakeStore(), store));

    const appointments = await tools.getPatientAppointments({ patientId: PATIENT_ID });

    expect(store.listForPatient).toHaveBeenCalledWith(PATIENT_ID);
    expect(appointments.map((appointment) => appointment.id)).toEqual(["sooner", "later"]);
  });

  it("reads one appointment scoped by the patient ID", async () => {
    const store = fakePatientAppointments();
    const tools = createChatTools(toolDeps(fakeStore(), store));

    const appointment = await tools.getPatientAppointment({
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
    });

    expect(appointment?.doctorName).toBe("Dr. Maya Santos");
    expect(store.getForPatient).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
    });
  });

  it("cancels through the guarded patient cancel", async () => {
    const store = fakePatientAppointments();
    const tools = createChatTools(toolDeps(fakeStore(), store));

    const result = await tools.requestAppointmentCancellation({
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
    });

    expect(result.ok).toBe(true);
    expect(store.cancelForPatient).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
      from: ["requested", "confirmed"],
    });
  });

  it("rejects malformed IDs before touching the database", async () => {
    const store = fakePatientAppointments();
    const tools = createChatTools(toolDeps(fakeStore(), store));

    await expect(
      tools.requestAppointmentCancellation({ patientId: PATIENT_ID, appointmentId: "nope" }),
    ).rejects.toThrow();
    await expect(tools.getPatientAppointments({ patientId: "nope" })).rejects.toThrow();
    expect(store.cancelForPatient).not.toHaveBeenCalled();
    expect(store.listForPatient).not.toHaveBeenCalled();
  });

  it("offers service times only for bookable services, after the minimum lead time (PAY-07)", async () => {
    const deps = toolDeps();
    // 09:00 Manila now; the lab opens at 09:00 today and next Saturday.
    const tools = createChatTools({ ...deps, minLeadHours: async () => 1 });

    const times = await tools.getServiceTimes({ serviceIds: [CBC_ID], fromDate: "2026-10-31", days: 8 });
    expect(times).toEqual({
      walkIn: true,
      slots: [{ start: "2026-11-07T01:00:00.000Z", end: "2026-11-07T04:00:00.000Z" }],
    });
    await expect(
      tools.getServiceTimes({ serviceIds: [APPOINTMENT_ID], fromDate: "2026-10-31", days: 1 }),
    ).resolves.toEqual({ walkIn: false, slots: [] });
  });

  it("refuses a malformed service booking before touching the database (PAY-07)", async () => {
    const deps = toolDeps();
    const tools = createChatTools(deps);
    await expect(
      tools.createServiceBooking({
        patientId: PATIENT_ID,
        serviceIds: [],
        visitDate: null,
        start: null,
        reason: null,
        privilege: "none",
        payment: { payer: "self", method: "qr_ph" },
        expectedAmountDueCentavos: 0,
      }),
    ).rejects.toThrow();
    expect(deps.services.bookService).not.toHaveBeenCalled();
  });
});
