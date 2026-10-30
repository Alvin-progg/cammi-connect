import "server-only";

import type { ChatMessage, ConversationSummary } from "@/lib/chat/schemas";
import { getSupabaseAdminClient } from "@/server/db/admin-client";
import type { Database } from "@/server/db/database.types";

import type { ChatStore, NewChatMessage } from "./handler";
import type { ChatViewStore } from "./service";

type ConversationRow = Pick<
  Database["public"]["Tables"]["chat_conversations"]["Row"],
  "id" | "title" | "updated_at"
>;
type MessageRow = Pick<
  Database["public"]["Tables"]["chat_messages"]["Row"],
  "id" | "role" | "content" | "created_at"
>;

const CONVERSATION_COLUMNS = "id, title, updated_at";
const MESSAGE_COLUMNS = "id, role, content, created_at";
const CONVERSATION_LIST_LIMIT = 50;

function toConversation(row: ConversationRow): ConversationSummary {
  return { id: row.id, title: row.title, updatedAt: row.updated_at };
}

function toMessage(row: MessageRow): ChatMessage {
  return { id: row.id, role: row.role, content: row.content, createdAt: row.created_at };
}

/**
 * Chat persistence through the service-role client. Every conversation query
 * is filtered by the patient ID from the session; message queries are only
 * reached after the conversation's ownership has been checked.
 */
export const supabaseChatRepository: ChatStore & ChatViewStore = {
  async getConversation(patientId, conversationId) {
    const { data, error } = await getSupabaseAdminClient()
      .from("chat_conversations")
      .select(CONVERSATION_COLUMNS)
      .eq("id", conversationId)
      .eq("patient_id", patientId)
      .maybeSingle();
    if (error) {
      throw new Error("Unable to load the conversation.");
    }
    return data ? toConversation(data) : null;
  },

  async listConversations(patientId) {
    const { data, error } = await getSupabaseAdminClient()
      .from("chat_conversations")
      .select(CONVERSATION_COLUMNS)
      .eq("patient_id", patientId)
      .order("updated_at", { ascending: false })
      .limit(CONVERSATION_LIST_LIMIT);
    if (error) {
      throw new Error("Unable to load conversations.");
    }
    return (data ?? []).map(toConversation);
  },

  async listMessages(conversationId) {
    const { data, error } = await getSupabaseAdminClient()
      .from("chat_messages")
      .select(MESSAGE_COLUMNS)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) {
      throw new Error("Unable to load messages.");
    }
    return (data ?? []).map(toMessage);
  },

  async countRecentUserMessages(patientId, since) {
    const supabase = getSupabaseAdminClient();
    const sinceIso = since.toISOString();

    // Saving a turn bumps updated_at, so only conversations touched inside
    // the window can hold recent messages. This keeps the ID list short.
    const { data: conversations, error: conversationError } = await supabase
      .from("chat_conversations")
      .select("id")
      .eq("patient_id", patientId)
      .gte("updated_at", sinceIso);
    if (conversationError) {
      throw new Error("Unable to count chat messages.");
    }
    const conversationIds = (conversations ?? []).map((row) => row.id);
    if (conversationIds.length === 0) {
      return 0;
    }

    const { count, error } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", conversationIds)
      .eq("role", "user")
      .gte("created_at", sinceIso);
    if (error) {
      throw new Error("Unable to count chat messages.");
    }
    return count ?? 0;
  },

  async createConversation({ id, patientId, title }) {
    const { error } = await getSupabaseAdminClient()
      .from("chat_conversations")
      .insert({ id, patient_id: patientId, title });
    if (error) {
      throw new Error("Unable to create the conversation.");
    }
  },

  async appendMessages(conversationId, messages: NewChatMessage[]) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("chat_messages")
      .insert(
        messages.map((message) => ({
          conversation_id: conversationId,
          role: message.role,
          content: message.content,
          created_at: message.createdAt.toISOString(),
        })),
      )
      .select(MESSAGE_COLUMNS)
      .order("created_at", { ascending: true });
    if (error) {
      throw new Error("Unable to save messages.");
    }

    // The trigger sets updated_at to now(); the value sent here is replaced.
    const { error: touchError } = await supabase
      .from("chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);
    if (touchError) {
      throw new Error("Unable to update the conversation.");
    }

    return (data ?? []).map(toMessage);
  },
};
