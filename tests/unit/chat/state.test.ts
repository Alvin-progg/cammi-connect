// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  BOOKING_STEPS,
  IDLE_STATE,
  acceptsEvent,
  applyCorrection,
  parseBookingState,
  type BookingDraft,
} from "@/lib/chat/state";

const SPECIALTY_ID = "00000000-0000-4000-8000-0000000005a1";
const DOCTOR_ID = "00000000-0000-4000-8000-0000000000d1";
const FULL_DRAFT: BookingDraft = {
  specialtyId: SPECIALTY_ID,
  doctorId: DOCTOR_ID,
  preferredDate: "2026-11-03",
  preferredTime: "morning",
  slotStart: "2026-11-03T01:00:00.000Z",
  reason: "Follow-up",
};

describe("booking steps", () => {
  it("has the fourteen states of the booking flow", () => {
    expect(BOOKING_STEPS).toEqual([
      "idle",
      // AI-APT-002: medical advice declined, booking offered.
      "offering_booking",
      "choosing_specialty",
      "choosing_doctor",
      "choosing_doctor_specialty",
      // PAY-07: lab tests, imaging, or a package.
      "choosing_services",
      "choosing_slot",
      // PAY-03: discount and payer questions, only while payment.enabled.
      "choosing_privilege",
      "choosing_payer",
      "awaiting_confirmation",
      "booking",
      "booked",
      "failed",
      "cancelled",
    ]);
  });
});

describe("parseBookingState", () => {
  it("returns a stored state that matches the schema", () => {
    const stored = { step: "awaiting_confirmation", draft: FULL_DRAFT };

    expect(parseBookingState(stored)).toEqual(stored);
  });

  it("keeps the routing details of a care need", () => {
    const stored = {
      step: "offering_booking",
      draft: {
        reason: "Cough",
        careNeed: { specialtyCandidates: ["Pediatrics"], routingConfidence: "high", age: 4 },
        ageAsked: true,
      },
    };

    expect(parseBookingState(stored)).toEqual(stored);
  });

  it.each([
    ["null", null],
    ["an unknown step", { step: "teleporting", draft: {} }],
    ["a non-uuid doctor", { step: "choosing_slot", draft: { doctorId: "not-a-uuid" } }],
    ["a malformed date", { step: "choosing_slot", draft: { preferredDate: "next week" } }],
  ])("treats %s as idle", (_label, stored) => {
    expect(parseBookingState(stored)).toEqual(IDLE_STATE);
  });
});

describe("acceptsEvent", () => {
  it("accepts the discount and payer answers only at their own question (PAY-03)", () => {
    for (const step of BOOKING_STEPS) {
      expect(acceptsEvent(step, "select_privilege")).toBe(step === "choosing_privilege");
      expect(acceptsEvent(step, "select_payer")).toBe(step === "choosing_payer");
    }
    expect(acceptsEvent("choosing_privilege", "cancel_booking")).toBe(true);
    expect(acceptsEvent("choosing_payer", "cancel_booking")).toBe(true);
  });


  it("accepts Confirm only while awaiting confirmation", () => {
    for (const step of BOOKING_STEPS) {
      expect(acceptsEvent(step, "confirm_booking")).toBe(step === "awaiting_confirmation");
    }
  });

  it("rejects skipping ahead to a slot before a doctor is chosen", () => {
    expect(acceptsEvent("idle", "select_slot")).toBe(false);
    expect(acceptsEvent("choosing_specialty", "select_slot")).toBe(false);
    expect(acceptsEvent("choosing_doctor", "select_slot")).toBe(false);
    expect(acceptsEvent("choosing_slot", "select_slot")).toBe(true);
  });

  it("lets a patient pick fresh slots or another doctor after a failed booking", () => {
    expect(acceptsEvent("failed", "select_slot")).toBe(true);
    expect(acceptsEvent("failed", "select_doctor")).toBe(true);
  });

  it("accepts a specialty choice only while one is being asked for or offered", () => {
    expect(acceptsEvent("choosing_specialty", "select_specialty")).toBe(true);
    expect(acceptsEvent("choosing_doctor_specialty", "select_specialty")).toBe(true);
    // AI-APT-002: the routed doctor list offers a one-tap alternative specialty.
    expect(acceptsEvent("choosing_doctor", "select_specialty")).toBe(true);
    expect(acceptsEvent("choosing_slot", "select_specialty")).toBe(false);
  });

  it("accepts a reason edit only on the summary", () => {
    for (const step of BOOKING_STEPS) {
      expect(acceptsEvent(step, "update_reason")).toBe(step === "awaiting_confirmation");
    }
  });

  it("accepts the booking offer only while it is offered", () => {
    for (const step of BOOKING_STEPS) {
      expect(acceptsEvent(step, "accept_booking_offer")).toBe(step === "offering_booking");
    }
  });

  it("does not let a finished or in-flight booking be changed or cancelled", () => {
    for (const step of ["idle", "booking", "booked", "cancelled"] as const) {
      expect(acceptsEvent(step, "change_booking")).toBe(false);
      expect(acceptsEvent(step, "cancel_booking")).toBe(false);
    }
  });
});

