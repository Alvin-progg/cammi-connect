import { z } from "zod";

export const MESSAGE_MAX_LENGTH = 1000;
/** Matches the chat_messages.content check in 0004_chat.sql. */
export const ASSISTANT_REPLY_MAX_LENGTH = 4000;

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
  // Matches the chat tools' name limit; longer output is not a real name.
  doctorName: z.string().max(200).nullish(),
  preferredDate: z.string().nullish(),
  preferredTime: z.string().nullish(),
  reason: z.string().nullish(),
  urgent: z.boolean().nullish(),
});

export type IntentExtraction = z.infer<typeof intentExtractionSchema>;

export type ChatRole = "user" | "assistant";

/**
 * Structured data shown with an assistant reply, stored in
 * chat_messages.payload. Sources are copied from knowledge_documents rows,
 * never from model output.
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
