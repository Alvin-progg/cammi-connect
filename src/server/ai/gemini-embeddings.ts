import "server-only";

import { z } from "zod";

import { getAiProviderEnv } from "@/server/config";

import { fetchJson, ProviderError } from "./http";

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export type GeminiEmbeddingDeps = {
  apiKey: string;
  model: string;
  dimensions: number;
  timeoutMs: number;
  maxRetries: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const contentEmbeddingSchema = z.object({ values: z.array(z.number()) });
const embedContentResponseSchema = z.object({ embedding: contentEmbeddingSchema });
const batchEmbedContentsResponseSchema = z.object({
  embeddings: z.array(contentEmbeddingSchema),
});

function depsFromEnv(): GeminiEmbeddingDeps {
  const env = getAiProviderEnv();
  return {
    apiKey: env.geminiApiKey,
    model: env.geminiEmbeddingModel,
    dimensions: env.embeddingDimensions,
    timeoutMs: env.llmTimeoutSeconds * 1000,
    maxRetries: env.llmMaxRetries,
  };
}

/**
 * gemini-embedding-001 only returns unit vectors at its full 3072 dimensions,
 * so truncated vectors must be normalized before cosine search (ADR-0006).
 */
function normalize(values: number[]): number[] {
  const norm = Math.hypot(...values);
  if (norm === 0) throw new ProviderError("gemini", "invalid_response");
  return values.map((value) => value / norm);
}

/**
 * Embeds texts with the configured Gemini model. The returned vectors are in
 * input order and always have the configured dimensionality.
 */
export async function embedTexts(
  texts: string[],
  taskType: EmbeddingTaskType,
  deps: GeminiEmbeddingDeps = depsFromEnv(),
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const modelPath = `models/${deps.model}`;
  const toRequest = (text: string) => ({
    model: modelPath,
    content: { parts: [{ text }] },
    taskType,
    outputDimensionality: deps.dimensions,
  });
  const isBatch = texts.length > 1;

  const json = await fetchJson({
    provider: "gemini",
    url: `${GEMINI_API_BASE_URL}/${modelPath}:${isBatch ? "batchEmbedContents" : "embedContent"}`,
    init: {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": deps.apiKey },
      body: JSON.stringify(isBatch ? { requests: texts.map(toRequest) } : toRequest(texts[0])),
    },
    timeoutMs: deps.timeoutMs,
    maxRetries: deps.maxRetries,
    fetchImpl: deps.fetchImpl,
    sleep: deps.sleep,
  });

  const parsed = (isBatch ? batchEmbedContentsResponseSchema : embedContentResponseSchema).safeParse(
    json,
  );
  if (!parsed.success) throw new ProviderError("gemini", "invalid_response");

  const vectors = "embeddings" in parsed.data ? parsed.data.embeddings : [parsed.data.embedding];
  if (
    vectors.length !== texts.length ||
    vectors.some((vector) => vector.values.length !== deps.dimensions)
  ) {
    throw new ProviderError("gemini", "invalid_response");
  }

  return vectors.map((vector) => normalize(vector.values));
}
