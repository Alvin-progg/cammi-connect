import { describe, expect, it } from "vitest";

import {
  ROUTING_EVAL_TARGET,
  judgeRoutingCase,
  scoreRoutingEval,
  type RoutingEvalExpected,
  type RoutingEvalOutcome,
} from "@/lib/chat/routing-eval";

import { ROUTING_EVAL_CASES, ROUTING_EVAL_SPECIALTIES } from "../../../evals/routing-cases";

const CARDIOLOGY: RoutingEvalExpected = { kind: "specialty", names: ["Cardiology"] };
const EMERGENCY: RoutingEvalExpected = { kind: "emergency" };

describe("judgeRoutingCase", () => {
  it.each<[RoutingEvalExpected, RoutingEvalOutcome, string]>([
    [CARDIOLOGY, { kind: "routed", name: "Cardiology", reason: "matched" }, "correct"],
    [
      { kind: "specialty", names: ["Internal Medicine", "Cardiology"] },
      { kind: "routed", name: "Cardiology", reason: "matched" },
      "correct",
    ],
    [CARDIOLOGY, { kind: "routed", name: "Family Medicine", reason: "first_contact" }, "safe"],
    [CARDIOLOGY, { kind: "emergency" }, "safe"],
    [CARDIOLOGY, { kind: "routed", name: "Pediatrics", reason: "matched" }, "wrong"],
    [CARDIOLOGY, { kind: "none" }, "wrong"],
    [EMERGENCY, { kind: "emergency" }, "correct"],
    [EMERGENCY, { kind: "routed", name: "Family Medicine", reason: "first_contact" }, "urgent_misroute"],
    [EMERGENCY, { kind: "none" }, "urgent_misroute"],
    [{ kind: "service", name: "CBC" }, { kind: "none" }, "skipped"],
  ])("judges %j with %j as %s", (expected, outcome, verdict) => {
    expect(judgeRoutingCase(expected, outcome)).toBe(verdict);
  });
});

describe("scoreRoutingEval", () => {
  const correct = { expected: CARDIOLOGY, outcome: { kind: "routed", name: "Cardiology", reason: "matched" } } as const;
  const wrong = { expected: CARDIOLOGY, outcome: { kind: "none" } } as const;

  it("passes at 90% correct or safe with no urgent misroutes, skipping service rows", () => {
    const results = [
      ...Array.from({ length: 9 }, () => correct),
      wrong,
      { expected: { kind: "service", name: "CBC" }, outcome: { kind: "none" } } as const,
    ];

    expect(scoreRoutingEval(results)).toEqual({
      scored: 10,
      correct: 9,
      safe: 0,
      wrong: 1,
      urgentMisroutes: 0,
      skipped: 1,
      passed: true,
    });
  });

  it("fails below the target", () => {
    const results = [...Array.from({ length: 8 }, () => correct), wrong, wrong];

    expect(scoreRoutingEval(results).passed).toBe(false);
  });

  it("fails on a single urgent misroute", () => {
    const results = [
      ...Array.from({ length: 20 }, () => correct),
      { expected: EMERGENCY, outcome: { kind: "none" } } as const,
    ];

    expect(scoreRoutingEval(results)).toMatchObject({ urgentMisroutes: 1, passed: false });
  });

  it("targets 90%", () => {
    expect(ROUTING_EVAL_TARGET).toBe(0.9);
  });
});

describe("routing eval set", () => {
  it("has 40 synthetic messages in English, Tagalog, and Taglish", () => {
    expect(ROUTING_EVAL_CASES).toHaveLength(40);
    expect(new Set(ROUTING_EVAL_CASES.map((entry) => entry.language))).toEqual(
      new Set(["en", "tl", "taglish"]),
    );
    expect(new Set(ROUTING_EVAL_CASES.map((entry) => entry.message)).size).toBe(40);
  });

  it("includes the spec's example rows", () => {
    const messages = ROUTING_EVAL_CASES.map((entry) => entry.message);
    for (const example of [
      "Ubo't sipon ng anak ko, 4 years old, 3 days na",
      "Pa-check up po ako, mataas BP ko lagi",
      "Kumakabog dibdib ko minsan kahit nakaupo",
      "Masakit dibdib ko ngayon, hirap huminga",
      "I don't know, I just feel tired all the time",
      "Need ko magpa-CBC, may request na ako",
    ]) {
      expect(messages).toContain(example);
    }
  });

  it("covers urgent messages and only expects specialties the eval offers", () => {
    const offered = new Set(ROUTING_EVAL_SPECIALTIES.map((entry) => entry.name));
    expect(ROUTING_EVAL_CASES.filter((entry) => entry.expected.kind === "emergency").length).toBeGreaterThanOrEqual(5);
    for (const entry of ROUTING_EVAL_CASES) {
      if (entry.expected.kind === "specialty") {
        for (const name of entry.expected.names) expect(offered).toContain(name);
      }
    }
  });
});
