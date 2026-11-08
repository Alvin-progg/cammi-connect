import { describe, expect, it } from "vitest";

import { knowledgeCoverage } from "@/lib/knowledge/coverage";
import { KNOWLEDGE_CATEGORIES, type KnowledgeDocumentSummary } from "@/lib/knowledge/types";

const BASE: KnowledgeDocumentSummary = {
  id: "00000000-0000-4000-8000-000000000a01",
  slug: "doc",
  title: "Doc",
  category: "services",
  status: "published",
  processingStatus: "ready",
  processingError: null,
  version: 1,
  sourceFileName: null,
  publishedAt: null,
  archivedAt: null,
  updatedAt: "2026-11-01T00:00:00.000Z",
};

describe("knowledgeCoverage", () => {
  it("returns one row per category in order, with zeros for empty ones", () => {
    const rows = knowledgeCoverage([]);
    expect(rows.map((row) => row.category)).toEqual([...KNOWLEDGE_CATEGORIES]);
    expect(rows[0]).toEqual({
      category: "hospital_info",
      published: 0,
      ready: 0,
      failed: 0,
      lastUpdated: null,
    });
  });

  it("counts published, ready, and failed documents and the latest update", () => {
    const rows = knowledgeCoverage([
      BASE,
      { ...BASE, processingStatus: "failed", updatedAt: "2026-11-05T00:00:00.000Z" },
      { ...BASE, processingStatus: "pending" },
      { ...BASE, status: "draft", processingStatus: "pending", updatedAt: "2026-11-07T00:00:00.000Z" },
      { ...BASE, status: "archived", updatedAt: "2026-11-08T00:00:00.000Z" },
    ]);
    expect(rows.find((row) => row.category === "services")).toEqual({
      category: "services",
      published: 3,
      ready: 1,
      failed: 1,
      lastUpdated: "2026-11-05T00:00:00.000Z",
    });
  });
});
