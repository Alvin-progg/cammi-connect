// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  KNOWLEDGE_MATCH_COUNT,
  KNOWLEDGE_MIN_SIMILARITY,
  searchHospitalInformation,
  type KnowledgeChunkMatch,
  type KnowledgeSearchDeps,
} from "@/server/knowledge/service";

vi.mock("server-only", () => ({}));

const EMBEDDING = [0.1, 0.2, 0.3];

function match(overrides: Partial<KnowledgeChunkMatch>): KnowledgeChunkMatch {
  return {
    chunkId: "c1",
    slug: "required-documents",
    title: "Required Documents",
    sectionTitle: "Identification",
    content: "Bring a valid government ID.",
    similarity: 0.82,
    ...overrides,
  };
}

function deps(rows: KnowledgeChunkMatch[]): KnowledgeSearchDeps {
  return {
    embedQuery: vi.fn(async () => EMBEDDING),
    store: { matchChunks: vi.fn(async () => rows) },
  };
}

describe("searchHospitalInformation", () => {
  it("embeds the question and searches with the configured count and threshold", async () => {
    const searchDeps = deps([match({})]);

    await searchHospitalInformation("What should I bring?", searchDeps);

    expect(searchDeps.embedQuery).toHaveBeenCalledWith("What should I bring?");
    expect(searchDeps.store.matchChunks).toHaveBeenCalledWith(
      EMBEDDING,
      KNOWLEDGE_MATCH_COUNT,
      KNOWLEDGE_MIN_SIMILARITY,
    );
    expect(KNOWLEDGE_MATCH_COUNT).toBe(5);
  });

  it("reports not found when no chunk clears the threshold", async () => {
    const result = await searchHospitalInformation("Parking at another hospital?", deps([]));

    expect(result).toEqual({ found: false });
  });

  it("returns the chunks and their sources copied exactly, without duplicates", async () => {
    const rows = [
      match({ chunkId: "c1" }),
      match({ chunkId: "c2", content: "Bring your PhilHealth card." }),
      match({
        chunkId: "c3",
        slug: "visit-guidelines",
        title: "Visit Guidelines",
        sectionTitle: null,
        content: "Arrive 15 minutes early.",
      }),
    ];

    const result = await searchHospitalInformation("What should I bring?", deps(rows));

    expect(result).toEqual({
      found: true,
      chunks: rows,
      sources: [
        { slug: "required-documents", title: "Required Documents", sectionTitle: "Identification" },
        { slug: "visit-guidelines", title: "Visit Guidelines", sectionTitle: null },
      ],
    });
  });

  it("lets embedding failures propagate", async () => {
    const searchDeps = deps([]);
    vi.mocked(searchDeps.embedQuery).mockRejectedValue(new Error("down"));

    await expect(searchHospitalInformation("Hi", searchDeps)).rejects.toThrow("down");
  });
});
