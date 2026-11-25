// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_FIRST_CONTACT } from "@/lib/chat/routing";
import type { ChatEvent } from "@/lib/chat/schemas";
import {
  BOOKING_OFFER,
  EMERGENCY_NOTICE,
  MEDICAL_ADVICE_DECLINE,
  ROUTING_COPY,
} from "@/lib/chat/safety";
import { IDLE_STATE, type BookingState } from "@/lib/chat/state";
import type { DoctorSummary, Specialty } from "@/lib/directory/types";
import type { GenerateInput } from "@/server/ai/groq";
import { handleTurn, type TurnDeps, type TurnInput } from "@/server/chat/orchestrator";
import type { ChatTools, TimeSlot } from "@/server/chat/tools";

vi.mock("server-only", () => ({}));

const PATIENT_ID = "00000000-0000-4000-8000-000000000201";
const NOW = new Date("2026-10-31T01:00:00Z");

function specialty(suffix: string, name: string, routingHints: string | null): Specialty {
  return {
    id: `00000000-0000-4000-8000-0000000005${suffix}`,
    name,
    description: null,
    routingHints,
    isActive: true,
  };
}

const FAMILY = specialty("a1", "Family Medicine", "General check-ups, unsure where to start");
const INTERNAL = specialty("a2", "Internal Medicine", "Adults with long-term conditions");
const PEDIATRICS = specialty("a3", "Pediatrics", "Patients under 18");
const CARDIOLOGY = specialty("a4", "Cardiology", "Heart concerns: palpitations");
const SPECIALTIES = [FAMILY, INTERNAL, PEDIATRICS, CARDIOLOGY];

function doctor(suffix: string, fullName: string, of: Specialty): DoctorSummary {
  return {
    id: `00000000-0000-4000-8000-0000000000${suffix}`,
    fullName,
    departmentId: null,
    departmentName: null,
    isActive: true,
    specialties: [{ id: of.id, name: of.name }],
  };
}

const DOCTORS = [
  doctor("d1", "Ana Cruz", FAMILY),
  doctor("d2", "Ben Uy", INTERNAL),
  doctor("d3", "Cara Lim", PEDIATRICS),
  doctor("d4", "Dan Tan", CARDIOLOGY),
];
const CARDIOLOGIST = DOCTORS[3];
const SLOT: TimeSlot = { start: "2026-11-03T01:00:00.000Z", end: "2026-11-03T01:30:00.000Z" };

function fakeTools(): ChatTools {
  const doctorsOf = (specialtyId: string) =>
    DOCTORS.filter((entry) => entry.specialties.some((s) => s.id === specialtyId));
  return {
    getDepartments: vi.fn(async () => []),
    getSpecialties: vi.fn(async () => SPECIALTIES),
    getRoutableSpecialties: vi.fn(async () =>
      SPECIALTIES.map((entry) => ({ ...entry, hasActiveDoctors: true })),
    ),
    getDoctorDetails: vi.fn(async () => ({ status: "unknown" as const })),
    getDoctor: vi.fn(async ({ doctorId }: { doctorId: string }) =>
      DOCTORS.find((entry) => entry.id === doctorId) ?? null,
    ),
    getDoctorsBySpecialty: vi.fn(async ({ specialtyId }: { specialtyId: string }) =>
      doctorsOf(specialtyId),
    ),
    getDoctorAvailability: vi.fn(async () => [SLOT]),
    createAppointment: vi.fn(async () => ({ ok: true as const, appointmentId: "appt-1" })),
    getConsultationFee: vi.fn(async () => null),
    getHmoOptions: vi.fn(async () => []),
      isPwdVerified: vi.fn(async () => false),
    createChargedAppointment: vi.fn(async () => ({ ok: false as const, message: "unused" })),
    getBookableServices: vi.fn(async () => []),
    getServiceTimes: vi.fn(async () => ({ walkIn: false, slots: [] })),
    getServiceRequirements: vi.fn(async () => []),
    createServiceBooking: vi.fn(),
    getPatientAppointments: vi.fn(async () => []),
    getPatientAppointment: vi.fn(async () => null),
    requestAppointmentCancellation: vi.fn(async () => ({
      ok: false as const,
      code: "not_found" as const,
      message: "unused",
    })),
  };
}

