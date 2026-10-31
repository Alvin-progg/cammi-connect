import "server-only";

/** How many chunks a hospital-information answer is grounded on. */
export const KNOWLEDGE_MATCH_COUNT = 5;
/**
 * Minimum cosine similarity for a chunk to count as relevant. Tuned against
 * the synthetic corpus during the S2 smoke test.
 */
export const KNOWLEDGE_MIN_SIMILARITY = 0.6;

export type KnowledgeChunkMatch = {
  chunkId: string;
  slug: string;
  title: string;
  sectionTitle: string | null;
  content: string;
  similarity: number;
};

export type KnowledgeSource = Pick<KnowledgeChunkMatch, "slug" | "title" | "sectionTitle">;

export type KnowledgeStore = {
  /** Published chunks only, most similar first. */
  matchChunks(
    embedding: number[],
    matchCount: number,
    minSimilarity: number,
  ): Promise<KnowledgeChunkMatch[]>;
};

export type KnowledgeSearchDeps = {
  embedQuery: (question: string) => Promise<number[]>;
  store: KnowledgeStore;
};

export type KnowledgeSearchResult =
  | { found: true; chunks: KnowledgeChunkMatch[]; sources: KnowledgeSource[] }
  | { found: false };

/**
 * Retrieves the corpus chunks relevant to a patient's question. Sources come
 * straight from the matched rows, so the reply can only cite real documents.
 */
export async function searchHospitalInformation(
  question: string,
  deps: KnowledgeSearchDeps,
): Promise<KnowledgeSearchResult> {
  const embedding = await deps.embedQuery(question);
  const chunks = await deps.store.matchChunks(
    embedding,
    KNOWLEDGE_MATCH_COUNT,
    KNOWLEDGE_MIN_SIMILARITY,
  );
  if (chunks.length === 0) {
    return { found: false };
  }

  const sources = new Map<string, KnowledgeSource>();
  for (const { slug, title, sectionTitle } of chunks) {
    const key = `${slug}\u0000${sectionTitle ?? ""}`;
    if (!sources.has(key)) sources.set(key, { slug, title, sectionTitle });
  }
  return { found: true, chunks, sources: [...sources.values()] };
}
