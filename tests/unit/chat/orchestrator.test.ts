// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { ASSISTANT_REPLY_MAX_LENGTH } from "@/lib/chat/schemas";
import {
  EMERGENCY_NOTICE,
  MEDICAL_ADVICE_DECLINE,
  NOT_AVAILABLE_YET,
  NOT_VERIFIED,
  PLEASE_REPHRASE,
} from "@/lib/chat/safety";
import { IDLE_STATE } from "@/lib/chat/state";
import type { Department, DoctorSummary, Specialty } from "@/lib/directory/types";
import { ProviderError } from "@/server/ai/http";
import type { GenerateInput } from "@/server/ai/opencode-zen";
import { handleTurn, type TurnDeps } from "@/server/chat/orchestrator";
import type { ChatTools, DoctorLookup } from "@/server/chat/tools";
import type { KnowledgeSearchResult } from "@/server/knowledge/service";

vi.mock("server-only", () => ({}));

const CONVERSATION_ID = "00000000-0000-4000-8000-00000000c001";
const PATIENT_ID = "00000000-0000-4000-8000-000000000201";
const NOW = new Date("2026-10-31T01:00:00Z");

function generateReturning(reply: string) {
  return vi.fn<(input: GenerateInput) => Promise<string>>().mockResolvedValue(reply);
}

const CARDIOLOGY: Department = {
  id: "dep1",
  name: "Cardiology",
  code: "CARD",
  description: null,
  isActive: true,
};
const PEDIATRICS_SPECIALTY: Specialty = {
  id: "sp1",
  name: "General Pediatrics",
  description: null,
  isActive: true,
};
const MAYA: DoctorSummary = {
  id: "d1",
  fullName: "Maya Santos",
  departmentId: "dep1",
  departmentName: "Cardiology",
  isActive: true,
  specialties: [{ id: "sp2", name: "Interventional Cardiology" }],
};

function fakeTools(): ChatTools {
  return {
    getDepartments: vi.fn(async () => [CARDIOLOGY]),
    getSpecialties: vi.fn(async () => [PEDIATRICS_SPECIALTY]),
    getDoctorDetails: vi.fn(async (): Promise<DoctorLookup> => ({ status: "unknown" })),
    getDoctor: vi.fn(async () => null),
    getDoctorsBySpecialty: vi.fn(async () => []),
    getDoctorAvailability: vi.fn(async () => []),
    createAppointment: vi.fn(async () => ({ ok: false as const, message: "unused" })),
  };
}

function turnDeps(
  generate: TurnDeps["generate"],
  overrides: Partial<Omit<TurnDeps, "generate">> = {},
): TurnDeps {
  return {
    generate,
    searchKnowledge: vi.fn(async (): Promise<KnowledgeSearchResult> => ({ found: false })),
    tools: fakeTools(),
    claimBooking: vi.fn(async () => true),
    ...overrides,
  };
}

function turn(text: string, history: { role: "user" | "assistant"; content: string }[] = []) {
  return {
    conversationId: CONVERSATION_ID,
    patientId: PATIENT_ID,
    history,
    event: { type: "message" as const, text },
    state: IDLE_STATE,
    now: NOW,
  };
}

