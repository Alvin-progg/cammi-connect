// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { BOOKING_COPY } from "@/lib/chat/booking";
import { PAYMENT_COPY, hmoOfferCopy, hmoPendingCopy, paymentRequestCopy } from "@/lib/chat/payment";
import { DEFAULT_FIRST_CONTACT } from "@/lib/chat/routing";
import type { ChatEvent } from "@/lib/chat/schemas";
import type { BookingState } from "@/lib/chat/state";
import type { DoctorSummary, Specialty } from "@/lib/directory/types";
import type { GenerateInput } from "@/server/ai/groq";
import { handleTurn, type TurnDeps, type TurnInput } from "@/server/chat/orchestrator";
import type { ChatTools, TimeSlot } from "@/server/chat/tools";

vi.mock("server-only", () => ({}));

/**
 * PAY-03: with payment.enabled, Cami asks the discount and payer questions
 * after the slot, shows the breakdown on the summary, and books with a
 * charge. Every amount comes from the fee the tools read from the database.
 */

const PATIENT_ID = "00000000-0000-4000-8000-000000000201";
// Saturday 2026-10-31, 09:00 in Manila.
const NOW = new Date("2026-10-31T01:00:00Z");

const CARDIOLOGY: Specialty = {
  id: "00000000-0000-4000-8000-0000000005a1",
  name: "Cardiology",
  description: null,
  routingHints: null,
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
const SLOT: TimeSlot = { start: "2026-11-03T01:00:00.000Z", end: "2026-11-03T01:30:00.000Z" };
const MAXICARE = {
  id: "00000000-0000-4000-8000-00000000a0a1",
  name: "Maxicare",
  copayCentavos: 0,
};
/** BEN-05: a saved membership the doctor accepts (what the tools return). */
const MAXICARE_OPTION = {
  patientHmoId: "00000000-0000-4000-8000-00000000b0b1",
  providerId: MAXICARE.id,
  name: MAXICARE.name,
  copayCentavos: MAXICARE.copayCentavos,
  maskedNumber: "••••4417",
  offer: { kind: "offered" as const },
};

function fakeTools(feeCentavos: number | null = 70000): ChatTools {
  return {
    getDepartments: vi.fn(async () => []),
    getSpecialties: vi.fn(async () => [CARDIOLOGY]),
    getRoutableSpecialties: vi.fn(async () => [{ ...CARDIOLOGY, hasActiveDoctors: true }]),
    getDoctorDetails: vi.fn(async () => ({ status: "found" as const, doctor: MAYA })),
    getDoctor: vi.fn(async ({ doctorId }: { doctorId: string }) =>
      doctorId === MAYA.id ? MAYA : null,
    ),
    getDoctorsBySpecialty: vi.fn(async () => [MAYA]),
    getDoctorAvailability: vi.fn(async () => [SLOT]),
    createAppointment: vi.fn(async () => ({ ok: true as const, appointmentId: "appt-1" })),
    getConsultationFee: vi.fn(async () => feeCentavos),
    getHmoOptions: vi.fn(async () => [MAXICARE_OPTION]),
    isPwdVerified: vi.fn(async () => true),
    createChargedAppointment: vi.fn(async () => ({
      ok: true as const,
      appointmentId: "appt-1",
      payment: {
        status: "awaiting_payment" as const,
        amountDueCentavos: 56000,
        referenceCode: "CC-7F3K2",
        deadline: "2026-10-31T03:00:00.000Z",
      },
    })),
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

function deps(tools: ChatTools = fakeTools(), claim = true): TurnDeps {
  return {
    generate: vi.fn<(input: GenerateInput) => Promise<string>>(),
    searchKnowledge: vi.fn(async () => ({ found: false as const })),
    tools,
    claimBooking: vi.fn(async () => claim),
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

const CHOOSING_SLOT: BookingState = {
  step: "choosing_slot",
  draft: { specialtyId: CARDIOLOGY.id, doctorId: MAYA.id },
};
const SLOT_DRAFT = { ...CHOOSING_SLOT.draft, slotStart: SLOT.start };
const SENIOR_ONLINE: BookingState = {
  step: "awaiting_confirmation",
  draft: { ...SLOT_DRAFT, privilege: "senior", payment: { payer: "self", method: "qr_ph" } },
};

describe("chat booking with payment enabled", () => {
  it("asks the discount question after the slot instead of showing the summary", async () => {
    const result = await handleTurn(turn({ type: "select_slot", start: SLOT.start }, CHOOSING_SLOT), deps());

    expect(result.reply).toBe(PAYMENT_COPY.privilegeQuestion);
    expect(result.payload).toEqual({ kind: "privilege_options", pwdVerified: true });
    expect(result.state).toEqual({ step: "choosing_privilege", draft: SLOT_DRAFT });
  });

  it("keeps today's summary when payment is off", async () => {
    const tools = fakeTools();
    const result = await handleTurn(
      turn({ type: "select_slot", start: SLOT.start }, CHOOSING_SLOT, false),
      deps(tools),
    );

    expect(result.state.step).toBe("awaiting_confirmation");
    expect(result.payload).toMatchObject({ kind: "booking_summary" });
    expect(result.payload).not.toHaveProperty("charge");
    expect(tools.getConsultationFee).not.toHaveBeenCalled();
  });

  it("does not book a consultation whose fee is on request", async () => {
    const result = await handleTurn(
      turn({ type: "select_slot", start: SLOT.start }, CHOOSING_SLOT),
      deps(fakeTools(null)),
    );

    expect(result.reply).toBe(PAYMENT_COPY.priceOnRequest);
    expect(result.payload).toBeNull();
    expect(result.state).toEqual({ step: "cancelled", draft: {} });
  });

  it("asks who pays after the discount, listing active HMOs and no PhilHealth for a consult", async () => {
    const result = await handleTurn(
      turn(
        { type: "select_privilege", privilege: "senior" },
        { step: "choosing_privilege", draft: SLOT_DRAFT },
      ),
      deps(),
    );

    expect(result.userContent).toBe("Senior citizen (60+)");
    expect(result.reply).toBe(PAYMENT_COPY.payerQuestion);
    expect(result.payload).toEqual({
      kind: "payer_options",
      philhealth: false,
      hmoMemberships: [{ patientHmoId: MAXICARE_OPTION.patientHmoId, name: "Maxicare", maskedNumber: "••••4417" }],
    });
    expect(result.state).toEqual({
      step: "choosing_payer",
      draft: { ...SLOT_DRAFT, privilege: "senior" },
    });
  });

  it("shows the senior breakdown from the database fee on the summary", async () => {
    const result = await handleTurn(
      turn(
        { type: "select_payer", payment: { payer: "self", method: "qr_ph" } },
        { step: "choosing_payer", draft: { ...SLOT_DRAFT, privilege: "senior" } },
      ),
      deps(),
    );

    expect(result.reply).toBe(BOOKING_COPY.confirmPrompt);
    expect(result.state).toEqual(SENIOR_ONLINE);
    expect(result.payload).toMatchObject({
      kind: "booking_summary",
      charge: {
        privilege: "senior",
        payerLabel: "I'll pay (GCash, Maya, bank)",
        baseCentavos: 70000,
        vatExemptionCentavos: 0,
        privilegeDiscountCentavos: 14000,
        philhealthCentavos: 0,
        hmoCentavos: 0,
        amountDueCentavos: 56000,
      },
    });
  });

  it("asks the discount question again, with the reason, when PWD is chosen without a verified declaration", async () => {
    const tools = fakeTools();
    vi.mocked(tools.isPwdVerified).mockResolvedValue(false);

    const result = await handleTurn(
      turn({ type: "select_privilege", privilege: "pwd" }, { step: "choosing_privilege", draft: SLOT_DRAFT }),
      deps(tools),
    );

    expect(result.reply).toBe(`${PAYMENT_COPY.pwdNotVerified} ${PAYMENT_COPY.privilegeQuestion}`);
    expect(result.payload).toEqual({ kind: "privilege_options", pwdVerified: false });
    expect(result.state).toEqual({ step: "choosing_privilege", draft: SLOT_DRAFT });
  });

  it("explains a saved HMO the doctor does not accept, and offers only the accepted memberships", async () => {
    const tools = fakeTools();
    const notAccepted = {
      ...MAXICARE_OPTION,
      patientHmoId: "00000000-0000-4000-8000-00000000b0b2",
      name: "Intellicare",
      offer: { kind: "doctor_not_accredited" as const },
    };
    vi.mocked(tools.getHmoOptions).mockResolvedValue([MAXICARE_OPTION, notAccepted]);

    const result = await handleTurn(
      turn({ type: "select_privilege", privilege: "none" }, { step: "choosing_privilege", draft: SLOT_DRAFT }),
      deps(tools),
    );

    expect(result.reply).toBe(
      `${hmoOfferCopy(notAccepted.offer, "Intellicare")} ${PAYMENT_COPY.payerQuestion}`,
    );
    expect(result.payload).toMatchObject({
      kind: "payer_options",
      hmoMemberships: [{ patientHmoId: MAXICARE_OPTION.patientHmoId, name: "Maxicare" }],
    });
  });

  it("shows HMO full coverage with a masked member number", async () => {
    const result = await handleTurn(
      turn(
        {
          type: "select_payer",
          payment: { payer: "hmo", patientHmoId: MAXICARE_OPTION.patientHmoId },
        },
        { step: "choosing_payer", draft: { ...SLOT_DRAFT, privilege: "none" } },
      ),
      deps(fakeTools(50000)),
    );

    expect(result.userContent).toBe("My HMO");
    expect(result.payload).toMatchObject({
      kind: "booking_summary",
      charge: { payerLabel: "Maxicare (member ••••4417)", hmoCentavos: 50000, amountDueCentavos: 0 },
    });
    expect(JSON.stringify(result.payload)).not.toContain("12344417");
  });

  it("asks again when the chosen HMO is no longer active", async () => {
    const tools = fakeTools();
    vi.mocked(tools.getHmoOptions).mockResolvedValue([]);

    const result = await handleTurn(
      turn(
        {
          type: "select_payer",
          payment: { payer: "hmo", patientHmoId: MAXICARE_OPTION.patientHmoId },
        },
        { step: "choosing_payer", draft: { ...SLOT_DRAFT, privilege: "none" } },
      ),
      deps(tools),
    );

    expect(result.reply).toBe(`${PAYMENT_COPY.hmoUnavailable} ${PAYMENT_COPY.payerQuestion}`);
    expect(result.state.step).toBe("choosing_payer");
    expect(result.state.draft.payment).toBeUndefined();
  });

  it("refuses PhilHealth for a consultation, which has no PhilHealth benefit", async () => {
    const result = await handleTurn(
      turn(
        { type: "select_payer", payment: { payer: "philhealth" } },
        { step: "choosing_payer", draft: { ...SLOT_DRAFT, privilege: "none" } },
      ),
      deps(),
    );

    expect(result.state.step).toBe("choosing_payer");
    expect(result.payload).toMatchObject({ kind: "payer_options", philhealth: false });
  });

  it("refuses a payer choice before the discount question", async () => {
    const tools = fakeTools();
    const result = await handleTurn(
      turn({ type: "select_payer", payment: { payer: "self", method: "qr_ph" } }, CHOOSING_SLOT),
      deps(tools),
    );

    expect(result.reply).toBe(BOOKING_COPY.outOfOrder);
    expect(result.state).toBe(CHOOSING_SLOT);
  });

  it("books with a charge on Confirm, passing the amount the patient saw", async () => {
    const tools = fakeTools();
    const result = await handleTurn(turn({ type: "confirm_booking" }, SENIOR_ONLINE), deps(tools));

    expect(tools.createAppointment).not.toHaveBeenCalled();
    expect(tools.createChargedAppointment).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      doctorId: MAYA.id,
      specialtyId: CARDIOLOGY.id,
      start: SLOT.start,
      reason: null,
      privilege: "senior",
      payment: { payer: "self", method: "qr_ph" },
      expectedAmountDueCentavos: 56000,
    });
    expect(result.reply).toBe(
      paymentRequestCopy({
        amountDueCentavos: 56000,
        referenceCode: "CC-7F3K2",
        deadline: "2026-10-31T03:00:00.000Z",
        now: NOW,
      }),
    );
    expect(result.payload).toEqual({
      kind: "booking_result",
      doctorName: "Dr. Maya Santos",
      start: SLOT.start,
      end: SLOT.end,
      payment: {
        status: "awaiting_payment",
        amountDueCentavos: 56000,
        referenceCode: "CC-7F3K2",
        deadline: "2026-10-31T03:00:00.000Z",
      },
    });
    expect(result.state.step).toBe("booked");
  });

  it("tells an HMO patient the front desk checks coverage", async () => {
    const tools = fakeTools(50000);
    vi.mocked(tools.createChargedAppointment).mockResolvedValue({
      ok: true,
      appointmentId: "appt-1",
      payment: { status: "hmo_pending", amountDueCentavos: 0, referenceCode: "CC-ABCDE", deadline: null },
    });
    const state: BookingState = {
      step: "awaiting_confirmation",
      draft: {
        ...SLOT_DRAFT,
        privilege: "none",
        payment: { payer: "hmo", patientHmoId: MAXICARE_OPTION.patientHmoId },
      },
    };

    const result = await handleTurn(turn({ type: "confirm_booking" }, state), deps(tools));

    expect(result.reply).toBe(hmoPendingCopy("Maxicare"));
    expect(tools.createChargedAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ expectedAmountDueCentavos: 0 }),
    );
  });

  it("books once on a double Confirm", async () => {
    const tools = fakeTools();
    const result = await handleTurn(
      turn({ type: "confirm_booking" }, SENIOR_ONLINE),
      deps(tools, false),
    );

    expect(result.reply).toBe(BOOKING_COPY.alreadyProcessing);
    expect(tools.createChargedAppointment).not.toHaveBeenCalled();
  });

  it("offers later slots when the database refuses the booking", async () => {
    const tools = fakeTools();
    vi.mocked(tools.createChargedAppointment).mockResolvedValue({
      ok: false,
      message: "That time starts too soon to pay before your visit. Please pick a later time.",
    });

    const result = await handleTurn(turn({ type: "confirm_booking" }, SENIOR_ONLINE), deps(tools));

    expect(result.state.step).toBe("failed");
    expect(result.reply).toContain("Please pick a later time.");
    expect(result.payload).toMatchObject({ kind: "slot_picker" });
  });

  it("asks the payment questions at Confirm when payment was switched on mid-booking", async () => {
    const tools = fakeTools();
    const result = await handleTurn(
      turn({ type: "confirm_booking" }, { step: "awaiting_confirmation", draft: SLOT_DRAFT }),
      deps(tools),
    );

    expect(result.state.step).toBe("choosing_privilege");
    expect(tools.createChargedAppointment).not.toHaveBeenCalled();
    expect(tools.createAppointment).not.toHaveBeenCalled();
  });

  it("lets the patient change the discount and payer from the summary", async () => {
    const result = await handleTurn(
      turn({ type: "change_booking", field: "payment" }, SENIOR_ONLINE),
      deps(),
    );

    expect(result.state).toEqual({ step: "choosing_privilege", draft: SLOT_DRAFT });
  });

  it("never calls the model for the payment steps", async () => {
    const turnDeps = deps();
    await handleTurn(turn({ type: "confirm_booking" }, SENIOR_ONLINE), turnDeps);

    expect(turnDeps.generate).not.toHaveBeenCalled();
  });
});
