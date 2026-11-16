import { z } from "zod";

import { APPOINTMENT_STATUSES } from "@/lib/appointments/status";
import { BOOKING_REASON_MAX_LENGTH } from "@/lib/chat/state";

export const MESSAGE_MAX_LENGTH = 1000;
/** Matches the chat_messages.content check in 0004_chat.sql. */
export const ASSISTANT_REPLY_MAX_LENGTH = 4000;

/**
 * Events a patient can send in one chat turn: free text, or a booking or
 * appointment card action. Card IDs are only references; the server re-reads every one from
 * the database before using it.
 */
export const chatEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    text: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH),
  }),
  z.object({ type: z.literal("select_specialty"), specialtyId: z.uuid() }),
  z.object({ type: z.literal("select_doctor"), doctorId: z.uuid() }),
  z.object({ type: z.literal("more_slots"), fromDate: z.iso.date() }),
  z.object({ type: z.literal("select_slot"), start: z.iso.datetime({ offset: true }) }),
  z.object({ type: z.literal("confirm_booking") }),
  z.object({
    type: z.literal("change_booking"),
    field: z.enum(["specialty", "doctor", "slot"]),
  }),
  z.object({ type: z.literal("cancel_booking") }),
  // AI-APT-002: edit the reason for visit on the summary, and accept the booking offer.
  z.object({
    type: z.literal("update_reason"),
    reason: z.string().trim().min(1).max(BOOKING_REASON_MAX_LENGTH),
  }),
  z.object({ type: z.literal("accept_booking_offer") }),
  z.object({ type: z.literal("request_cancellation"), appointmentId: z.uuid() }),
  z.object({ type: z.literal("confirm_cancellation"), appointmentId: z.uuid() }),
]);

export type ChatEvent = z.infer<typeof chatEventSchema>;

export type CardEvent = Exclude<ChatEvent, { type: "message" }>;

export type AppointmentEvent = Extract<
  ChatEvent,
  { type: "request_cancellation" | "confirm_cancellation" }
>;

export type BookingEvent = Exclude<CardEvent, AppointmentEvent>;

export const chatRequestSchema = z
  .object({
    conversationId: z.uuid().optional(),
    event: chatEventSchema,
  })
  // Card actions are only shown inside an existing conversation.
  .refine((request) => request.event.type === "message" || request.conversationId !== undefined, {
    path: ["conversationId"],
  });

export const CHAT_INTENTS = [
  "book",
  "doctor_inquiry",
  "service_inquiry",
  "appointment_status",
  "cancel",
  "reschedule",
  "medical_advice",
  "other",
] as const;

export type ChatIntent = (typeof CHAT_INTENTS)[number];

/** Up to `max` names, highest ranked first; a malformed list counts as none. */
const rankedNames = (max: number) =>
  z
    .array(z.string().max(100))
    .nullish()
    .catch(null)
    .transform((names) => names?.slice(0, max) ?? null);

/**
 * What the LLM may return when it classifies a message. Details are optional
 * and may come back as null; they are hints that are always resolved against
 * database rows before use. The AI-APT-002 care-need fields fall back to null
 * when malformed, so a bad routing hint never fails the whole turn.
 */
export const intentExtractionSchema = z.object({
  intent: z.enum(CHAT_INTENTS),
  specialtyName: z.string().nullish(),
  // Matches the chat tools' name limit; longer output is not a real name.
  doctorName: z.string().max(200).nullish(),
  preferredDate: z.string().nullish(),
  preferredTime: z.string().nullish(),
  reason: z.string().nullish(),
  urgent: z.boolean().nullish(),
  /** The patient's concern in their own words; becomes the editable reason for visit. */
  concern: z.string().nullish().catch(null),
  age: z.number().int().min(0).max(130).nullish().catch(null),
  forSomeoneElse: z.boolean().nullish().catch(null),
  /** Names from the active specialty list in the prompt; the server drops anything else. */
  specialtyCandidates: rankedNames(2),
  /** PAY-001: parsed but not routed yet. */
  serviceCandidates: rankedNames(3),
  routingConfidence: z.enum(["high", "low"]).nullish().catch(null),
});

export type IntentExtraction = z.infer<typeof intentExtractionSchema>;

export type ChatRole = "user" | "assistant";

const timeSlotSchema = z.object({ start: z.string(), end: z.string() });

const doctorOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  departmentName: z.string().nullable(),
  specialties: z.array(z.string()),
});

export type DoctorOption = z.infer<typeof doctorOptionSchema>;

/**
 * Structured data shown with an assistant reply, stored in
 * chat_messages.payload. Sources are copied from knowledge_documents rows,
 * booking cards from directory and availability rows, and appointment cards
 * from the patient's appointment rows, never from model output.
 */
export const chatMessagePayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("sources"),
    sources: z
      .array(
        z.object({
          slug: z.string(),
          title: z.string(),
          sectionTitle: z.string().nullable(),
        }),
      )
      .min(1),
  }),
  z.object({ kind: z.literal("not_verified") }),
  z.object({
    kind: z.literal("specialty_options"),
    specialties: z.array(z.object({ id: z.string(), name: z.string() })).min(1),
  }),
  z.object({
    kind: z.literal("doctor_options"),
    doctors: z.array(doctorOptionSchema).min(1),
    /** AI-APT-002: Cami picked the specialty, so the patient can change it in one tap. */
    changeSpecialty: z.boolean().optional(),
    alternative: z.object({ id: z.string(), name: z.string() }).optional(),
  }),
  z.object({ kind: z.literal("book_offer") }),
  z.object({
    kind: z.literal("slot_picker"),
    doctorName: z.string(),
    /** Slots grouped by Manila date ("YYYY-MM-DD"); empty when the window has none. */
    days: z.array(z.object({ date: z.string(), slots: z.array(timeSlotSchema).min(1) })),
    /** Start of the next window, or null at the booking horizon. */
    nextFromDate: z.string().nullable(),
    /** Other doctors of the same specialty, offered when the window is empty. */
    alternatives: z.array(doctorOptionSchema),
  }),
  z.object({
    kind: z.literal("booking_summary"),
    doctorName: z.string(),
    specialtyName: z.string().nullable(),
    start: z.string(),
    end: z.string(),
    reason: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("booking_result"),
    doctorName: z.string(),
    start: z.string(),
    end: z.string(),
  }),
  z.object({
    kind: z.literal("appointments"),
    /** The patient's upcoming requested or confirmed appointments, soonest first. */
    items: z
      .array(
        z.object({
          id: z.string(),
          doctorName: z.string(),
          departmentName: z.string().nullable(),
          start: z.string(),
          durationMinutes: z.number(),
          status: z.enum(APPOINTMENT_STATUSES),
        }),
      )
      .min(1),
  }),
  z.object({
    kind: z.literal("cancel_confirmation"),
    appointmentId: z.string(),
    doctorName: z.string(),
    start: z.string(),
  }),
  z.object({
    kind: z.literal("cancel_result"),
    doctorName: z.string(),
    start: z.string(),
  }),
]);

export type ChatMessagePayload = z.infer<typeof chatMessagePayloadSchema>;

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  payload: ChatMessagePayload | null;
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};
