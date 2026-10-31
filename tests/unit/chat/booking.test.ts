// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { formatManilaShortDate, formatManilaTime } from "@/lib/appointments/format";
import { BOOKING_COPY } from "@/lib/chat/booking";
import { matchDoctorsByName } from "@/lib/chat/resolve";
import type { ChatEvent } from "@/lib/chat/schemas";
import { IDLE_STATE, type BookingState } from "@/lib/chat/state";
import type { DoctorSummary, Specialty } from "@/lib/directory/types";
import type { GenerateInput } from "@/server/ai/opencode-zen";
import { handleTurn, type TurnDeps, type TurnInput } from "@/server/chat/orchestrator";
import type { ChatTools, TimeSlot } from "@/server/chat/tools";

vi.mock("server-only", () => ({}));

const CONVERSATION_ID = "00000000-0000-4000-8000-00000000c001";
const PATIENT_ID = "00000000-0000-4000-8000-000000000201";
// Saturday 2026-10-31, 09:00 in Manila.
const NOW = new Date("2026-10-31T01:00:00Z");

const CARDIOLOGY: Specialty = {
  id: "00000000-0000-4000-8000-0000000005a1",
  name: "Cardiology",
  description: null,
  isActive: true,
};
const PEDIATRICS: Specialty = {
  id: "00000000-0000-4000-8000-0000000005a2",
  name: "General Pediatrics",
  description: null,
  isActive: true,
};

const MAYA: DoctorSummary = {
  id: "00000000-0000-4000-8000-0000000000d1",
  fullName: "Maya Santos",
  departmentId: "dep1",
  departmentName: "Heart Center",
  isActive: true,
  specialties: [{ id: CARDIOLOGY.id, name: CARDIOLOGY.name }],
};
const JOSE: DoctorSummary = {
  id: "00000000-0000-4000-8000-0000000000d2",
  fullName: "José Santos",
  departmentId: "dep1",
  departmentName: "Heart Center",
  isActive: true,
  specialties: [
    { id: CARDIOLOGY.id, name: CARDIOLOGY.name },
    { id: PEDIATRICS.id, name: PEDIATRICS.name },
  ],
};
const LIM: DoctorSummary = {
  id: "00000000-0000-4000-8000-0000000000d3",
  fullName: "Ana Lim",
  departmentId: "dep2",
  departmentName: "Children's Clinic",
  isActive: true,
  specialties: [{ id: PEDIATRICS.id, name: PEDIATRICS.name }],
};
const DOCTORS = [MAYA, JOSE, LIM];

// Tuesday 3 Nov 09:00 and 09:30, Wednesday 4 Nov 10:00 (Manila).
const MAYA_SLOTS: TimeSlot[] = [
  { start: "2026-11-03T01:00:00.000Z", end: "2026-11-03T01:30:00.000Z" },
  { start: "2026-11-03T01:30:00.000Z", end: "2026-11-03T02:00:00.000Z" },
  { start: "2026-11-04T02:00:00.000Z", end: "2026-11-04T02:30:00.000Z" },
];
const SELECTED = MAYA_SLOTS[0];

function fakeTools(slots: Record<string, TimeSlot[]> = { [MAYA.id]: MAYA_SLOTS }): ChatTools {
  return {
    getDepartments: vi.fn(async () => []),
    getSpecialties: vi.fn(async () => [CARDIOLOGY, PEDIATRICS]),
    getDoctorDetails: vi.fn(async ({ doctorName }: { doctorName: string }) => {
      const matches = matchDoctorsByName(doctorName, DOCTORS);
      if (matches.length === 0) return { status: "unknown" as const };
      if (matches.length === 1) return { status: "found" as const, doctor: matches[0] };
      return { status: "several" as const, doctors: matches };
    }),
    getDoctor: vi.fn(async ({ doctorId }: { doctorId: string }) =>
      DOCTORS.find((doctor) => doctor.id === doctorId) ?? null,
    ),
    getDoctorsBySpecialty: vi.fn(async ({ specialtyId }: { specialtyId: string }) =>
      DOCTORS.filter((doctor) => doctor.specialties.some((entry) => entry.id === specialtyId)),
    ),
    getDoctorAvailability: vi.fn(async ({ doctorId }: { doctorId: string }) => slots[doctorId] ?? []),
    createAppointment: vi.fn(async () => ({ ok: true as const, appointmentId: "appt-1" })),
  };
}

