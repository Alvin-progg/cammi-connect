"use server";

import { revalidatePath } from "next/cache";

import { conversationIdSchema, setConversationPinnedSchema } from "@/lib/chat/schemas";
import { getPatientSession } from "@/server/auth/dal";

import { supabaseChatRepository } from "./repository";
import { deleteConversation, setConversationPinned } from "./service";

export type ConversationActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const NOT_FOUND_MESSAGE = "That conversation no longer exists.";

/** Pins or unpins one of the patient's conversations (sidebar pin button). */
export async function setConversationPinnedAction(
  _previous: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const session = await getPatientSession("/chat");
  if (!session) {
    return { status: "error", message: "Only patient accounts can pin conversations." };
  }

  const parsed = setConversationPinnedSchema.safeParse({
    conversationId: formData.get("conversationId"),
    pinned: formData.get("pinned") === "true",
  });
  if (!parsed.success) {
    return { status: "error", message: "Invalid conversation reference." };
  }

  const result = await setConversationPinned(
    session.patient.id,
    parsed.data.conversationId,
    parsed.data.pinned,
    supabaseChatRepository,
  );
  if (result.status === "not_found") {
    return { status: "error", message: NOT_FOUND_MESSAGE };
  }
  revalidatePath("/chat");
  return {
    status: "success",
    message: parsed.data.pinned ? "Conversation pinned." : "Conversation unpinned.",
  };
}

/** Permanently deletes one of the patient's conversations and its messages. */
export async function deleteConversationAction(
  _previous: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const session = await getPatientSession("/chat");
  if (!session) {
    return { status: "error", message: "Only patient accounts can delete conversations." };
  }

  const parsed = conversationIdSchema.safeParse(formData.get("conversationId"));
  if (!parsed.success) {
    return { status: "error", message: "Invalid conversation reference." };
  }

  const result = await deleteConversation(
    session.patient.id,
    parsed.data,
    supabaseChatRepository,
  );
  if (result.status === "not_found") {
    return { status: "error", message: NOT_FOUND_MESSAGE };
  }
  revalidatePath("/chat");
  return { status: "success", message: "Conversation deleted." };
}
