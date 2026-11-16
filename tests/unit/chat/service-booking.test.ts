// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { EMERGENCY_NOTICE } from "@/lib/chat/safety";
import { PAYMENT_COPY, paymentRequestCopy } from "@/lib/chat/payment";
import { DEFAULT_FIRST_CONTACT } from "@/lib/chat/routing";
import type { ChatEvent } from "@/lib/chat/schemas";
import { SERVICE_COPY } from "@/lib/chat/services";
import type { BookingState } from "@/lib/chat/state";
import type { Specialty } from "@/lib/directory/types";
import type { BookableService } from "@/lib/services/booking";
import type { GenerateInput } from "@/server/ai/groq";
import { extractionSystemPrompt, handleTurn, type TurnDeps, type TurnInput } from "@/server/chat/orchestrator";
import type { ChatTools } from "@/server/chat/tools";

vi.mock("server-only", () => ({}));

/**
 * PAY-07: lab tests (multi-select), imaging slots, and packages booked and
 * paid in chat. Services, times, requirements, and prices come only from the
 * tools (the database); the model only names candidate services.
 */

const PATIENT_ID = "00000000-0000-4000-8000-000000000201";
// Saturday 2026-10-31, 09:00 in Manila.
const NOW = new Date("2026-10-31T01:00:00Z");

const FAMILY: Specialty = {
  id: "00000000-0000-4000-8000-0000000005a2",
  name: "Family Medicine",
  description: null,
  routingHints: null,
  isActive: true,
};

function service(overrides: Partial<BookableService> & Pick<BookableService, "id" | "name">): BookableService {
  return {
    category: "laboratory",
    bookingMode: "walk_in",
    priceCentavos: 25000,
    vatable: false,
    philhealthBenefitCentavos: 0,
    hmoCoverable: true,
    requiresDoctorRequest: false,
    dailyCapacity: 60,
    ...overrides,
  };
}

const CBC = service({
  id: "00000000-0000-4000-8000-0000000c0001",
  name: "CBC with platelet count",
  requiresDoctorRequest: true,
});
const URINALYSIS = service({ id: "00000000-0000-4000-8000-0000000c0002", name: "Urinalysis", priceCentavos: 12000 });
const ULTRASOUND = service({
  id: "00000000-0000-4000-8000-0000000c0003",
  name: "Whole abdomen ultrasound",
  category: "imaging",
  bookingMode: "scheduled",
  priceCentavos: 150000,
  philhealthBenefitCentavos: 50000,
  dailyCapacity: null,
});
const PACKAGE = service({
  id: "00000000-0000-4000-8000-0000000c0004",
  name: "Basic Health Check",
  category: "package",
  priceCentavos: 110000,
  hmoCoverable: false,
});

// Tuesday 2026-11-03: the lab opens at 07:00 Manila; an ultrasound slot at 09:00.
const WALK_IN = { start: "2026-11-02T23:00:00.000Z", end: "2026-11-03T04:00:00.000Z" };
const US_SLOT = { start: "2026-11-03T01:00:00.000Z", end: "2026-11-03T01:30:00.000Z" };
const MAXICARE = { id: "00000000-0000-4000-8000-00000000a0a1", name: "Maxicare", copayCentavos: 0 };

function fakeTools(services: BookableService[] = [CBC, URINALYSIS, ULTRASOUND, PACKAGE]): ChatTools {
  return {
    getDepartments: vi.fn(async () => []),
    getSpecialties: vi.fn(async () => [FAMILY]),
    getRoutableSpecialties: vi.fn(async () => [{ ...FAMILY, hasActiveDoctors: true }]),
    getDoctorDetails: vi.fn(async () => ({ status: "unknown" as const })),
    getDoctor: vi.fn(async () => null),
    getDoctorsBySpecialty: vi.fn(async () => []),
    getDoctorAvailability: vi.fn(async () => []),
    createAppointment: vi.fn(),
    getConsultationFee: vi.fn(async () => 50000),
    getActiveHmoProviders: vi.fn(async () => [MAXICARE]),
    createChargedAppointment: vi.fn(),
    getBookableServices: vi.fn(async () => services),
    getServiceTimes: vi.fn(async ({ serviceIds }: { serviceIds: string[] }) =>
      serviceIds[0] === ULTRASOUND.id
        ? { walkIn: false, slots: [US_SLOT] }
        : { walkIn: true, slots: [WALK_IN] },
    ),
    getServiceRequirements: vi.fn(async () => [
      { serviceId: URINALYSIS.id, title: "Clean-catch midstream sample", description: null },
    ]),
    createServiceBooking: vi.fn(async () => ({
      ok: true as const,
      appointmentId: "appt-9",
      payment: {
        id: "pay-9",
        method: "qr_ph" as const,
        status: "awaiting_payment" as const,
        amountDueCentavos: 29600,
        referenceCode: "CC-7F3K2",
        deadline: "2026-10-31T03:00:00.000Z",
      },
    })),
    getPatientAppointments: vi.fn(async () => []),
    getPatientAppointment: vi.fn(async () => null),
    requestAppointmentCancellation: vi.fn(),
  };
}