function deps(extraction: Record<string, unknown>, tools = fakeTools()) {
  const generate = vi
    .fn<(input: GenerateInput) => Promise<string>>()
    .mockResolvedValue(JSON.stringify(extraction));
  const turnDeps: TurnDeps = {
    generate,
    searchKnowledge: vi.fn(async () => ({ found: false as const })),
    tools,
    claimBooking: vi.fn(async () => true),
  };
  return { generate, tools, turnDeps };
}

function turn(event: ChatEvent | string, state: BookingState = IDLE_STATE): TurnInput {
  return {
    conversationId: "00000000-0000-4000-8000-00000000c001",
    patientId: PATIENT_ID,
    history: [],
    event: typeof event === "string" ? { type: "message", text: event } : event,
    state,
    now: NOW,
    bookingHorizonDays: 60,
    firstContact: DEFAULT_FIRST_CONTACT,
  };
}

const PALPITATIONS = {
  intent: "book",
  concern: "Heart pounding sometimes even when sitting",
  specialtyCandidates: ["Cardiology"],
  routingConfidence: "high",
};

describe("need-based specialty routing (AI-APT-002)", () => {
  it("lists the active specialties and their routing hints in the extraction prompt", async () => {
    const { generate, turnDeps } = deps({ intent: "other" });

    await handleTurn(turn("hello"), turnDeps);

    const prompt = generate.mock.calls[0][0].systemPrompt;
    expect(prompt).toContain("Cardiology");
    expect(prompt).toContain("Heart concerns: palpitations");
    expect(prompt).toContain("specialtyCandidates");
  });

  it("routes a described concern straight to doctor cards with a templated reply", async () => {
    const { generate, turnDeps } = deps(PALPITATIONS);

    const result = await handleTurn(turn("Kumakabog dibdib ko minsan kahit nakaupo"), turnDeps);

    expect(result.reply).toBe(ROUTING_COPY.routed("Cardiology"));
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.payload).toEqual({
      kind: "doctor_options",
      doctors: [expect.objectContaining({ id: CARDIOLOGIST.id })],
      changeSpecialty: true,
    });
    expect(result.state).toEqual({
      step: "choosing_doctor",
      draft: { specialtyId: CARDIOLOGY.id, reason: PALPITATIONS.concern },
    });
  });

  it("never copies model text into the routed reply", async () => {
    const { turnDeps } = deps({ ...PALPITATIONS, reason: "You have an arrhythmia" });

    const result = await handleTurn(turn("My heart races"), turnDeps);

    expect(result.reply).toBe(ROUTING_COPY.routed("Cardiology"));
    expect(result.reply).not.toContain("arrhythmia");
  });

  it("gives the emergency notice and no doctor cards when an urgent keyword beats a high routing result", async () => {
    const { tools, turnDeps } = deps(PALPITATIONS);

    const result = await handleTurn(
      turn("I need a cardiologist, I have chest pain and shortness of breath now"),
      turnDeps,
    );

    expect(result.reply).toContain(EMERGENCY_NOTICE);
    expect(result.payload).toBeNull();
    expect(result.state).toBe(IDLE_STATE);
    expect(tools.getDoctorsBySpecialty).not.toHaveBeenCalled();
  });

  it("gives the emergency notice when the model flags a booking message as urgent", async () => {
    const { turnDeps } = deps({ ...PALPITATIONS, urgent: true });

    const result = await handleTurn(turn("Masakit dibdib ko ngayon, hirap huminga"), turnDeps);

    expect(result.reply).toContain(EMERGENCY_NOTICE);
    expect(result.payload).toBeNull();
  });

  it("offers the second candidate as a one-tap alternative", async () => {
    const { turnDeps } = deps({
      ...PALPITATIONS,
      specialtyCandidates: ["Internal Medicine", "Cardiology"],
    });

    const result = await handleTurn(turn("Pa-check up po ako, mataas BP ko lagi"), turnDeps);

    expect(result.reply).toBe(ROUTING_COPY.routed("Internal Medicine"));
    expect(result.payload).toMatchObject({
      kind: "doctor_options",
      alternative: { id: CARDIOLOGY.id, name: "Cardiology" },
    });
  });

  it("sends an unclear concern to the first-contact specialty with its own template", async () => {
    const { turnDeps } = deps({
      intent: "book",
      concern: "Tired all the time",
      routingConfidence: "low",
    });

    const result = await handleTurn(turn("I don't know, I just feel tired all the time"), turnDeps);

    expect(result.reply).toBe(ROUTING_COPY.firstContact("Family Medicine"));
    expect(result.state.draft.specialtyId).toBe(FAMILY.id);
  });

  it("routes a symptom asked as a specialty question instead of listing specialties", async () => {
    const { turnDeps } = deps({
      intent: "doctor_inquiry",
      concern: "Cough",
      specialtyCandidates: ["Family Medicine"],
      routingConfidence: "high",
    });

    const result = await handleTurn(
      turn("i have a cough and i dont know what specialty to pick"),
      turnDeps,
    );

    expect(result.reply).toBe(ROUTING_COPY.routed("Family Medicine"));
    expect(result.payload).toMatchObject({ kind: "doctor_options" });
    expect(result.reply).not.toContain("Departments:");
  });

  it("uses the first-contact specialty for a concern asked as a specialty question with low confidence", async () => {
    const { turnDeps } = deps({
      intent: "doctor_inquiry",
      concern: "Cough",
      routingConfidence: "low",
    });

    const result = await handleTurn(
      turn("i have a cough and i dont know what specialty to pick"),
      turnDeps,
    );

    expect(result.reply).toBe(ROUTING_COPY.firstContact("Family Medicine"));
    expect(result.reply).not.toContain("Departments:");
  });

  it("routes a child to Pediatrics", async () => {
    const { turnDeps } = deps({
      intent: "book",
      concern: "Cough and colds for 3 days",
      age: 4,
      forSomeoneElse: true,
      specialtyCandidates: ["Family Medicine"],
      routingConfidence: "high",
    });

    const result = await handleTurn(turn("Ubo't sipon ng anak ko, 4 years old, 3 days na"), turnDeps);

    expect(result.reply).toBe(ROUTING_COPY.routed("Pediatrics"));
    expect(result.state.draft.specialtyId).toBe(PEDIATRICS.id);
  });

  it("asks the age once when booking for someone else with no age, then falls back", async () => {
    const extraction = {
      intent: "book",
      concern: "Rashes",
      forSomeoneElse: true,
      routingConfidence: "low",
    };
    const first = await handleTurn(turn("Pa-check up ko yung kapatid ko, may rashes"), deps(extraction).turnDeps);

    expect(first.reply).toBe(ROUTING_COPY.askAge);
    expect(first.payload).toMatchObject({ kind: "specialty_options" });

    const second = await handleTurn(turn("hindi ko alam", first.state), deps(extraction).turnDeps);

    expect(second.reply).toBe(ROUTING_COPY.firstContact("Family Medicine"));
  });

  it("lets a named specialty win over routing", async () => {
    const { turnDeps } = deps({
      intent: "book",
      specialtyName: "Cardiology",
      concern: "Check-up",
      specialtyCandidates: ["Family Medicine"],
      routingConfidence: "high",
    });

    const result = await handleTurn(turn("Cardiology please, for a check-up"), turnDeps);

    expect(result.state.draft.specialtyId).toBe(CARDIOLOGY.id);
    expect(result.reply).not.toBe(ROUTING_COPY.routed("Family Medicine"));
  });

  it("asks what the doctor should check when the patient only says they want to book", async () => {
    const { turnDeps } = deps({ intent: "book" });

    const result = await handleTurn(turn("I want to book an appointment"), turnDeps);

    expect(result.reply).toBe(ROUTING_COPY.askConcern);
    expect(result.payload).toMatchObject({ kind: "specialty_options" });
    expect(result.state.step).toBe("choosing_specialty");
  });

  it("shows the specialty chips on Change specialty", async () => {
    const routed = await handleTurn(turn("My heart races"), deps(PALPITATIONS).turnDeps);

    const result = await handleTurn(
      turn({ type: "change_booking", field: "specialty" }, routed.state),
      deps({}).turnDeps,
    );

    expect(result.payload).toEqual({
      kind: "specialty_options",
      specialties: SPECIALTIES.map(({ id, name }) => ({ id, name })),
    });
    expect(result.state.step).toBe("choosing_specialty");
  });

  it("switches to the alternative specialty in one tap", async () => {
    const routed = await handleTurn(
      turn("BP"),
      deps({ ...PALPITATIONS, specialtyCandidates: ["Internal Medicine", "Cardiology"] }).turnDeps,
    );

    const result = await handleTurn(
      turn({ type: "select_specialty", specialtyId: CARDIOLOGY.id }, routed.state),
      deps({}).turnDeps,
    );

    expect(result.state).toMatchObject({
      step: "choosing_doctor",
      draft: { specialtyId: CARDIOLOGY.id },
    });
  });

  it("carries the concern into the summary as the reason for visit, editable before Confirm", async () => {
    const routed = await handleTurn(turn("My heart races"), deps(PALPITATIONS).turnDeps);
    const doctorChosen = await handleTurn(
      turn({ type: "select_doctor", doctorId: CARDIOLOGIST.id }, routed.state),
      deps({}).turnDeps,
    );
    const summary = await handleTurn(
      turn({ type: "select_slot", start: SLOT.start }, doctorChosen.state),
      deps({}).turnDeps,
    );

    expect(summary.payload).toMatchObject({ kind: "booking_summary", reason: PALPITATIONS.concern });

    const edited = await handleTurn(
      turn({ type: "update_reason", reason: "  Follow-up for palpitations  " }, summary.state),
      deps({}).turnDeps,
    );

    expect(edited.payload).toMatchObject({
      kind: "booking_summary",
      reason: "Follow-up for palpitations",
    });
    expect(edited.state).toMatchObject({
      step: "awaiting_confirmation",
      draft: { reason: "Follow-up for palpitations", slotStart: SLOT.start },
    });
  });

  it("refuses a reason edit outside the summary step", async () => {
    const routed = await handleTurn(turn("My heart races"), deps(PALPITATIONS).turnDeps);

    const result = await handleTurn(
      turn({ type: "update_reason", reason: "x" }, routed.state),
      deps({}).turnDeps,
    );

    expect(result.state).toBe(routed.state);
  });

  it("declines medical advice, offers to book, and routes on Yes without another model call", async () => {
    const { turnDeps } = deps({
      intent: "medical_advice",
      concern: "Heart pounding",
      specialtyCandidates: ["Cardiology"],
      routingConfidence: "high",
    });

    const declined = await handleTurn(turn("Why does my heart pound? What should I take?"), turnDeps);

    expect(declined.reply).toBe(`${MEDICAL_ADVICE_DECLINE} ${BOOKING_OFFER}`);
    expect(declined.payload).toEqual({ kind: "book_offer" });
    expect(declined.state.step).toBe("offering_booking");

    const accepted = deps({});
    const result = await handleTurn(
      turn({ type: "accept_booking_offer" }, declined.state),
      accepted.turnDeps,
    );

    expect(accepted.generate).not.toHaveBeenCalled();
    expect(result.reply).toBe(ROUTING_COPY.routed("Cardiology"));
    expect(result.state.draft).toMatchObject({
      specialtyId: CARDIOLOGY.id,
      reason: "Heart pounding",
    });
  });
});
