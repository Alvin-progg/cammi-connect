import { z } from "zod";

/**
 * Steps of the server-owned booking flow (AI-APT-001). The step and draft are
 * stored in chat_conversations.booking_state and only the server moves them.
 */
export const BOOKING_STEPS = [
  "idle",
  "choosing_specialty",
  "choosing_doctor",
  // Path B: the named doctor has several specialties and the patient picks one.
  "choosing_doctor_specialty",
  "choosing_slot",
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
 * What the patient has chosen so far. Only database IDs and times are kept;
 * names shown to the patient are re-read from the database on every turn.
 */
export const bookingDraftSchema = z.object({
  specialtyId: z.uuid().optional(),
  doctorId: z.uuid().optional(),
  preferredDate: z.iso.date().optional(),
  preferredTime: z.string().max(50).optional(),
  slotStart: z.iso.datetime({ offset: true }).optional(),
  reason: z.string().max(BOOKING_REASON_MAX_LENGTH).optional(),
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
  | "cancel_booking";

const ACCEPTED_FROM: Record<BookingEventType, readonly BookingStep[]> = {
  select_specialty: ["choosing_specialty", "choosing_doctor_specialty"],
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
    "choosing_slot",
    "awaiting_confirmation",
    "failed",
  ],
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
  if (changed("doctorId") || changed("preferredDate") || changed("preferredTime")) {
    next.slotStart = undefined;
  }
  return next;
}
