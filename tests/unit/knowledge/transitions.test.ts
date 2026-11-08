import { describe, expect, it } from "vitest";

import { canTransitionKnowledge, KNOWLEDGE_TRANSITIONS } from "@/lib/knowledge/transitions";

describe("knowledge document transitions", () => {
  it.each([
    ["draft", "published"],
    ["draft", "archived"],
    ["published", "archived"],
    ["archived", "draft"],
  ] as const)("allows %s → %s", (from, to) => {
    expect(canTransitionKnowledge(from, to)).toBe(true);
  });

  it.each([
    ["draft", "draft"],
    ["published", "draft"],
    ["published", "published"],
    ["archived", "published"],
    ["archived", "archived"],
  ] as const)("refuses %s → %s", (from, to) => {
    expect(canTransitionKnowledge(from, to)).toBe(false);
  });

  it("lists the next states for every status", () => {
    expect(KNOWLEDGE_TRANSITIONS).toEqual({
      draft: ["published", "archived"],
      published: ["archived"],
      archived: ["draft"],
    });
  });
});
