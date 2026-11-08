import { describe, expect, it } from "vitest";

import { parseKnowledgeCategoryFilter, parseKnowledgeStatusFilter } from "@/lib/knowledge/params";

describe("knowledge list filters", () => {
  it("reads known values and falls back to all", () => {
    expect(parseKnowledgeStatusFilter("published")).toBe("published");
    expect(parseKnowledgeStatusFilter(["archived", "draft"])).toBe("archived");
    expect(parseKnowledgeStatusFilter("deleted")).toBe("all");
    expect(parseKnowledgeStatusFilter(undefined)).toBe("all");
    expect(parseKnowledgeCategoryFilter("services")).toBe("services");
    expect(parseKnowledgeCategoryFilter("billing")).toBe("all");
  });
});
