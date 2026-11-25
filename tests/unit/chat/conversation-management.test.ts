// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  deleteConversation,
  setConversationPinned,
  type ConversationManagementStore,
} from "@/server/chat/service";

vi.mock("server-only", () => ({}));

const PATIENT_ID = "00000000-0000-4000-8000-000000000201";
const OTHER_PATIENT_ID = "00000000-0000-4000-8000-000000000202";
const CONVERSATION_ID = "00000000-0000-4000-8000-00000000c001";

/** The fake only finds conversations that belong to PATIENT_ID, like the scoped queries. */
function fakeStore(): ConversationManagementStore {
  const owns = (patientId: string, conversationId: string) =>
    patientId === PATIENT_ID && conversationId === CONVERSATION_ID;
  return {
    setPinned: vi.fn(async (patientId: string, conversationId: string) =>
      owns(patientId, conversationId),
    ),
    deleteConversation: vi.fn(async (patientId: string, conversationId: string) =>
      owns(patientId, conversationId),
    ),
  };
}

describe("setConversationPinned", () => {
  it("pins a conversation owned by the patient", async () => {
    const store = fakeStore();

    await expect(
      setConversationPinned(PATIENT_ID, CONVERSATION_ID, true, store),
    ).resolves.toEqual({ status: "updated" });
    expect(store.setPinned).toHaveBeenCalledWith(PATIENT_ID, CONVERSATION_ID, true);
  });

  it("unpins a conversation owned by the patient", async () => {
    const store = fakeStore();

    await expect(
      setConversationPinned(PATIENT_ID, CONVERSATION_ID, false, store),
    ).resolves.toEqual({ status: "updated" });
    expect(store.setPinned).toHaveBeenCalledWith(PATIENT_ID, CONVERSATION_ID, false);
  });

  it("reports not_found for another patient's conversation without leaking it", async () => {
    const store = fakeStore();

    await expect(
      setConversationPinned(OTHER_PATIENT_ID, CONVERSATION_ID, true, store),
    ).resolves.toEqual({ status: "not_found" });
  });
});

describe("deleteConversation", () => {
  it("deletes a conversation owned by the patient", async () => {
    const store = fakeStore();

    await expect(deleteConversation(PATIENT_ID, CONVERSATION_ID, store)).resolves.toEqual({
      status: "deleted",
    });
    expect(store.deleteConversation).toHaveBeenCalledWith(PATIENT_ID, CONVERSATION_ID);
  });

  it("reports not_found for another patient's conversation and deletes nothing", async () => {
    const store = fakeStore();

    await expect(
      deleteConversation(OTHER_PATIENT_ID, CONVERSATION_ID, store),
    ).resolves.toEqual({ status: "not_found" });
  });
});
