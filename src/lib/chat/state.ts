import { z } from "zod";

import { privilegeChoiceSchema } from "@/lib/billing/compute";
import { MAX_SERVICES_PER_VISIT } from "@/lib/services/booking";

/**
 * Steps of the server-owned booking flow (AI-APT-001). The step and draft are
 * stored in chat_conversations.booking_state and only the server moves them.
 */
export const BOOKING_STEPS = [
  "idle",
  // AI-APT-002: medical advice was declined and a booking offered ([Yes, book]).
  "offering_booking",
  "choosing_specialty",
  "choosing_doctor",
  // Path B: the named doctor has several specialties and the patient picks one.
  "choosing_doctor_specialty",
  // PAY-07: picking lab tests, an imaging test, or a package; their dates or
  // times then use choosing_slot.
  "choosing_services",
  "choosing_slot",
  // PAY-03, only while payment.enabled: senior/PWD discount, then who pays.
  "choosing_privilege",
  "choosing_payer",
  "awaiting_confirmation",
  "booking",
  "booked",
  "failed",
  "cancelled",
] as const;

export type BookingStep = (typeof BOOKING_STEPS)[number];

/** Matches the appointment reason limit in src/lib/appointments/schemas.ts. */
export const BOOKING_REASON_MAX_LENGTH = 500;

/**
 * AI-APT-002: the routing details the LLM extracted from the patient's
 * concern, kept so the server can route on [Yes, book] or after the age
 * question without another model call. Candidates are only names; they are
 * matched against active specialties every time they are used.
 */
const careNeedSchema = z.object({
  specialtyCandidates: z.array(z.string().max(100)).max(2).optional(),
  routingConfidence: z.enum(["high", "low"]).optional(),
  age: z.number().int().min(0).max(130).optional(),
  forSomeoneElse: z.boolean().optional(),
});

export type CareNeed = z.infer<typeof careNeedSchema>;

/**
 * PAY-03: who pays. A self-paying patient pays by QR Ph or at the hospital
 * counter (decision D6, same deadline). The HMO is re-read from the active
 * list every time it is used.
 */
export const paymentChoiceSchema = z.discriminatedUnion("payer", [
  z.object({ payer: z.literal("self"), method: z.enum(["qr_ph", "counter"]) }),
  // BEN-05: a saved, verified membership the chosen doctor accepts (re-checked on booking).
  z.object({ payer: z.literal("hmo"), patientHmoId: z.uuid() }),
  z.object({ payer: z.literal("philhealth") }),
]);

export type PaymentChoice = z.infer<typeof paymentChoiceSchema>;

/**
 * What the patient has chosen so far. Only database IDs and times are kept;
 * names shown to the patient are re-read from the database on every turn.
 */
export const bookingDraftSchema = z.object({
  /**
   * PAY-07: a lab, imaging, or package visit instead of a consultation, in
   * the patient's order. slotStart is then the walk-in opening time or the
   * scheduled slot.
   */
  serviceIds: z.array(z.uuid()).min(1).max(MAX_SERVICES_PER_VISIT).optional(),
  specialtyId: z.uuid().optional(),
  doctorId: z.uuid().optional(),
  preferredDate: z.iso.date().optional(),
  preferredTime: z.string().max(50).optional(),
  slotStart: z.iso.datetime({ offset: true }).optional(),
  reason: z.string().max(BOOKING_REASON_MAX_LENGTH).optional(),
  careNeed: careNeedSchema.optional(),
  /** R5: the age question was already asked once in this booking. */
  ageAsked: z.boolean().optional(),
  privilege: privilegeChoiceSchema.optional(),
  payment: paymentChoiceSchema.optional(),
});

export type BookingDraft = z.infer<typeof bookingDraftSchema>;

export const bookingStateSchema = z.object({
  step: z.enum(BOOKING_STEPS),
  draft: bookingDraftSchema,
});

export type BookingState = z.infer<typeof bookingStateSchema>;

export const IDLE_STATE: BookingState = { step: "idle", draft: {} };

/** Stored state that no longer matches the schema starts over rather than failing the turn. */
export function parseBookingState(stored: unknown): BookingState {
  const parsed = bookingStateSchema.safeParse(stored);
  return parsed.success ? parsed.data : IDLE_STATE;
}

/** Card and button events; free-text messages are not step-gated. */
export type BookingEventType =
  | "select_specialty"
  | "select_doctor"
  | "more_slots"
  | "select_slot"
  | "confirm_booking"
  | "change_booking"
  | "cancel_booking"
  | "update_reason"
  | "accept_booking_offer"
  | "select_privilege"
  | "select_payer"
  | "select_service_kind"
  | "select_services";

const ACCEPTED_FROM: Record<BookingEventType, readonly BookingStep[]> = {
  // choosing_doctor: the routed doctor list offers an alternative specialty.
  select_specialty: [
    "choosing_specialty",
    "choosing_doctor_specialty",
    "choosing_doctor",
    "choosing_services",
  ],
  // choosing_services: the patient switched from a service back to a consultation.
  // choosing_slot and failed offer other doctors of the same specialty.
  select_doctor: ["choosing_doctor", "choosing_slot", "failed"],
  more_slots: ["choosing_slot", "failed"],
  select_slot: ["choosing_slot", "failed"],
  confirm_booking: ["awaiting_confirmation"],
  change_booking: ["choosing_doctor", "choosing_slot", "awaiting_confirmation", "failed"],
  cancel_booking: [
    "choosing_specialty",
    "choosing_doctor",
    "choosing_doctor_specialty",
    "choosing_services",
    "choosing_slot",
    "choosing_privilege",
    "choosing_payer",
    "awaiting_confirmation",
    "failed",
  ],
  update_reason: ["awaiting_confirmation"],
  accept_booking_offer: ["offering_booking"],
  select_privilege: ["choosing_privilege"],
  select_payer: ["choosing_payer"],
  select_service_kind: ["choosing_specialty", "choosing_services"],
  select_services: ["choosing_services"],
};

/** Rejects events that would skip a step, such as Confirm before a slot is chosen. */
export function acceptsEvent(step: BookingStep, event: BookingEventType): boolean {
  return ACCEPTED_FROM[event].includes(step);
}

/**
 * Applies a typed correction, clearing only the choices that depend on what
 * changed: a new specialty clears the doctor and slot, a new doctor clears
 * the slot, and a new date or time clears the slot.
 */
export function applyCorrection(
  draft: BookingDraft,
  changes: Partial<BookingDraft>,
): BookingDraft {
  const next: BookingDraft = { ...draft, ...changes };
  const changed = (field: keyof BookingDraft) =>
    field in changes && changes[field] !== draft[field];

  if (changed("specialtyId")) {
    next.doctorId = changes.doctorId;
    next.slotStart = undefined;
  }
  // A consultation and a service visit never share a draft (PAY-07).
  if ((changed("specialtyId") || changed("doctorId")) && !("serviceIds" in changes)) {
    next.serviceIds = undefined;
  }
  if (changed("doctorId") || changed("preferredDate") || changed("preferredTime")) {
    next.slotStart = undefined;
  }
  return next;
}
