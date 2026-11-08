import "server-only";

import { chunkMarkdown, hashContent } from "@/lib/chat/rag/chunking";
import {
  KNOWLEDGE_CATEGORY_LABELS,
  type KnowledgeCategory,
  type KnowledgeProcessingStatus,
  type KnowledgeStatus,
} from "@/lib/knowledge/types";
import { ProviderError } from "@/server/ai/http";

/** Texts per Gemini batchEmbedContents call, same as `npm run kb:ingest`. */
export const EMBED_BATCH_SIZE = 50;

export type IngestionSource = {
  id: string;
  title: string;
  category: KnowledgeCategory;
  content: string;
  status: KnowledgeStatus;
  processingStatus: KnowledgeProcessingStatus;
  version: number;
};

export type StoredChunk = {
  chunk_index: number;
  section_title: string | null;
  content: string;
  content_hash: string;
  embedding: number[];
};

/**
 * Data access for ingestion. Every write is guarded by document version, so
 * an edit made while a run is embedding is never overwritten (0026).
 */
export type KnowledgeIngestionStore = {
  getIngestionSource(documentId: string): Promise<IngestionSource | null>;
  /** False when the document is no longer published at this version. */
  markProcessing(documentId: string, version: number): Promise<boolean>;
  markFailed(documentId: string, version: number, error: string): Promise<void>;
  storeChunks(documentId: string, version: number, chunks: StoredChunk[]): Promise<"stored" | "stale" | "error">;
};

export type IngestionDeps = {
  store: KnowledgeIngestionStore;
  embedDocuments: (texts: string[]) => Promise<number[][]>;
};

export type IngestionResult =
  | { outcome: "ready"; chunkCount: number }
  | { outcome: "failed"; error: string }
  /** Not published, already ready, or another run holds it. */
  | { outcome: "skipped" }
  /** The document changed during the run; the newer version needs its own run. */
  | { outcome: "stale" };

// Fixed texts only: processing_error is shown to admins, so it must never
// carry provider bodies, URLs, or keys.
const NO_TEXT = "The document has no text to process.";
const PROVIDER_FAILED = "The embedding service is busy or unavailable. Try Reprocess in a few minutes.";
const STORE_FAILED = "The processed document couldn't be saved. Try Reprocess.";
const UNEXPECTED = "Processing failed unexpectedly. Try Reprocess.";

class IngestionFailure extends Error {}

async function embedInBatches(
  texts: string[],
  embedDocuments: IngestionDeps["embedDocuments"],
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
    vectors.push(...(await embedDocuments(texts.slice(start, start + EMBED_BATCH_SIZE))));
  }
  return vectors;
}

async function buildChunks(
  source: IngestionSource,
  embedDocuments: IngestionDeps["embedDocuments"],
): Promise<StoredChunk[]> {
  const { chunks } = chunkMarkdown(source.content);
  if (chunks.length === 0) {
    throw new IngestionFailure(NO_TEXT);
  }

  // The title and category help retrieval match a chunk; only the chunk's own
  // text is stored and shown to the model.
  const heading = `${source.title} · ${KNOWLEDGE_CATEGORY_LABELS[source.category]}`;
  const embeddings = await embedInBatches(
    chunks.map((chunk) =>
      chunk.sectionTitle ? `${heading}\n${chunk.sectionTitle}\n\n${chunk.content}` : `${heading}\n\n${chunk.content}`,
    ),
    embedDocuments,
  );

  return Promise.all(
    chunks.map(async (chunk, index) => ({
      chunk_index: chunk.index,
      section_title: chunk.sectionTitle,
      content: chunk.content,
      content_hash: await hashContent(chunk.content),
      embedding: embeddings[index],
    })),
  );
}

function safeError(error: unknown): string {
  if (error instanceof IngestionFailure) return error.message;
  if (error instanceof ProviderError) return PROVIDER_FAILED;
  return UNEXPECTED;
}

/**
 * Chunks, embeds, and stores a published document whose processing is
 * pending or failed (ADM-14). Drafts and archived documents are never
 * ingested. On failure the document is marked failed and its previous chunks
 * stay searchable.
 */
export async function ingestKnowledgeDocument(
  documentId: string,
  { store, embedDocuments }: IngestionDeps,
): Promise<IngestionResult> {
  const source = await store.getIngestionSource(documentId);
  if (
    !source ||
    source.status !== "published" ||
    (source.processingStatus !== "pending" && source.processingStatus !== "failed")
  ) {
    return { outcome: "skipped" };
  }
  if (!(await store.markProcessing(source.id, source.version))) {
    return { outcome: "stale" };
  }

  try {
    const chunks = await buildChunks(source, embedDocuments);
    const stored = await store.storeChunks(source.id, source.version, chunks);
    if (stored === "stale") return { outcome: "stale" };
    if (stored === "error") throw new IngestionFailure(STORE_FAILED);
    return { outcome: "ready", chunkCount: chunks.length };
  } catch (error) {
    const message = safeError(error);
    await store.markFailed(source.id, source.version, message);
    return { outcome: "failed", error: message };
  }
}
