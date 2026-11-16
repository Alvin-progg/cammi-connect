import type { SpecialtyRoute } from "@/lib/chat/routing";

/**
 * Scoring for the AI-APT-002 routing evaluation (ADR-0009), run against the
 * real model by `npm run eval:routing`. Kept pure so the scoring itself is
 * unit-tested without spending tokens.
 */

export const ROUTING_EVAL_TARGET = 0.9;

export type RoutingEvalExpected =
  /** Any of `names` is correct; the first is the best match. */
  | { kind: "specialty"; names: string[] }
  | { kind: "emergency" }
  /** PAY-001 service routing is not built yet, so these rows are skipped. */
  | { kind: "service"; name: string };

export type RoutingEvalOutcome =
  | { kind: "emergency" }
  | { kind: "routed"; name: string; reason: SpecialtyRoute["reason"] }
  /** Not routed at all, e.g. classified as small talk. */
  | { kind: "none" };

export type RoutingEvalVerdict = "correct" | "safe" | "wrong" | "urgent_misroute" | "skipped";

export function judgeRoutingCase(
  expected: RoutingEvalExpected,
  outcome: RoutingEvalOutcome,
): RoutingEvalVerdict {
  if (expected.kind === "service") return "skipped";
  if (expected.kind === "emergency") {
    return outcome.kind === "emergency" ? "correct" : "urgent_misroute";
  }
  if (outcome.kind === "routed" && expected.names.includes(outcome.name)) return "correct";
  // A general first stop, or an over-cautious emergency notice, never misdirects care.
  if (outcome.kind === "emergency") return "safe";
  if (outcome.kind === "routed" && outcome.reason === "first_contact") return "safe";
  return "wrong";
}

export type RoutingEvalScore = {
  scored: number;
  correct: number;
  safe: number;
  wrong: number;
  urgentMisroutes: number;
  skipped: number;
  /** At least the target correct-or-safe, and no urgent message routed to doctors. */
  passed: boolean;
};

export function scoreRoutingEval(
  results: { expected: RoutingEvalExpected; outcome: RoutingEvalOutcome }[],
): RoutingEvalScore {
  const counts = { correct: 0, safe: 0, wrong: 0, urgent_misroute: 0, skipped: 0 };
  for (const { expected, outcome } of results) {
    counts[judgeRoutingCase(expected, outcome)] += 1;
  }
  const scored = results.length - counts.skipped;
  const acceptable = counts.correct + counts.safe;
  return {
    scored,
    correct: counts.correct,
    safe: counts.safe,
    wrong: counts.wrong,
    urgentMisroutes: counts.urgent_misroute,
    skipped: counts.skipped,
    passed: scored > 0 && counts.urgent_misroute === 0 && acceptable / scored >= ROUTING_EVAL_TARGET,
  };
}
