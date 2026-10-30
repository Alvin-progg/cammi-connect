// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "@/lib/chat/schemas";
import { NOT_AVAILABLE_YET } from "@/lib/chat/safety";
import type { PatientApiAccess } from "@/server/auth/dal";
import { ProviderError } from "@/server/ai/http";
import type { GenerateInput } from "@/server/ai/opencode-zen";
import {
  CHAT_RATE_LIMIT_PER_MINUTE,
  handleChatRequest,
  type ChatHandlerDeps,
  type ChatLogEntry,
  type ChatStore,
  type NewChatMessage,
} from "@/server/chat/handler";

vi.mock("server-only", () => ({}));

const PATIENT = { id: "00000000-0000-4000-8000-000000000201", fullName: "Ana Cruz" };
const OWN_CONVERSATION_ID = "00000000-0000-4000-8000-00000000c001";
const NEW_CONVERSATION_ID = "00000000-0000-4000-8000-00000000c999";
const REQUEST_ID = "00000000-0000-4000-8000-0000000000e1";
const NOW = new Date("2026-10-30T01:00:00Z");
const SECRET_TEXT = "my private symptom details";

function fakeStore(): ChatStore {
  return {
    getConversation: vi.fn(async (patientId: string, conversationId: string) =>
      patientId === PATIENT.id && conversationId === OWN_CONVERSATION_ID
        ? { id: OWN_CONVERSATION_ID, title: "Earlier chat", updatedAt: NOW.toISOString() }
        : null,
    ),
    listMessages: vi.fn(async (): Promise<ChatMessage[]> => [
      { id: "m1", role: "user", content: "Hi", createdAt: NOW.toISOString() },
      { id: "m2", role: "assistant", content: "Hello", createdAt: NOW.toISOString() },
    ]),
    countRecentUserMessages: vi.fn(async () => 0),
    createConversation: vi.fn(async () => {}),
    appendMessages: vi.fn(async (_conversationId: string, messages: NewChatMessage[]) =>
      messages.map((message, index) => ({
        id: `saved-${index}`,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      })),
    ),
  };
}

let store: ChatStore;
let deps: ChatHandlerDeps;
let logged: ChatLogEntry[];

beforeEach(() => {
  store = fakeStore();
  logged = [];
  let nextId = 0;
  deps = {
    resolvePatient: vi.fn(
      async (): Promise<PatientApiAccess> => ({ status: "ok", patient: PATIENT }),
    ),
    store,
    generate: vi
      .fn<(input: GenerateInput) => Promise<string>>()
      .mockResolvedValue(JSON.stringify({ intent: "book" })),
    now: () => NOW,
    newId: () => (nextId++ === 0 ? REQUEST_ID : NEW_CONVERSATION_ID),
    log: (entry) => logged.push(entry),
  };
});

function chatRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function messageBody(text: string, conversationId?: string) {
  return { ...(conversationId ? { conversationId } : {}), event: { type: "message", text } };
}