function bookingDeps(
  extraction: Record<string, unknown> = { intent: "book" },
  overrides: Partial<TurnDeps> = {},
): TurnDeps {
  return {
    generate: vi
      .fn<(input: GenerateInput) => Promise<string>>()
      .mockResolvedValue(JSON.stringify(extraction)),
    searchKnowledge: vi.fn(async () => ({ found: false as const })),
    tools: fakeTools(),
    claimBooking: vi.fn(async () => true),
    ...overrides,
  };
}

function turnWith(event: ChatEvent, state: BookingState = IDLE_STATE): TurnInput {
  return { conversationId: CONVERSATION_ID, patientId: PATIENT_ID, history: [], event, state, now: NOW };
}

function message(text: string, state?: BookingState): TurnInput {
  return turnWith({ type: "message", text }, state);
}

const CHOOSING_MAYA_SLOT: BookingState = {
  step: "choosing_slot",
  draft: { specialtyId: CARDIOLOGY.id, doctorId: MAYA.id },
};
const AWAITING_CONFIRMATION: BookingState = {
  step: "awaiting_confirmation",
  draft: { specialtyId: CARDIOLOGY.id, doctorId: MAYA.id, slotStart: SELECTED.start },
};

describe("booking Path A (by specialty)", () => {
  it("asks for a specialty from the database when none was given", async () => {
    const result = await handleTurn(message("I want to book an appointment"), bookingDeps());

    expect(result.state).toEqual({ step: "choosing_specialty", draft: {} });
    expect(result.payload).toEqual({
      kind: "specialty_options",
      specialties: [
        { id: CARDIOLOGY.id, name: "Cardiology" },
        { id: PEDIATRICS.id, name: "General Pediatrics" },
      ],
    });
  });

  it("offers the specialty's active doctors as cards", async () => {
    const deps = bookingDeps({ intent: "book", specialtyName: "cardiology" });

    const result = await handleTurn(message("Book me with a cardiologist"), deps);

    expect(deps.tools.getDoctorsBySpecialty).toHaveBeenCalledWith({ specialtyId: CARDIOLOGY.id });
    expect(result.state).toEqual({ step: "choosing_doctor", draft: { specialtyId: CARDIOLOGY.id } });
    expect(result.payload).toEqual({
      kind: "doctor_options",
      doctors: [
        {
          id: MAYA.id,
          name: "Dr. Maya Santos",
          departmentName: "Heart Center",
          specialties: ["Cardiology"],
        },
        {
          id: JOSE.id,
          name: "Dr. José Santos",
          departmentName: "Heart Center",
          specialties: ["Cardiology", "General Pediatrics"],
        },
      ],
    });
  });

  it("asks which specialty when the name matches several", async () => {
    const deps = bookingDeps({ intent: "book", specialtyName: "pediatric" });
    vi.mocked(deps.tools.getSpecialties).mockResolvedValue([
      PEDIATRICS,
      { ...PEDIATRICS, id: "00000000-0000-4000-8000-0000000005a3", name: "Pediatric Surgery" },
    ]);

    const result = await handleTurn(message("pediatrics please"), deps);

    expect(result.state.step).toBe("choosing_specialty");
    expect(result.payload).toEqual({
      kind: "specialty_options",
      specialties: [
        { id: PEDIATRICS.id, name: "General Pediatrics" },
        { id: "00000000-0000-4000-8000-0000000005a3", name: "Pediatric Surgery" },
      ],
    });
  });

  it("lists every active specialty when the named one is unknown", async () => {
    const deps = bookingDeps({ intent: "book", specialtyName: "Astrology" });

    const result = await handleTurn(message("Book astrology"), deps);

    expect(result.reply).toBe(BOOKING_COPY.specialtyNotFound);
    expect(result.state.step).toBe("choosing_specialty");
    expect(result.payload).toMatchObject({ kind: "specialty_options" });
  });

  it("moves from a chosen specialty card to its doctors", async () => {
    const deps = bookingDeps();

    const result = await handleTurn(
      turnWith({ type: "select_specialty", specialtyId: PEDIATRICS.id }, { step: "choosing_specialty", draft: {} }),
      deps,
    );

    expect(deps.generate).not.toHaveBeenCalled();
    expect(result.userContent).toBe("General Pediatrics");
    expect(result.state).toEqual({ step: "choosing_doctor", draft: { specialtyId: PEDIATRICS.id } });
    expect(result.payload).toMatchObject({
      kind: "doctor_options",
      doctors: [{ id: JOSE.id }, { id: LIM.id }],
    });
  });

  it("shows the chosen doctor's database slots grouped by Manila date", async () => {
    const deps = bookingDeps();

    const result = await handleTurn(
      turnWith(
        { type: "select_doctor", doctorId: MAYA.id },
        { step: "choosing_doctor", draft: { specialtyId: CARDIOLOGY.id } },
      ),
      deps,
    );

    expect(result.userContent).toBe("Dr. Maya Santos");
    expect(deps.tools.getDoctorAvailability).toHaveBeenCalledWith({
      doctorId: MAYA.id,
      specialtyId: CARDIOLOGY.id,
      fromDate: "2026-10-31",
      days: 7,
      preferredTime: undefined,
    });
    expect(result.state).toEqual(CHOOSING_MAYA_SLOT);
    expect(result.payload).toEqual({
      kind: "slot_picker",
      doctorName: "Dr. Maya Santos",
      days: [
        { date: "2026-11-03", slots: [MAYA_SLOTS[0], MAYA_SLOTS[1]] },
        { date: "2026-11-04", slots: [MAYA_SLOTS[2]] },
      ],
      nextFromDate: "2026-11-07",
      alternatives: [],
    });
  });

  it("refuses a doctor that is not in the database or not active", async () => {
    const deps = bookingDeps();
    const unknownDoctor = "00000000-0000-4000-8000-0000000000ff";

    const result = await handleTurn(
      turnWith(
        { type: "select_doctor", doctorId: unknownDoctor },
        { step: "choosing_doctor", draft: { specialtyId: CARDIOLOGY.id } },
      ),
      deps,
    );

    expect(result.reply).toContain(BOOKING_COPY.optionUnavailable);
    expect(deps.tools.getDoctorAvailability).not.toHaveBeenCalled();
    expect(result.state).toEqual({ step: "choosing_doctor", draft: { specialtyId: CARDIOLOGY.id } });
    expect(result.payload).toMatchObject({ kind: "doctor_options" });
  });

  it("passes the preferred date and time to the availability lookup", async () => {
    const deps = bookingDeps({
      intent: "book",
      doctorName: "Maya Santos",
      preferredDate: "2026-11-03",
      preferredTime: "morning",
    });

    const result = await handleTurn(message("Dr. Maya Santos on Tuesday morning"), deps);

    expect(deps.tools.getDoctorAvailability).toHaveBeenCalledWith({
      doctorId: MAYA.id,
      specialtyId: CARDIOLOGY.id,
      fromDate: "2026-11-03",
      days: 7,
      preferredTime: "morning",
    });
    expect(result.state.draft).toMatchObject({ preferredDate: "2026-11-03", preferredTime: "morning" });
  });

  it("includes today's Manila date in the extraction prompt", async () => {
    const deps = bookingDeps();

    await handleTurn(message("Book next Monday"), deps);

    expect(vi.mocked(deps.generate).mock.calls[0][0].systemPrompt).toContain("2026-10-31");
  });
});