describe("handleTurn", () => {
  it("declines a medical-advice request without an emergency notice", async () => {
    const generate = generateReturning(JSON.stringify({ intent: "medical_advice" }));

    const result = await handleTurn(turn("I have a mild cough, what should I take?"), turnDeps(generate));

    expect(result.reply).toBe(MEDICAL_ADVICE_DECLINE);
    expect(result.reply).not.toContain(EMERGENCY_NOTICE);
  });

  it("adds the emergency notice when the model flags urgency", async () => {
    const generate = generateReturning(
      JSON.stringify({ intent: "medical_advice", urgent: true }),
    );

    const result = await handleTurn(turn("My father collapsed"), turnDeps(generate));

    expect(result.reply).toContain(MEDICAL_ADVICE_DECLINE);
    expect(result.reply).toContain(EMERGENCY_NOTICE);
  });

  it("adds the emergency notice from the keyword check even when the model does not flag it", async () => {
    const generate = generateReturning(
      JSON.stringify({ intent: "medical_advice", urgent: false }),
    );

    const result = await handleTurn(turn("I have chest pain"), turnDeps(generate));

    expect(result.reply).toContain(EMERGENCY_NOTICE);
  });

  it("adds the emergency notice for urgent keywords even under another intent", async () => {
    const generate = generateReturning(JSON.stringify({ intent: "book" }));

    const result = await handleTurn(
      turn("I need to book a doctor, I have chest pain right now"),
      turnDeps(generate),
    );

    expect(result.reply).toContain(EMERGENCY_NOTICE);
  });

  it.each([
    "appointment_status",
    "cancel",
    "reschedule",
    "other",
  ])("replies that %s is not available yet", async (intent) => {
    const generate = generateReturning(JSON.stringify({ intent }));

    const result = await handleTurn(turn("Hello"), turnDeps(generate));

    expect(result.reply).toBe(NOT_AVAILABLE_YET);
  });

  it("asks the patient to rephrase when the model returns non-JSON", async () => {
    const generate = generateReturning("Sure! You want to book.");

    const result = await handleTurn(turn("book please"), turnDeps(generate));

    expect(result.reply).toBe(PLEASE_REPHRASE);
  });

  it("asks the patient to rephrase when the JSON fails the schema", async () => {
    const generate = generateReturning(JSON.stringify({ intent: "diagnose_me" }));

    const result = await handleTurn(turn("book please"), turnDeps(generate));

    expect(result.reply).toBe(PLEASE_REPHRASE);
  });

  it("accepts null optional details from the model", async () => {
    const generate = generateReturning(
      JSON.stringify({ intent: "book", doctorName: null, specialtyName: null, urgent: null }),
    );

    const result = await handleTurn(turn("book please"), turnDeps(generate));

    expect(result.state.step).toBe("choosing_specialty");
  });

  it("saves the patient's own text and leaves the state alone for non-booking replies", async () => {
    const generate = generateReturning(JSON.stringify({ intent: "other" }));
    const input = turn("Hello");

    const result = await handleTurn(input, turnDeps(generate));

    expect(result.userContent).toBe("Hello");
    expect(result.state).toBe(input.state);
  });

  it("requests JSON mode with the conversation ID as the session and sends only the chat text", async () => {
    const generate = generateReturning(JSON.stringify({ intent: "other" }));

    await handleTurn(
      turn("What time is it?", [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello" },
      ]),
      turnDeps(generate),
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

    await handleTurn(turn("latest", history), turnDeps(generate));

    const sent = generate.mock.calls[0][0].messages;
    expect(sent).toHaveLength(11);
    expect(sent[0].content).toBe("message 4");
    expect(sent.at(-1)?.content).toBe("latest");
  });

  it("lets provider failures propagate", async () => {
    const generate = vi
      .fn<(input: GenerateInput) => Promise<string>>()
      .mockRejectedValue(new ProviderError("opencode-zen", "unavailable", 503));

    await expect(handleTurn(turn("Hello"), turnDeps(generate))).rejects.toBeInstanceOf(
      ProviderError,
    );
  });
});

describe("handleTurn service_inquiry", () => {
  const FOUND: KnowledgeSearchResult = {
    found: true,
    chunks: [
      {
        chunkId: "c1",
        slug: "required-documents",
        title: "Required Documents",
        sectionTitle: "Identification",
        content: "Bring a valid government ID.",
        similarity: 0.8,
      },
    ],
    sources: [
      { slug: "required-documents", title: "Required Documents", sectionTitle: "Identification" },
    ],
  };

  function inquiry() {
    return vi
      .fn<(input: GenerateInput) => Promise<string>>()
      .mockResolvedValueOnce(JSON.stringify({ intent: "service_inquiry" }))
      .mockResolvedValueOnce("Please bring a valid government ID.");
  }

  it("answers from retrieved context and attaches the database sources", async () => {
    const generate = inquiry();
    const searchKnowledge = vi.fn(async () => FOUND);

    const result = await handleTurn(
      turn("What should I bring?"),
      turnDeps(generate, { searchKnowledge }),
    );

    expect(searchKnowledge).toHaveBeenCalledWith("What should I bring?");
    expect(result).toEqual({
      reply: "Please bring a valid government ID.",
      payload: { kind: "sources", sources: FOUND.sources },
      state: IDLE_STATE,
      userContent: "What should I bring?",
    });
  });

  it("sends the question inside a delimited context to the grounded prompt", async () => {
    const generate = inquiry();

    await handleTurn(
      turn("What should I bring?"),
      turnDeps(generate, { searchKnowledge: vi.fn(async () => FOUND) }),
    );

    const answerCall = generate.mock.calls[1][0];
    expect(answerCall.json).toBeFalsy();
    expect(answerCall.sessionId).toBe(CONVERSATION_ID);
    expect(answerCall.systemPrompt).toMatch(/could not be verified/i);
    expect(answerCall.messages).toHaveLength(1);
    expect(answerCall.messages[0].content).toContain("<<<CONTEXT");
    expect(answerCall.messages[0].content).toContain("Bring a valid government ID.");
    expect(answerCall.messages[0].content).toContain("What should I bring?");
  });

  it("falls back without a second model call when nothing relevant is found", async () => {
    const generate = inquiry();

    const result = await handleTurn(turn("Parking at another hospital?"), turnDeps(generate));

    expect(result).toMatchObject({ reply: NOT_VERIFIED, payload: { kind: "not_verified" } });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("falls back when the model returns an empty answer", async () => {
    const generate = vi
      .fn<(input: GenerateInput) => Promise<string>>()
      .mockResolvedValueOnce(JSON.stringify({ intent: "service_inquiry" }))
      .mockResolvedValueOnce("   ");

    const result = await handleTurn(
      turn("What should I bring?"),
      turnDeps(generate, { searchKnowledge: vi.fn(async () => FOUND) }),
    );

    expect(result).toMatchObject({ reply: NOT_VERIFIED, payload: { kind: "not_verified" } });
  });

  it("clips an overlong answer to the stored message limit", async () => {
    const generate = vi
      .fn<(input: GenerateInput) => Promise<string>>()
      .mockResolvedValueOnce(JSON.stringify({ intent: "service_inquiry" }))
      .mockResolvedValueOnce("a".repeat(ASSISTANT_REPLY_MAX_LENGTH + 500));

    const result = await handleTurn(
      turn("What should I bring?"),
      turnDeps(generate, { searchKnowledge: vi.fn(async () => FOUND) }),
    );

    expect(result.reply.length).toBeLessThanOrEqual(ASSISTANT_REPLY_MAX_LENGTH);
  });

  it("lets a failure of the answer call propagate", async () => {
    const generate = vi
      .fn<(input: GenerateInput) => Promise<string>>()
      .mockResolvedValueOnce(JSON.stringify({ intent: "service_inquiry" }))
      .mockRejectedValueOnce(new ProviderError("opencode-zen", "timeout"));

    await expect(
      handleTurn(
        turn("What should I bring?"),
        turnDeps(generate, { searchKnowledge: vi.fn(async () => FOUND) }),
      ),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("still declines medical advice before searching", async () => {
    const generate = generateReturning(JSON.stringify({ intent: "service_inquiry" }));
    const searchKnowledge = vi.fn(async () => FOUND);

    const result = await handleTurn(
      turn("I can't breathe, what services do you have?"),
      turnDeps(generate, { searchKnowledge }),
    );

    expect(result.reply).toContain(EMERGENCY_NOTICE);
    expect(searchKnowledge).not.toHaveBeenCalled();
  });
});

describe("handleTurn doctor_inquiry", () => {
  it("lists active departments and specialties from the database without RAG or a second model call", async () => {
    const generate = generateReturning(JSON.stringify({ intent: "doctor_inquiry" }));
    const deps = turnDeps(generate);

    const result = await handleTurn(turn("Which departments do you have?"), deps);

    expect(result.reply).toContain("Cardiology");
    expect(result.reply).toContain("General Pediatrics");
    expect(result.payload).toBeNull();
    expect(deps.searchKnowledge).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("describes a named doctor from the database", async () => {
    const generate = generateReturning(
      JSON.stringify({ intent: "doctor_inquiry", doctorName: "Dr. Maya Santos" }),
    );
    const tools = fakeTools();
    vi.mocked(tools.getDoctorDetails).mockResolvedValue({ status: "found", doctor: MAYA });

    const result = await handleTurn(turn("Tell me about Dr. Maya Santos"), turnDeps(generate, { tools }));

    expect(tools.getDoctorDetails).toHaveBeenCalledWith({ doctorName: "Dr. Maya Santos" });
    expect(result.reply).toContain("Dr. Maya Santos");
    expect(result.reply).toContain("Cardiology");
    expect(result.reply).toContain("Interventional Cardiology");
  });

  it("lists the candidates when several doctors match", async () => {
    const generate = generateReturning(
      JSON.stringify({ intent: "doctor_inquiry", doctorName: "Dr. Santos" }),
    );
    const tools = fakeTools();
    vi.mocked(tools.getDoctorDetails).mockResolvedValue({
      status: "several",
      doctors: [MAYA, { ...MAYA, id: "d2", fullName: "José Santos" }],
    });

    const result = await handleTurn(turn("Is Dr. Santos in?"), turnDeps(generate, { tools }));

    expect(result.reply).toContain("Dr. Maya Santos");
    expect(result.reply).toContain("Dr. José Santos");
  });

  it("does not repeat a title already stored in the doctor's name", async () => {
    const generate = generateReturning(
      JSON.stringify({ intent: "doctor_inquiry", doctorName: "Maya Santos" }),
    );
    const tools = fakeTools();
    vi.mocked(tools.getDoctorDetails).mockResolvedValue({
      status: "found",
      doctor: { ...MAYA, fullName: "Dr. Maya Santos" },
    });

    const result = await handleTurn(turn("Who is Maya Santos?"), turnDeps(generate, { tools }));

    expect(result.reply).toContain("Dr. Maya Santos");
    expect(result.reply).not.toContain("Dr. Dr.");
  });

  it("treats a blank doctor name from the model as a general directory question", async () => {
    const generate = generateReturning(
      JSON.stringify({ intent: "doctor_inquiry", doctorName: "   " }),
    );
    const deps = turnDeps(generate);

    const result = await handleTurn(turn("Which doctors do you have?"), deps);

    expect(deps.tools.getDoctorDetails).not.toHaveBeenCalled();
    expect(result.reply).toContain("Cardiology");
  });

  it("asks to rephrase when the model returns an implausibly long doctor name", async () => {
    const generate = generateReturning(
      JSON.stringify({ intent: "doctor_inquiry", doctorName: "x".repeat(201) }),
    );
    const deps = turnDeps(generate);

    const result = await handleTurn(turn("Tell me about that doctor"), deps);

    expect(result.reply).toBe(PLEASE_REPHRASE);
    expect(deps.tools.getDoctorDetails).not.toHaveBeenCalled();
  });

  it("says when no active doctor matches, without echoing an invented name as fact", async () => {
    const generate = generateReturning(
      JSON.stringify({ intent: "doctor_inquiry", doctorName: "Dr. House" }),
    );

    const result = await handleTurn(turn("Is Dr. House available?"), turnDeps(generate));

    expect(result.reply).toMatch(/couldn't find/i);
    expect(result.payload).toBeNull();
  });
});