function deps(tools: ChatTools = fakeTools(), extraction?: object): TurnDeps {
  return {
    generate: vi.fn<(input: GenerateInput) => Promise<string>>(async () => JSON.stringify(extraction ?? {})),
    searchKnowledge: vi.fn(async () => ({ found: false as const })),
    tools,
    claimBooking: vi.fn(async () => true),
  };
}

function turn(event: ChatEvent, state: BookingState, paymentEnabled = true): TurnInput {
  return {
    conversationId: "00000000-0000-4000-8000-00000000c001",
    patientId: PATIENT_ID,
    history: [],
    event,
    state,
    now: NOW,
    bookingHorizonDays: 60,
    firstContact: DEFAULT_FIRST_CONTACT,
    paymentEnabled,
  };
}

const IDLE: BookingState = { step: "idle", draft: {} };
const message = (text: string): ChatEvent => ({ type: "message", text });

describe("what kind of booking", () => {
  it("offers lab tests, imaging, and packages next to the specialties when payment is on", async () => {
    const result = await handleTurn(turn(message("I want to book"), IDLE), deps(fakeTools(), { intent: "book" }));
    expect(result.reply).toBe(SERVICE_COPY.askConcernOrService);
    expect(result.payload).toEqual({
      kind: "specialty_options",
      specialties: [{ id: FAMILY.id, name: FAMILY.name }],
      serviceKinds: ["lab", "diagnostics", "package"],
    });
  });

  it("offers only consultations when payment is off", async () => {
    const result = await handleTurn(
      turn(message("I want to book"), IDLE, false),
      deps(fakeTools(), { intent: "book" }),
    );
    expect(result.payload).not.toHaveProperty("serviceKinds");
  });

  it("lists the lab tests as a multi-select", async () => {
    const result = await handleTurn(
      turn({ type: "select_service_kind", serviceKind: "lab" }, { step: "choosing_specialty", draft: {} }),
      deps(),
    );
    expect(result.reply).toBe(SERVICE_COPY.chooseServices.lab);
    expect(result.payload).toEqual({
      kind: "service_options",
      multiple: true,
      services: [
        { id: CBC.id, name: CBC.name, requiresDoctorRequest: true },
        { id: URINALYSIS.id, name: URINALYSIS.name, requiresDoctorRequest: false },
      ],
    });
    expect(result.state).toEqual({ step: "choosing_services", draft: {} });
  });
});