describe("applyCorrection", () => {
  it("clears the doctor and slot when the specialty changes", () => {
    const otherSpecialty = "00000000-0000-4000-8000-0000000005a2";

    expect(applyCorrection(FULL_DRAFT, { specialtyId: otherSpecialty })).toEqual({
      ...FULL_DRAFT,
      specialtyId: otherSpecialty,
      doctorId: undefined,
      slotStart: undefined,
    });
  });

  it("clears only the slot when the doctor changes", () => {
    const otherDoctor = "00000000-0000-4000-8000-0000000000d2";

    expect(applyCorrection(FULL_DRAFT, { doctorId: otherDoctor })).toEqual({
      ...FULL_DRAFT,
      doctorId: otherDoctor,
      slotStart: undefined,
    });
  });

  it("clears only the slot when the date or time changes", () => {
    expect(applyCorrection(FULL_DRAFT, { preferredDate: "2026-11-05" })).toEqual({
      ...FULL_DRAFT,
      preferredDate: "2026-11-05",
      slotStart: undefined,
    });
    expect(applyCorrection(FULL_DRAFT, { preferredTime: "afternoon" })).toEqual({
      ...FULL_DRAFT,
      preferredTime: "afternoon",
      slotStart: undefined,
    });
  });

  it("keeps everything when the values are unchanged", () => {
    expect(
      applyCorrection(FULL_DRAFT, { specialtyId: SPECIALTY_ID, doctorId: DOCTOR_ID }),
    ).toEqual(FULL_DRAFT);
  });

  it("updates the reason without clearing anything", () => {
    expect(applyCorrection(FULL_DRAFT, { reason: "Check-up" })).toEqual({
      ...FULL_DRAFT,
      reason: "Check-up",
    });
  });
});

describe("service visits (PAY-07)", () => {
  const SERVICE_ID = "00000000-0000-4000-8000-0000000c0001";

  it("drops the chosen services when the patient picks a specialty instead", () => {
    const draft: BookingDraft = { serviceIds: [SERVICE_ID], slotStart: "2026-11-03T01:00:00.000Z" };
    expect(applyCorrection(draft, { specialtyId: SPECIALTY_ID }).serviceIds).toBeUndefined();
  });

  it("accepts the service events only from their own steps", () => {
    expect(acceptsEvent("choosing_specialty", "select_service_kind")).toBe(true);
    expect(acceptsEvent("choosing_services", "select_services")).toBe(true);
    expect(acceptsEvent("choosing_slot", "select_services")).toBe(false);
    expect(acceptsEvent("awaiting_confirmation", "select_service_kind")).toBe(false);
  });

  it("keeps at most five services in a stored draft", () => {
    const ids = Array.from({ length: 6 }, (_, index) => `00000000-0000-4000-8000-0000000c000${index}`);
    expect(parseBookingState({ step: "choosing_slot", draft: { serviceIds: ids } })).toEqual(IDLE_STATE);
  });
});
