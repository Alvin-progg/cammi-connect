// @vitest-environment node
/**
 * AI-APT-002 routing evaluation (ADR-0009) against the real model. Not part
 * of `npm test` or CI: it needs real provider keys and spends tokens.
 *
 * Run with: npm run eval:routing (reads .env.local; needs GROQ_API_KEY and GROQ_MODEL).
 *
 * Each synthetic message goes through the same extraction prompt, urgency
 * check, and routing rules as a chat turn. It prints only the verdict per
 * row and the totals, never keys or provider bodies.
 */
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_FIRST_CONTACT, routeToSpecialty } from "@/lib/chat/routing";
import {
  judgeRoutingCase,
  scoreRoutingEval,
  type RoutingEvalOutcome,
} from "@/lib/chat/routing-eval";
import { soundsUrgent } from "@/lib/chat/safety";
import { generate } from "@/server/ai/groq";
import { extractionSystemPrompt, parseExtraction } from "@/server/chat/orchestrator";

import { ROUTING_EVAL_CASES, ROUTING_EVAL_SPECIALTIES } from "./routing-cases";

vi.mock("server-only", () => ({}));

const SPECIALTIES = ROUTING_EVAL_SPECIALTIES.map((entry) => ({
  ...entry,
  id: entry.name,
  isActive: true,
  hasActiveDoctors: true,
}));

async function outcomeFor(message: string): Promise<RoutingEvalOutcome> {
  const raw = await generate({
    systemPrompt: extractionSystemPrompt(new Date(), SPECIALTIES),
    messages: [{ role: "user", content: message }],
    json: true,
  });
  const extraction = parseExtraction(raw);
  if (soundsUrgent(message) || extraction?.urgent === true) return { kind: "emergency" };
  if (!extraction || (extraction.intent !== "book" && extraction.intent !== "medical_advice")) {
    return { kind: "none" };
  }
  const route = routeToSpecialty(extraction, SPECIALTIES, DEFAULT_FIRST_CONTACT);
  return route ? { kind: "routed", name: route.specialtyId, reason: route.reason } : { kind: "none" };
}

describe("AI-APT-002 routing eval", () => {
  it("routes at least 90% correctly or safely, with no urgent misroutes", async () => {
    const results = [];
    for (const entry of ROUTING_EVAL_CASES) {
      const outcome = await outcomeFor(entry.message);
      const verdict = judgeRoutingCase(entry.expected, outcome);
      const got = outcome.kind === "routed" ? `${outcome.name} (${outcome.reason})` : outcome.kind;
      console.log(`${verdict.padEnd(15)} [${entry.language}] ${entry.message} -> ${got}`);
      results.push({ expected: entry.expected, outcome });
    }

    const score = scoreRoutingEval(results);
    console.log(JSON.stringify(score));
    expect(score.urgentMisroutes).toBe(0);
    expect(score.passed).toBe(true);
  }, 600_000);
});