describe("booking Path B (by doctor)", () => {
  it("goes straight to slots for a doctor with one specialty", async () => {
    const deps = bookingDeps({ intent: "book", doctorName: "Dr. Maya Santos" });

    const result = await handleTurn(message("I'd like to see Dr. Maya Santos"), deps);

    expect(result.state).toEqual(CHOOSING_MAYA_SLOT);
    expect(result.payload).toMatchObject({ kind: "slot_picker", doctorName: "Dr. Maya Santos" });
  });

  it("asks which specialty first for a doctor with several", async () => {
    const deps = bookingDeps({ intent: "book", doctorName: "José Santos" });

    const result = await handleTurn(message("Book Dr. José Santos"), deps);

    expect(result.state).toEqual({ step: "choosing_doctor_specialty", draft: { doctorId: JOSE.id } });
    expect(result.payload).toEqual({
      kind: "specialty_options",
      specialties: [
        { id: CARDIOLOGY.id, name: "Cardiology" },
        { id: PEDIATRICS.id, name: "General Pediatrics" },
      ],
    });
    expect(deps.tools.getDoctorAvailability).not.toHaveBeenCalled();
  });

  it("keeps the doctor when the patient picks one of their specialties", async () => {
    const deps = bookingDeps();

    const result = await handleTurn(
      turnWith(
        { type: "select_specialty", specialtyId: PEDIATRICS.id },
        { step: "choosing_doctor_specialty", draft: { doctorId: JOSE.id } },
      ),
      deps,
    );

    expect(result.state).toEqual({
      step: "choosing_slot",
      draft: { doctorId: JOSE.id, specialtyId: PEDIATRICS.id },
    });
    expect(deps.tools.getDoctorAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ doctorId: JOSE.id, specialtyId: PEDIATRICS.id }),
    );
  });

  it("refuses a specialty the doctor does not have", async () => {
    const deps = bookingDeps();
    vi.mocked(deps.tools.getSpecialties).mockResolvedValue([
      CARDIOLOGY,
      PEDIATRICS,
      { ...CARDIOLOGY, id: "00000000-0000-4000-8000-0000000005a9", name: "Dermatology" },
    ]);

    const result = await handleTurn(
      turnWith(
        { type: "select_specialty", specialtyId: "00000000-0000-4000-8000-0000000005a9" },
        { step: "choosing_doctor_specialty", draft: { doctorId: JOSE.id } },
      ),
      deps,
    );

    expect(result.reply).toContain(BOOKING_COPY.optionUnavailable);
    expect(result.state).toEqual({ step: "choosing_doctor_specialty", draft: { doctorId: JOSE.id } });
  });

  it("uses a named specialty to pick among the doctor's specialties", async () => {
    const deps = bookingDeps({ intent: "book", doctorName: "José Santos", specialtyName: "pediatrics" });

    const result = await handleTurn(message("Dr. José Santos for pediatrics"), deps);

    expect(result.state).toEqual({
      step: "choosing_slot",
      draft: { doctorId: JOSE.id, specialtyId: PEDIATRICS.id },
    });
  });

  it("offers the matching doctors when the name is ambiguous", async () => {
    const deps = bookingDeps({ intent: "book", doctorName: "Dr. Santos" });

    const result = await handleTurn(message("Book Dr. Santos"), deps);

    expect(result.state.step).toBe("choosing_doctor");
    expect(result.payload).toMatchObject({
      kind: "doctor_options",
      doctors: [{ id: MAYA.id }, { id: JOSE.id }],
    });
  });

  it("asks a follow-up with specialties when no active doctor matches", async () => {
    const deps = bookingDeps({ intent: "book", doctorName: "Dr. House" });

    const result = await handleTurn(message("Book Dr. House"), deps);

    expect(result.reply).toContain(BOOKING_COPY.doctorNotFound);
    expect(result.reply).not.toContain("House");
    expect(result.state.step).toBe("choosing_specialty");
    expect(result.payload).toMatchObject({ kind: "specialty_options" });
  });
});

