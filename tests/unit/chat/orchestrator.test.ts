// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  EMERGENCY_NOTICE,
  MEDICAL_ADVICE_DECLINE,
  NOT_AVAILABLE_YET,
  PLEASE_REPHRASE,
} from "@/lib/chat/safety";
import { ProviderError } from "@/server/ai/http";
import type { GenerateInput } from "@/server/ai/opencode-zen";
import { handleTurn } from "@/server/chat/orchestrator";

vi.mock("server-only", () => ({}));

const CONVERSATION_ID = "00000000-0000-4000-8000-00000000c001";

function generateReturning(reply: string) {
  return vi.fn<(input: GenerateInput) => Promise<string>>().mockResolvedValue(reply);
}

function turn(text: string, history: { role: "user" | "assistant"; content: string }[] = []) {
  return {
    conversationId: CONVERSATION_ID,
    history,
    event: { type: "message" as const, text },
  };
}

describe("handleTurn", () => {
  it("declines a medical-advice request without an emergency notice", async () => {
    const generate = generateReturning(JSON.stringify({ intent: "medical_advice" }));

    const result = await handleTurn(turn("I have a mild cough, what should I take?"), {
      generate,
    });

    expect(result.reply).toBe(MEDICAL_ADVICE_DECLINE);
    expect(result.reply).not.toContain(EMERGENCY_NOTICE);
  });

  it("adds the emergency notice when the model flags urgency", async () => {
    const generate = generateReturning(
      JSON.stringify({ intent: "medical_advice", urgent: true }),
    );

    const result = await handleTurn(turn("My father collapsed"), { generate });

    expect(result.reply).toContain(MEDICAL_ADVICE_DECLINE);
    expect(result.reply).toContain(EMERGENCY_NOTICE);
  });

  it("adds the emergency notice from the keyword check even when the model does not flag it", async () => {
    const generate = generateReturning(
      JSON.stringify({ intent: "medical_advice", urgent: false }),
    );

    const result = await handleTurn(turn("I have chest pain"), { generate });

    expect(result.reply).toContain(EMERGENCY_NOTICE);
  });

  it("adds the emergency notice for urgent keywords even under another intent", async () => {
    const generate = generateReturning(JSON.stringify({ intent: "book" }));

    const result = await handleTurn(
      turn("I need to book a doctor, I have chest pain right now"),
      { generate },
    );

    expect(result.reply).toContain(EMERGENCY_NOTICE);
  });

  it.each([
    "book",
    "doctor_inquiry",
    "service_inquiry",
    "appointment_status",
    "cancel",
    "reschedule",
    "other",
  ])("replies that %s is not available yet", async (intent) => {
    const generate = generateReturning(JSON.stringify({ intent }));

    const result = await handleTurn(turn("Hello"), { generate });

    expect(result.reply).toBe(NOT_AVAILABLE_YET);
  });

  it("asks the patient to rephrase when the model returns non-JSON", async () => {
    const generate = generateReturning("Sure! You want to book.");

    const result = await handleTurn(turn("book please"), { generate });

    expect(result.reply).toBe(PLEASE_REPHRASE);
  });

  it("asks the patient to rephrase when the JSON fails the schema", async () => {
    const generate = generateReturning(JSON.stringify({ intent: "diagnose_me" }));

    const result = await handleTurn(turn("book please"), { generate });

    expect(result.reply).toBe(PLEASE_REPHRASE);
  });

  it("accepts null optional details from the model", async () => {
    const generate = generateReturning(
      JSON.stringify({ intent: "book", doctorName: null, urgent: null }),
    );

    const result = await handleTurn(turn("book please"), { generate });

    expect(result.reply).toBe(NOT_AVAILABLE_YET);
  });

  it("requests JSON mode with the conversation ID as the session and sends only the chat text", async () => {
    const generate = generateReturning(JSON.stringify({ intent: "other" }));

    await handleTurn(
      turn("What time is it?", [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello" },
      ]),
      { generate },
    );

    const input = generate.mock.calls[0][0];
    expect(input.json).toBe(true);
    expect(input.sessionId).toBe(CONVERSATION_ID);
    expect(input.messages).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello" },
      { role: "user", content: "What time is it?" },
    ]);
    expect(input.systemPrompt).toContain("medical_advice");
  });

  it("sends at most the last 10 history messages", async () => {
    const generate = generateReturning(JSON.stringify({ intent: "other" }));
    const history = Array.from({ length: 14 }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `message ${index}`,
    }));

    await handleTurn(turn("latest", history), { generate });

    const sent = generate.mock.calls[0][0].messages;
    expect(sent).toHaveLength(11);
    expect(sent[0].content).toBe("message 4");
    expect(sent.at(-1)?.content).toBe("latest");
  });

  it("lets provider failures propagate", async () => {
    const generate = vi
      .fn<(input: GenerateInput) => Promise<string>>()
      .mockRejectedValue(new ProviderError("opencode-zen", "unavailable", 503));

    await expect(handleTurn(turn("Hello"), { generate })).rejects.toBeInstanceOf(
      ProviderError,
    );
  });
});
