import { KNOWLEDGE_CATEGORIES, type KnowledgeCategory, type KnowledgeDocumentSummary } from "./types";

export type KnowledgeCoverageRow = {
  category: KnowledgeCategory;
  /** Published documents; ready and failed count among these only. */
  published: number;
  ready: number;
  failed: number;
  /** Latest update among the published documents. */
  lastUpdated: string | null;
};

/** Per-category view of what Cami can answer from (ADM-14 coverage panel). */
export function knowledgeCoverage(documents: KnowledgeDocumentSummary[]): KnowledgeCoverageRow[] {
  return KNOWLEDGE_CATEGORIES.map((category) => {
    const published = documents.filter(
      (document) => document.category === category && document.status === "published",
    );
    return {
      category,
      published: published.length,
      ready: published.filter((document) => document.processingStatus === "ready").length,
      failed: published.filter((document) => document.processingStatus === "failed").length,
      lastUpdated: published.reduce<string | null>(
        (latest, document) => (latest === null || document.updatedAt > latest ? document.updatedAt : latest),
        null,
      ),
    };
  });
}