describe("lab tests: CBC + urinalysis, PWD, pay by QR", () => {
  const PICKED: BookingState = {
    step: "choosing_slot",
    draft: { serviceIds: [CBC.id, URINALYSIS.id] },
  };
  const DATED = { serviceIds: [CBC.id, URINALYSIS.id], slotStart: WALK_IN.start };

  it("offers walk-in dates for both tests", async () => {
    const tools = fakeTools();
    const result = await handleTurn(
      turn({ type: "select_services", serviceIds: [CBC.id, URINALYSIS.id] }, { step: "choosing_services", draft: {} }),
      deps(tools),
    );
    expect(result.state).toEqual(PICKED);
    expect(result.payload).toMatchObject({
      kind: "slot_picker",
      walkIn: true,
      days: [{ date: "2026-11-03", slots: [WALK_IN] }],
    });
    expect(tools.getServiceTimes).toHaveBeenCalledWith(
      expect.objectContaining({ serviceIds: [CBC.id, URINALYSIS.id], fromDate: "2026-10-31" }),
    );
  });

  it("shows the published requirements before the discount and payment questions", async () => {
    const result = await handleTurn(turn({ type: "select_slot", start: WALK_IN.start }, PICKED), deps());
    expect(result.reply).toBe(`${SERVICE_COPY.requirementsLead} ${PAYMENT_COPY.privilegeQuestion}`);
    expect(result.payload).toEqual({
      kind: "privilege_options",
      requirements: [
        { serviceName: CBC.name, title: SERVICE_COPY.doctorRequest, description: null },
        { serviceName: URINALYSIS.name, title: "Clean-catch midstream sample", description: null },
      ],
    });
    expect(result.state).toEqual({ step: "choosing_privilege", draft: DATED });
  });

  it("does not offer PhilHealth when no test has a benefit", async () => {
    const result = await handleTurn(
      turn({ type: "select_privilege", privilege: "pwd" }, { step: "choosing_privilege", draft: DATED }),
      deps(),
    );
    expect(result.payload).toEqual({
      kind: "payer_options",
      philhealth: false,
      hmoProviders: [{ id: MAXICARE.id, name: MAXICARE.name }],
    });
  });

  it("shows one summary with both tests and the PWD breakdown", async () => {
    const result = await handleTurn(
      turn(
        { type: "select_payer", payment: { payer: "self", method: "qr_ph" } },
        { step: "choosing_payer", draft: { ...DATED, privilege: "pwd" } },
      ),
      deps(),
    );
    expect(result.state.step).toBe("awaiting_confirmation");
    expect(result.payload).toMatchObject({
      kind: "booking_summary",
      services: [CBC.name, URINALYSIS.name],
      walkIn: true,
      start: WALK_IN.start,
      charge: { baseCentavos: 37000, privilegeDiscountCentavos: 7400, amountDueCentavos: 29600 },
    });
  });

  it("books one visit with both tests and the payment in one call", async () => {
    const tools = fakeTools();
    const result = await handleTurn(
      turn(
        { type: "confirm_booking" },
        {
          step: "awaiting_confirmation",
          draft: { ...DATED, privilege: "pwd", payment: { payer: "self", method: "qr_ph" } },
        },
      ),
      deps(tools),
    );
    expect(tools.createServiceBooking).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      serviceIds: [CBC.id, URINALYSIS.id],
      visitDate: "2026-11-03",
      start: null,
      reason: null,
      privilege: "pwd",
      payment: { payer: "self", method: "qr_ph" },
      expectedAmountDueCentavos: 29600,
    });
    expect(tools.createAppointment).not.toHaveBeenCalled();
    expect(tools.createChargedAppointment).not.toHaveBeenCalled();
    expect(result.reply).toBe(
      paymentRequestCopy({
        amountDueCentavos: 29600,
        referenceCode: "CC-7F3K2",
        deadline: "2026-10-31T03:00:00.000Z",
        method: "qr_ph",
        now: NOW,
      }),
    );
    expect(result.payload).toMatchObject({ kind: "booking_result", services: [CBC.name, URINALYSIS.name] });
    expect(result.state.step).toBe("booked");
  });

  it("refuses a lab test together with an ultrasound", async () => {
    const tools = fakeTools();
    const result = await handleTurn(
      turn({ type: "select_services", serviceIds: [CBC.id, ULTRASOUND.id] }, { step: "choosing_services", draft: {} }),
      deps(tools),
    );
    expect(result.reply).toContain(SERVICE_COPY.invalidCombination);
    expect(result.state.step).toBe("choosing_services");
    expect(tools.getServiceTimes).not.toHaveBeenCalled();
  });

  it("ignores a service ID that is not bookable", async () => {
    const result = await handleTurn(
      turn(
        { type: "select_services", serviceIds: ["00000000-0000-4000-8000-0000000c00ff"] },
        { step: "choosing_services", draft: {} },
      ),
      deps(),
    );
    expect(result.state.step).toBe("choosing_services");
    expect(result.payload).toMatchObject({ kind: "service_options" });
  });
});