describe("booking slot selection and confirmation", () => {
  it("re-checks availability and asks for confirmation without booking", async () => {
    const deps = bookingDeps();

    const result = await handleTurn(
      turnWith({ type: "select_slot", start: SELECTED.start }, CHOOSING_MAYA_SLOT),
      deps,
    );

    expect(deps.tools.getDoctorAvailability).toHaveBeenCalledWith({
      doctorId: MAYA.id,
      specialtyId: CARDIOLOGY.id,
      fromDate: "2026-11-03",
      days: 1,
    });
    expect(deps.tools.createAppointment).not.toHaveBeenCalled();
    expect(result.state).toEqual(AWAITING_CONFIRMATION);
    expect(result.userContent).toBe(
      `${formatManilaShortDate(SELECTED.start)} · ${formatManilaTime(SELECTED.start)}`,
    );
    expect(result.payload).toEqual({
      kind: "booking_summary",
      doctorName: "Dr. Maya Santos",
      specialtyName: "Cardiology",
      start: SELECTED.start,
      end: SELECTED.end,
      reason: null,
    });
  });

  it("rejects a stale slot and shows fresh ones", async () => {
    const deps = bookingDeps();
    const taken = "2026-11-03T03:00:00.000Z";

    const result = await handleTurn(
      turnWith({ type: "select_slot", start: taken }, CHOOSING_MAYA_SLOT),
      deps,
    );

    expect(result.reply).toContain(BOOKING_COPY.slotTaken);
    expect(result.state).toEqual(CHOOSING_MAYA_SLOT);
    expect(result.payload).toMatchObject({ kind: "slot_picker" });
  });

  it("never books without an explicit Confirm", async () => {
    const deps = bookingDeps();

    const result = await handleTurn(turnWith({ type: "confirm_booking" }, CHOOSING_MAYA_SLOT), deps);

    expect(result.reply).toBe(BOOKING_COPY.outOfOrder);
    expect(result.state).toBe(CHOOSING_MAYA_SLOT);
    expect(deps.claimBooking).not.toHaveBeenCalled();
    expect(deps.tools.createAppointment).not.toHaveBeenCalled();
  });

  it("books on Confirm with the session patient and shows the request card", async () => {
    const deps = bookingDeps();
    const state: BookingState = {
      ...AWAITING_CONFIRMATION,
      draft: { ...AWAITING_CONFIRMATION.draft, reason: "Follow-up" },
    };

    const result = await handleTurn(turnWith({ type: "confirm_booking" }, state), deps);

    expect(deps.claimBooking).toHaveBeenCalledWith({ step: "booking", draft: state.draft });
    expect(deps.tools.createAppointment).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      doctorId: MAYA.id,
      start: SELECTED.start,
      reason: "Follow-up",
    });
    expect(result.reply).toBe(BOOKING_COPY.requested);
    expect(result.state).toEqual({ step: "booked", draft: state.draft });
    expect(result.payload).toEqual({
      kind: "booking_result",
      doctorName: "Dr. Maya Santos",
      start: SELECTED.start,
      end: SELECTED.end,
    });
  });

  it("books once when Confirm arrives twice", async () => {
    const deps = bookingDeps({ intent: "book" }, { claimBooking: vi.fn(async () => false) });

    const result = await handleTurn(turnWith({ type: "confirm_booking" }, AWAITING_CONFIRMATION), deps);

    expect(deps.tools.createAppointment).not.toHaveBeenCalled();
    expect(result.reply).toBe(BOOKING_COPY.alreadyProcessing);
    expect(result.state).toBe(AWAITING_CONFIRMATION);
    expect(result.payload).toBeNull();
  });

  it("shows the database message and fresh slots, never a confirmation, when booking fails", async () => {
    const deps = bookingDeps();
    vi.mocked(deps.tools.createAppointment).mockResolvedValue({
      ok: false,
      message: "That slot was just booked. Choose another time.",
    });

    const result = await handleTurn(turnWith({ type: "confirm_booking" }, AWAITING_CONFIRMATION), deps);

    expect(result.reply).toContain("That slot was just booked. Choose another time.");
    expect(result.reply).not.toBe(BOOKING_COPY.requested);
    expect(result.state).toEqual({
      step: "failed",
      draft: { specialtyId: CARDIOLOGY.id, doctorId: MAYA.id },
    });
    expect(result.payload).toMatchObject({ kind: "slot_picker" });
  });

  it("fails without booking when the slot disappeared before Confirm", async () => {
    const deps = bookingDeps();
    vi.mocked(deps.tools.getDoctorAvailability).mockResolvedValue([MAYA_SLOTS[2]]);

    const result = await handleTurn(turnWith({ type: "confirm_booking" }, AWAITING_CONFIRMATION), deps);

    expect(deps.tools.createAppointment).not.toHaveBeenCalled();
    expect(result.reply).toContain(BOOKING_COPY.slotTaken);
    expect(result.state.step).toBe("failed");
    expect(result.payload).toMatchObject({ kind: "slot_picker" });
  });

  it("lets the patient pick a fresh slot after a failed booking", async () => {
    const deps = bookingDeps();

    const result = await handleTurn(
      turnWith(
        { type: "select_slot", start: SELECTED.start },
        { step: "failed", draft: CHOOSING_MAYA_SLOT.draft },
      ),
      deps,
    );

    expect(result.state).toEqual(AWAITING_CONFIRMATION);
  });
});

