import { z } from "zod";

export const MESSAGE_MAX_LENGTH = 1000;

/**
 * Events a patient can send in one chat turn. S1 only has free-text messages;
 * later slices add booking events (select a slot, confirm, cancel).
 */
export const chatEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    text: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH),
  }),
]);

export type ChatEvent = z.infer<typeof chatEventSchema>;

export const chatRequestSchema = z.object({
  conversationId: z.uuid().optional(),
  event: chatEventSchema,
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

/**
 * What the LLM may return when it classifies a message. Details are optional
 * and may come back as null; they are hints for later slices and are always
 * resolved against database rows before use.
 */
export const intentExtractionSchema = z.object({
  intent: z.enum(CHAT_INTENTS),
  specialtyName: z.string().nullish(),
  doctorName: z.string().nullish(),
  preferredDate: z.string().nullish(),
  preferredTime: z.string().nullish(),
  reason: z.string().nullish(),
  urgent: z.boolean().nullish(),
});

export type IntentExtraction = z.infer<typeof intentExtractionSchema>;

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};