describe("handleChatRequest", () => {
  it("returns 401 for an anonymous request and never calls the provider", async () => {
    vi.mocked(deps.resolvePatient).mockResolvedValue({ status: "unauthenticated" });

    const response = await handleChatRequest(chatRequest(messageBody("Hi")), deps);

    expect(response.status).toBe(401);
    expect(deps.generate).not.toHaveBeenCalled();
    expect(store.appendMessages).not.toHaveBeenCalled();
  });

  it("returns 403 for a signed-in non-patient", async () => {
    vi.mocked(deps.resolvePatient).mockResolvedValue({ status: "forbidden" });

    const response = await handleChatRequest(chatRequest(messageBody("Hi")), deps);

    expect(response.status).toBe(403);
    expect(deps.generate).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that is not JSON", async () => {
    const response = await handleChatRequest(chatRequest("{not json"), deps);

    expect(response.status).toBe(400);
    expect(deps.generate).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty message", messageBody("   ")],
    ["a message over 1000 characters", messageBody("a".repeat(1001))],
    ["an unknown event type", { event: { type: "confirm_booking" } }],
    ["a malformed conversation ID", messageBody("Hi", "not-a-uuid")],
  ])("returns 422 for %s", async (_label, body) => {
    const response = await handleChatRequest(chatRequest(body), deps);

    expect(response.status).toBe(422);
    expect(deps.generate).not.toHaveBeenCalled();
  });

  it("returns 404 for another patient's conversation without revealing it exists", async () => {
    const foreignId = "00000000-0000-4000-8000-00000000c002";

    const response = await handleChatRequest(
      chatRequest(messageBody("Hi", foreignId)),
      deps,
    );

    expect(response.status).toBe(404);
    expect(store.getConversation).toHaveBeenCalledWith(PATIENT.id, foreignId);
    expect(store.listMessages).not.toHaveBeenCalled();
    expect(deps.generate).not.toHaveBeenCalled();
  });

  it("returns 429 once the patient has sent the per-minute limit", async () => {
    vi.mocked(store.countRecentUserMessages).mockResolvedValue(CHAT_RATE_LIMIT_PER_MINUTE);

    const response = await handleChatRequest(chatRequest(messageBody("Hi")), deps);

    expect(response.status).toBe(429);
    expect(CHAT_RATE_LIMIT_PER_MINUTE).toBe(10);
    expect(store.countRecentUserMessages).toHaveBeenCalledWith(
      PATIENT.id,
      new Date(NOW.getTime() - 60_000),
    );
    expect(deps.generate).not.toHaveBeenCalled();
  });

  it("allows the message just under the limit", async () => {
    vi.mocked(store.countRecentUserMessages).mockResolvedValue(
      CHAT_RATE_LIMIT_PER_MINUTE - 1,
    );

    const response = await handleChatRequest(chatRequest(messageBody("Hi")), deps);

    expect(response.status).toBe(200);
  });

  it("returns 503 and persists nothing when the provider is down", async () => {
    vi.mocked(deps.generate).mockRejectedValue(
      new ProviderError("opencode-zen", "unavailable", 503),
    );

    const response = await handleChatRequest(chatRequest(messageBody("Hi")), deps);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error.message).toMatch(/try again/i);
    expect(store.createConversation).not.toHaveBeenCalled();
    expect(store.appendMessages).not.toHaveBeenCalled();
  });

  it("returns 503 when the database is unavailable", async () => {
    vi.mocked(store.countRecentUserMessages).mockRejectedValue(
      new Error("Unable to count chat messages."),
    );

    const response = await handleChatRequest(chatRequest(messageBody("Hi")), deps);

    expect(response.status).toBe(503);
  });

  it("starts a new conversation and persists both messages in order", async () => {
    const response = await handleChatRequest(
      chatRequest(messageBody("  I want to book a cardiologist  ")),
      deps,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(store.createConversation).toHaveBeenCalledWith({
      id: NEW_CONVERSATION_ID,
      patientId: PATIENT.id,
      title: "I want to book a cardiologist",
    });
    expect(deps.generate).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: NEW_CONVERSATION_ID }),
    );

    const [conversationId, messages] = vi.mocked(store.appendMessages).mock.calls[0];
    expect(conversationId).toBe(NEW_CONVERSATION_ID);
    expect(messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(messages[0].content).toBe("I want to book a cardiologist");
    expect(messages[1].content).toBe(NOT_AVAILABLE_YET);
    expect(messages[1].createdAt.getTime()).toBeGreaterThan(messages[0].createdAt.getTime());

    expect(body).toEqual({
      conversationId: NEW_CONVERSATION_ID,
      messages: [
        expect.objectContaining({ role: "user", content: "I want to book a cardiologist" }),
        expect.objectContaining({ role: "assistant", content: NOT_AVAILABLE_YET }),
      ],
      state: null,
      requestId: REQUEST_ID,
    });
  });

  it("truncates a long first message for the conversation title", async () => {
    await handleChatRequest(chatRequest(messageBody("x".repeat(200))), deps);

    const [{ title }] = vi.mocked(store.createConversation).mock.calls[0];
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("…")).toBe(true);
  });

  it("continues an owned conversation with its history", async () => {
    const response = await handleChatRequest(
      chatRequest(messageBody("Next question", OWN_CONVERSATION_ID)),
      deps,
    );

    expect(response.status).toBe(200);
    expect(store.createConversation).not.toHaveBeenCalled();
    expect(store.listMessages).toHaveBeenCalledWith(OWN_CONVERSATION_ID);
    expect(deps.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: OWN_CONVERSATION_ID,
        messages: [
          { role: "user", content: "Hi" },
          { role: "assistant", content: "Hello" },
          { role: "user", content: "Next question" },
        ],
      }),
    );
    expect(vi.mocked(store.appendMessages).mock.calls[0][0]).toBe(OWN_CONVERSATION_ID);
  });

  it("never logs message text", async () => {
    const consoleSpies = [
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "info").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
    ];

    await handleChatRequest(chatRequest(messageBody(SECRET_TEXT)), deps);
    vi.mocked(deps.generate).mockRejectedValue(
      new ProviderError("opencode-zen", "timeout"),
    );
    await handleChatRequest(chatRequest(messageBody(SECRET_TEXT)), deps);

    const everything = JSON.stringify([
      logged,
      ...consoleSpies.map((spy) => spy.mock.calls),
    ]);
    expect(everything).not.toContain(SECRET_TEXT);
    expect(logged.map((entry) => entry.status)).toEqual([200, 503]);
    consoleSpies.forEach((spy) => spy.mockRestore());
  });
});
