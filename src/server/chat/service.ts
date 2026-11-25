import "server-only";

import { z } from "zod";

import type { ChatMessage, ConversationSummary } from "@/lib/chat/schemas";

import type { ChatStore } from "./handler";

export type ChatViewStore = Pick<ChatStore, "getConversation" | "listMessages"> & {
  listConversations(patientId: string): Promise<ConversationSummary[]>;
};

export type ChatView = {
  conversations: ConversationSummary[];
  conversationId: string | null;
  messages: ChatMessage[];
};

/**
 * Loads the /chat page for one patient. A requested conversation that is
 * malformed or belongs to someone else opens as a new chat, so the URL can
 * never reveal whether another patient's conversation exists.
 */
export async function loadChatView(
  patientId: string,
  requestedId: string | undefined,
  store: ChatViewStore,
): Promise<ChatView> {
  const conversations = await store.listConversations(patientId);

  const validId = z.uuid().safeParse(requestedId);
  const conversation = validId.success
    ? await store.getConversation(patientId, validId.data)
    : null;
  if (!conversation) {
    return { conversations, conversationId: null, messages: [] };
  }

  return {
    conversations,
    conversationId: conversation.id,
    messages: await store.listMessages(conversation.id),
  };
}

/**
 * Pin and delete act on rows the patient owns. The store scopes both writes by
 * patient ID, so another patient's conversation reports `not_found`, the same
 * as a missing one.
 */
export type ConversationManagementStore = {
  setPinned(patientId: string, conversationId: string, pinned: boolean): Promise<boolean>;
  deleteConversation(patientId: string, conversationId: string): Promise<boolean>;
};

export type ConversationMutationResult = { status: "updated" | "deleted" } | { status: "not_found" };

export async function setConversationPinned(
  patientId: string,
  conversationId: string,
  pinned: boolean,
  store: ConversationManagementStore,
): Promise<ConversationMutationResult> {
  const updated = await store.setPinned(patientId, conversationId, pinned);
  return updated ? { status: "updated" } : { status: "not_found" };
}

export async function deleteConversation(
  patientId: string,
  conversationId: string,
  store: ConversationManagementStore,
): Promise<ConversationMutationResult> {
  const deleted = await store.deleteConversation(patientId, conversationId);
  return deleted ? { status: "deleted" } : { status: "not_found" };
}
