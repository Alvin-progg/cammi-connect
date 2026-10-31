// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { ChatMessage, ConversationSummary } from "@/lib/chat/schemas";
import { loadChatView, type ChatViewStore } from "@/server/chat/service";

vi.mock("server-only", () => ({}));

const PATIENT_ID = "00000000-0000-4000-8000-000000000201";
const OWN: ConversationSummary = {
  id: "00000000-0000-4000-8000-00000000c001",
  title: "Earlier chat",
  updatedAt: "2026-10-30T01:00:00.000Z",
};
const MESSAGES: ChatMessage[] = [
  { id: "m1", role: "user", content: "Hi", payload: null, createdAt: "2026-10-30T01:00:00.000Z" },
];

function fakeStore(): ChatViewStore {
  return {
    listConversations: vi.fn(async () => [OWN]),
    getConversation: vi.fn(async (patientId: string, conversationId: string) =>
      patientId === PATIENT_ID && conversationId === OWN.id ? OWN : null,
    ),
    listMessages: vi.fn(async () => MESSAGES),
  };
}

describe("loadChatView", () => {
  it("starts a new chat when no conversation is requested", async () => {
    const store = fakeStore();

    await expect(loadChatView(PATIENT_ID, undefined, store)).resolves.toEqual({
      conversations: [OWN],
      conversationId: null,
      messages: [],
    });
    expect(store.listMessages).not.toHaveBeenCalled();
  });

  it("loads an owned conversation with its messages", async () => {
    const store = fakeStore();

    await expect(loadChatView(PATIENT_ID, OWN.id, store)).resolves.toEqual({
      conversations: [OWN],
      conversationId: OWN.id,
      messages: MESSAGES,
    });
  });

  it.each([
    ["another patient's conversation", "00000000-0000-4000-8000-00000000c002"],
    ["a malformed ID", "not-a-uuid"],
  ])("treats %s as a new chat", async (_label, requestedId) => {
    const store = fakeStore();

    const view = await loadChatView(PATIENT_ID, requestedId, store);

    expect(view.conversationId).toBeNull();
    expect(view.messages).toEqual([]);
    expect(store.listMessages).not.toHaveBeenCalled();
  });
});