describe("booking corrections and edge cases", () => {
  it("clears the doctor when the patient changes the specialty mid-flow", async () => {
    const deps = bookingDeps({ intent: "book", specialtyName: "General Pediatrics" });

    const result = await handleTurn(message("Actually, pediatrics instead", AWAITING_CONFIRMATION), deps);

    expect(result.state).toEqual({ step: "choosing_doctor", draft: { specialtyId: PEDIATRICS.id } });
  });

  it("keeps the doctor but drops the slot when the date changes", async () => {
    const deps = bookingDeps({ intent: "book", preferredDate: "2026-11-10" });

    const result = await handleTurn(message("Can we do the 10th instead?", AWAITING_CONFIRMATION), deps);

    expect(result.state).toEqual({
      step: "choosing_slot",
      draft: { specialtyId: CARDIOLOGY.id, doctorId: MAYA.id, preferredDate: "2026-11-10" },
    });
    expect(deps.tools.getDoctorAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ fromDate: "2026-11-10" }),
    );
  });

  it("starts a fresh draft after a finished booking", async () => {
    const deps = bookingDeps({ intent: "book", specialtyName: "General Pediatrics" });
    const booked: BookingState = { step: "booked", draft: AWAITING_CONFIRMATION.draft };

    const result = await handleTurn(message("Book another one for pediatrics", booked), deps);

    expect(result.state).toEqual({ step: "choosing_doctor", draft: { specialtyId: PEDIATRICS.id } });
  });

  it.each([
    ["a past date", "2026-10-30", BOOKING_COPY.dateInPast],
    ["a date beyond the 60-day horizon", "2026-12-31", BOOKING_COPY.dateBeyondHorizon],
  ])("rejects %s without changing the booking", async (_label, preferredDate, reply) => {
    const deps = bookingDeps({ intent: "book", preferredDate });

    const result = await handleTurn(message("Book that day", CHOOSING_MAYA_SLOT), deps);

    expect(result.reply).toBe(reply);
    expect(result.state).toBe(CHOOSING_MAYA_SLOT);
    expect(deps.tools.getDoctorAvailability).not.toHaveBeenCalled();
  });

  it("offers the next window and other doctors of the specialty when the week is empty", async () => {
    const deps = bookingDeps();
    deps.tools = fakeTools({});

    const result = await handleTurn(
      turnWith(
        { type: "select_doctor", doctorId: MAYA.id },
        { step: "choosing_doctor", draft: { specialtyId: CARDIOLOGY.id } },
      ),
      deps,
    );

    expect(result.state).toEqual(CHOOSING_MAYA_SLOT);
    expect(result.payload).toMatchObject({
      kind: "slot_picker",
      days: [],
      nextFromDate: "2026-11-07",
      alternatives: [{ id: JOSE.id, name: "Dr. José Santos" }],
    });
  });

  it("does not offer a next window past the booking horizon", async () => {
    const deps = bookingDeps({ intent: "book", doctorName: "Maya Santos", preferredDate: "2026-12-28" });

    const result = await handleTurn(message("Dr. Maya Santos on 28 December"), deps);

    expect(deps.tools.getDoctorAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ fromDate: "2026-12-28", days: 3 }),
    );
    expect(result.payload).toMatchObject({ kind: "slot_picker", nextFromDate: null });
  });

  it("shows the next window when asked", async () => {
    const deps = bookingDeps();

    const result = await handleTurn(
      turnWith({ type: "more_slots", fromDate: "2026-11-07" }, CHOOSING_MAYA_SLOT),
      deps,
    );

    expect(result.state.draft.preferredDate).toBe("2026-11-07");
    expect(deps.tools.getDoctorAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ fromDate: "2026-11-07", days: 7 }),
    );
  });

  it("goes back to the slots when the patient changes the time", async () => {
    const deps = bookingDeps();

    const result = await handleTurn(
      turnWith({ type: "change_booking", field: "slot" }, AWAITING_CONFIRMATION),
      deps,
    );

    expect(result.state).toEqual(CHOOSING_MAYA_SLOT);
    expect(result.payload).toMatchObject({ kind: "slot_picker" });
  });

  it("goes back to the doctors when the patient changes the doctor", async () => {
    const deps = bookingDeps();

    const result = await handleTurn(
      turnWith({ type: "change_booking", field: "doctor" }, AWAITING_CONFIRMATION),
      deps,
    );

    expect(result.state).toEqual({ step: "choosing_doctor", draft: { specialtyId: CARDIOLOGY.id } });
  });

  it("stops the flow when the patient cancels it", async () => {
    const deps = bookingDeps();

    const result = await handleTurn(turnWith({ type: "cancel_booking" }, AWAITING_CONFIRMATION), deps);

    expect(result.reply).toBe(BOOKING_COPY.stopped);
    expect(result.state).toEqual({ step: "cancelled", draft: {} });
    expect(deps.tools.createAppointment).not.toHaveBeenCalled();
  });

  it("keeps the booking state through an unrelated question", async () => {
    const deps = bookingDeps({ intent: "doctor_inquiry" });

    const result = await handleTurn(message("Which departments do you have?", CHOOSING_MAYA_SLOT), deps);

    expect(result.state).toBe(CHOOSING_MAYA_SLOT);
  });
});