describe("imaging: an ultrasound slot", () => {
  const SLOTTED = { serviceIds: [ULTRASOUND.id], slotStart: US_SLOT.start };

  it("offers the service's own slots", async () => {
    const result = await handleTurn(
      turn({ type: "select_services", serviceIds: [ULTRASOUND.id] }, { step: "choosing_services", draft: {} }),
      deps(),
    );
    expect(result.payload).toMatchObject({ kind: "slot_picker", walkIn: false, days: [{ slots: [US_SLOT] }] });
  });

  it("offers PhilHealth because the ultrasound has a benefit", async () => {
    const result = await handleTurn(
      turn({ type: "select_privilege", privilege: "senior" }, { step: "choosing_privilege", draft: SLOTTED }),
      deps(),
    );
    expect(result.payload).toMatchObject({ kind: "payer_options", philhealth: true });
  });

  it("books the slot start, not a date", async () => {
    const tools = fakeTools();
    await handleTurn(
      turn(
        { type: "confirm_booking" },
        {
          step: "awaiting_confirmation",
          draft: { ...SLOTTED, privilege: "senior", payment: { payer: "philhealth" } },
        },
      ),
      deps(tools),
    );
    expect(tools.createServiceBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceIds: [ULTRASOUND.id],
        visitDate: null,
        start: US_SLOT.start,
        // ₱1,500 − 20% (₱300) − PhilHealth ₱500.
        expectedAmountDueCentavos: 70000,
      }),
    );
  });

  it("re-offers times when the slot is gone", async () => {
    const tools = fakeTools();
    vi.mocked(tools.getServiceTimes).mockResolvedValue({ walkIn: false, slots: [] });
    const result = await handleTurn(
      turn({ type: "select_slot", start: US_SLOT.start }, { step: "choosing_slot", draft: { serviceIds: [ULTRASOUND.id] } }),
      deps(tools),
    );
    expect(result.state.step).toBe("choosing_slot");
    expect(result.payload).toMatchObject({ kind: "slot_picker" });
  });
});

describe("packages", () => {
  it("does not offer an HMO for a package no HMO covers", async () => {
    const result = await handleTurn(
      turn(
        { type: "select_privilege", privilege: "none" },
        { step: "choosing_privilege", draft: { serviceIds: [PACKAGE.id], slotStart: WALK_IN.start } },
      ),
      deps(),
    );
    expect(result.payload).toEqual({ kind: "payer_options", philhealth: false, hmoProviders: [] });
  });
});

describe("serviceCandidates routing (AI-APT-002 + PAY-001)", () => {
  it("routes 'Need ko magpa-CBC' straight to the CBC dates", async () => {
    const tools = fakeTools();
    const result = await handleTurn(
      turn(message("Need ko magpa-CBC, may request na ako"), IDLE),
      deps(tools, { intent: "book", serviceCandidates: ["CBC"], routingConfidence: "high" }),
    );
    expect(result.state).toEqual({ step: "choosing_slot", draft: { serviceIds: [CBC.id] } });
    expect(result.payload).toMatchObject({ kind: "slot_picker", walkIn: true });
    expect(tools.getRoutableSpecialties).not.toHaveBeenCalled();
  });

  it("never books an invented service; it falls back to concern routing", async () => {
    const tools = fakeTools();
    const result = await handleTurn(
      turn(message("I need an MRI"), IDLE),
      deps(tools, { intent: "book", serviceCandidates: ["MRI"], concern: "MRI" }),
    );
    expect(result.state.draft.serviceIds).toBeUndefined();
    expect(tools.getServiceTimes).not.toHaveBeenCalled();
  });

  it("sends the patient to the front desk when payment is off", async () => {
    const tools = fakeTools();
    const result = await handleTurn(
      turn(message("Need ko magpa-CBC"), IDLE, false),
      deps(tools, { intent: "book", serviceCandidates: ["CBC"] }),
    );
    expect(result.reply).toBe(SERVICE_COPY.paymentOff);
    expect(tools.getServiceTimes).not.toHaveBeenCalled();
  });

  it("keeps the emergency notice first", async () => {
    const tools = fakeTools();
    const result = await handleTurn(
      turn(message("chest pain now, need CBC"), IDLE),
      deps(tools, { intent: "book", serviceCandidates: ["CBC"] }),
    );
    expect(result.reply).toContain(EMERGENCY_NOTICE);
    expect(result.payload).toBeNull();
    expect(tools.getServiceTimes).not.toHaveBeenCalled();
  });

  it("lists bookable service names, never prices, in the extraction prompt", () => {
    const prompt = extractionSystemPrompt(NOW, [FAMILY], [CBC.name, ULTRASOUND.name]);
    expect(prompt).toContain('"serviceCandidates"');
    expect(prompt).toContain(`- ${CBC.name}`);
    expect(prompt).not.toMatch(/₱|centavo|price/i);
  });
});
