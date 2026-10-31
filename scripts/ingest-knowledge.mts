#!/usr/bin/env node
/**
 * Knowledge-base ingestion for AI-APT-001 S2 (ADR-0004: manual CLI for now).
 *
 * Run with: npm run kb:ingest
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
 * GEMINI_API_KEY. GEMINI_EMBEDDING_MODEL is optional (default gemini-embedding-001).
 * Apply db/migrations/0005_knowledge.sql first.
 *
 * Chunks every db/knowledge/*.md file, embeds the chunks, and swaps them in
 * atomically through cammi_connect_replace_document_chunks. Documents whose
 * content hash is unchanged are skipped. Prints only slugs and counts, never
 * keys or provider bodies.
 *
 * Node runs this file directly (type stripping), so it cannot import the
 * server-only adapters in src/server/ai; the embedding call below mirrors
 * src/server/ai/gemini-embeddings.ts.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { chunkMarkdown, hashContent } from "../src/lib/chat/rag/chunking.ts";

const KNOWLEDGE_DIR = path.join(import.meta.dirname, "..", "db", "knowledge");
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
/** Fixed by the knowledge_chunks.embedding vector(768) column. */
const EMBEDDING_DIMENSIONS = 768;
const EMBED_BATCH_SIZE = 50;
const TIMEOUT_MS = 60_000;

const batchEmbedResponseSchema = z.object({
  embeddings: z.array(z.object({ values: z.array(z.number()).length(EMBEDDING_DIMENSIONS) })),
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`FAIL  missing ${name} in .env.local`);
    process.exit(1);
  }
  return value;
}

/** Truncated gemini-embedding-001 vectors are not unit length (ADR-0006). */
function normalize(values: number[]): number[] {
  const norm = Math.hypot(...values);
  if (norm === 0) throw new Error("Gemini returned a zero vector.");
  return values.map((value) => value / norm);
}

async function embedDocuments(texts: string[], apiKey: string, model: string): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
    const batch = texts.slice(start, start + EMBED_BATCH_SIZE);
    const response = await fetch(`${GEMINI_API_BASE_URL}/models/${model}:batchEmbedContents`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        requests: batch.map((text) => ({
          model: `models/${model}`,
          content: { parts: [{ text }] },
          taskType: "RETRIEVAL_DOCUMENT",
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Gemini embedding failed with HTTP ${response.status}.`);
    }
    const parsed = batchEmbedResponseSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.embeddings.length !== batch.length) {
      throw new Error("Gemini returned an unexpected embedding response.");
    }
    vectors.push(...parsed.data.embeddings.map((embedding) => normalize(embedding.values)));
  }
  return vectors;
}

async function main(): Promise<void> {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
  );
  const geminiApiKey = requireEnv("GEMINI_API_KEY");
  const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";

  const { data: existing, error: existingError } = await supabase
    .from("knowledge_documents")
    .select("slug, content_hash");
  if (existingError) {
    throw new Error("Unable to read knowledge_documents. Is 0005_knowledge.sql applied?");
  }
  const storedHashes = new Map(
    (existing ?? []).map((row: { slug: string; content_hash: string }) => [row.slug, row.content_hash]),
  );

  const files = (await readdir(KNOWLEDGE_DIR)).filter((file) => file.endsWith(".md")).sort();
  let ingested = 0;
  let skipped = 0;

  for (const file of files) {
    const slug = path.basename(file, ".md");
    const markdown = await readFile(path.join(KNOWLEDGE_DIR, file), "utf8");
    const contentHash = await hashContent(markdown);
    if (storedHashes.get(slug) === contentHash) {
      console.log(`SKIP  ${slug} (unchanged)`);
      skipped += 1;
      continue;
    }

    const { title, chunks } = chunkMarkdown(markdown);
    if (chunks.length === 0) {
      throw new Error(`${file} has no content to ingest.`);
    }
    const embeddings = await embedDocuments(
      chunks.map((chunk) => (chunk.sectionTitle ? `${chunk.sectionTitle}\n\n${chunk.content}` : chunk.content)),
      geminiApiKey,
      model,
    );
    const payload = await Promise.all(
      chunks.map(async (chunk, index) => ({
        chunk_index: chunk.index,
        section_title: chunk.sectionTitle,
        content: chunk.content,
        content_hash: await hashContent(chunk.content),
        embedding: embeddings[index],
      })),
    );

    const { error } = await supabase.rpc("cammi_connect_replace_document_chunks", {
      p_document: { slug, title: title ?? slug, content_hash: contentHash },
      p_chunks: payload,
    });
    if (error) {
      throw new Error(`Unable to store ${slug} (SQLSTATE ${error.code}).`);
    }
    console.log(`OK    ${slug}: ${chunks.length} chunk(s)`);
    ingested += 1;
  }

  console.log(`DONE  ${ingested} ingested, ${skipped} unchanged`);
}

main().catch((error: unknown) => {
  console.error(`FAIL  ${error instanceof Error ? error.message : "ingestion failed"}`);
  process.exit(1);
});
