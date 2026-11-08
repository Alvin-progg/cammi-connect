// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { hashContent } from "@/lib/chat/rag/chunking";
import { ProviderError } from "@/server/ai/http";
import {
  EMBED_BATCH_SIZE,
  ingestKnowledgeDocument,
  type IngestionSource,
  type KnowledgeIngestionStore,
} from "@/server/knowledge/ingest";

vi.mock("server-only", () => ({}));

const DOCUMENT_ID = "00000000-0000-4000-8000-000000000a01";

const PUBLISHED: IngestionSource = {
  id: DOCUMENT_ID,
  title: "Visiting hours",
  category: "hospital_info",
  content: "# Visiting hours\n\nOpen daily.\n\n## Parking\n\nUse the east lot.",
  status: "published",
  processingStatus: "pending",
  version: 2,
};

function fakeStore(
  source: IngestionSource | null = PUBLISHED,
  overrides: Partial<KnowledgeIngestionStore> = {},
): KnowledgeIngestionStore {
  return {
    getIngestionSource: vi.fn().mockResolvedValue(source),
    markProcessing: vi.fn().mockResolvedValue(true),
    markFailed: vi.fn().mockResolvedValue(undefined),
    storeChunks: vi.fn().mockResolvedValue("stored"),
    ...overrides,
  };
}

function fakeEmbed() {
  return vi.fn(async (texts: string[]) => texts.map(() => [1, 0, 0]));
}

describe("ingestKnowledgeDocument", () => {
  it("chunks, embeds, and stores a published document at its version", async () => {
    const store = fakeStore();
    const embedDocuments = fakeEmbed();

    const result = await ingestKnowledgeDocument(DOCUMENT_ID, { store, embedDocuments });

    expect(result).toEqual({ outcome: "ready", chunkCount: 2 });
    expect(store.markProcessing).toHaveBeenCalledWith(DOCUMENT_ID, 2);
    expect(store.storeChunks).toHaveBeenCalledWith(DOCUMENT_ID, 2, [
      {
        chunk_index: 0,
        section_title: null,
        content: "Open daily.",
        content_hash: await hashContent("Open daily."),
        embedding: [1, 0, 0],
      },
      {
        chunk_index: 1,
        section_title: "Parking",
        content: "Use the east lot.",
        content_hash: await hashContent("Use the east lot."),
        embedding: [1, 0, 0],
      },
    ]);
    expect(store.markFailed).not.toHaveBeenCalled();
  });

  it("puts the title, category, and section in the embedded text but not the stored content", async () => {
    const embedDocuments = fakeEmbed();
    await ingestKnowledgeDocument(DOCUMENT_ID, { store: fakeStore(), embedDocuments });

    expect(embedDocuments).toHaveBeenCalledWith([
      "Visiting hours · Hospital information\n\nOpen daily.",
      "Visiting hours · Hospital information\nParking\n\nUse the east lot.",
    ]);
  });

  it("embeds in batches", async () => {
    const paragraphs = Array.from({ length: EMBED_BATCH_SIZE + 5 }, (_, index) => `## S${index}\n\nText ${index}.`);
    const store = fakeStore({ ...PUBLISHED, content: paragraphs.join("\n\n") });
    const embedDocuments = fakeEmbed();

    const result = await ingestKnowledgeDocument(DOCUMENT_ID, { store, embedDocuments });

    expect(result).toEqual({ outcome: "ready", chunkCount: EMBED_BATCH_SIZE + 5 });
    expect(embedDocuments).toHaveBeenCalledTimes(2);
    expect(embedDocuments.mock.calls[0][0]).toHaveLength(EMBED_BATCH_SIZE);
    expect(embedDocuments.mock.calls[1][0]).toHaveLength(5);
  });

  it.each([
    ["a draft", { ...PUBLISHED, status: "draft" as const }],
    ["an archived document", { ...PUBLISHED, status: "archived" as const }],
    ["a document that is already ready", { ...PUBLISHED, processingStatus: "ready" as const }],
    ["a document another run is processing", { ...PUBLISHED, processingStatus: "processing" as const }],
    ["a missing document", null],
  ])("skips %s without embedding", async (_label, source) => {
    const store = fakeStore(source);
    const embedDocuments = fakeEmbed();

    await expect(ingestKnowledgeDocument(DOCUMENT_ID, { store, embedDocuments })).resolves.toEqual({
      outcome: "skipped",
    });
    expect(store.markProcessing).not.toHaveBeenCalled();
    expect(embedDocuments).not.toHaveBeenCalled();
  });

  it("retries a document whose last run failed", async () => {
    const store = fakeStore({ ...PUBLISHED, processingStatus: "failed" });
    await expect(
      ingestKnowledgeDocument(DOCUMENT_ID, { store, embedDocuments: fakeEmbed() }),
    ).resolves.toEqual({ outcome: "ready", chunkCount: 2 });
  });

  it("stops when the document changed before processing started", async () => {
    const store = fakeStore(PUBLISHED, { markProcessing: vi.fn().mockResolvedValue(false) });
    const embedDocuments = fakeEmbed();

    await expect(ingestKnowledgeDocument(DOCUMENT_ID, { store, embedDocuments })).resolves.toEqual({
      outcome: "stale",
    });
    expect(embedDocuments).not.toHaveBeenCalled();
  });

  it("marks the document failed with a safe message and keeps the old chunks", async () => {
    const store = fakeStore();
    const embedDocuments = vi.fn().mockRejectedValue(new ProviderError("gemini", "rate_limited", 429));

    const result = await ingestKnowledgeDocument(DOCUMENT_ID, { store, embedDocuments });

    const error = "The embedding service is busy or unavailable. Try Reprocess in a few minutes.";
    expect(result).toEqual({ outcome: "failed", error });
    expect(store.markFailed).toHaveBeenCalledWith(DOCUMENT_ID, 2, error);
    expect(store.storeChunks).not.toHaveBeenCalled();
  });

  it("never stores an unexpected error's text", async () => {
    const store = fakeStore();
    const embedDocuments = vi.fn().mockRejectedValue(new Error("secret key abc in URL"));

    const result = await ingestKnowledgeDocument(DOCUMENT_ID, { store, embedDocuments });

    expect(result).toEqual({
      outcome: "failed",
      error: "Processing failed unexpectedly. Try Reprocess.",
    });
    expect(store.markFailed).toHaveBeenCalledWith(
      DOCUMENT_ID,
      2,
      "Processing failed unexpectedly. Try Reprocess.",
    );
  });

  it("fails a document with no text to chunk", async () => {
    const store = fakeStore({ ...PUBLISHED, content: "# Only a title" });
    const embedDocuments = fakeEmbed();

    await expect(ingestKnowledgeDocument(DOCUMENT_ID, { store, embedDocuments })).resolves.toEqual({
      outcome: "failed",
      error: "The document has no text to process.",
    });
    expect(embedDocuments).not.toHaveBeenCalled();
  });

  it("fails when the chunks can't be saved", async () => {
    const store = fakeStore(PUBLISHED, { storeChunks: vi.fn().mockResolvedValue("error") });

    await expect(
      ingestKnowledgeDocument(DOCUMENT_ID, { store, embedDocuments: fakeEmbed() }),
    ).resolves.toEqual({
      outcome: "failed",
      error: "The processed document couldn't be saved. Try Reprocess.",
    });
  });

  it("writes no failure when the document changed during processing", async () => {
    const store = fakeStore(PUBLISHED, { storeChunks: vi.fn().mockResolvedValue("stale") });

    await expect(
      ingestKnowledgeDocument(DOCUMENT_ID, { store, embedDocuments: fakeEmbed() }),
    ).resolves.toEqual({ outcome: "stale" });
    expect(store.markFailed).not.toHaveBeenCalled();
  });
});
