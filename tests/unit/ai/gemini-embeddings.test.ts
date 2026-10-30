// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { embedTexts, type GeminiEmbeddingDeps } from "@/server/ai/gemini-embeddings";
import { ProviderError } from "@/server/ai/http";

vi.mock("server-only", () => ({}));

const API_KEY = "gemini-test-key";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function vector(dimensions: number, value = 1): number[] {
  return Array.from({ length: dimensions }, () => value);
}

function deps(fetchImpl: typeof fetch, dimensions = 4): GeminiEmbeddingDeps {
  return {
    apiKey: API_KEY,
    model: "gemini-embedding-001",
    dimensions,
    timeoutMs: 1000,
    maxRetries: 0,
    fetchImpl,
    sleep: async () => {},
  };
}

function lastRequest(fetchImpl: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchImpl.mock.calls.at(-1) as [string, RequestInit];
  return {
    url,
    headers: new Headers(init.headers),
    body: JSON.parse(String(init.body)),
  };
}

describe("embedTexts", () => {
  it("embeds one text with embedContent, passing the task type and dimensionality", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ embedding: { values: vector(4) } }));

    await embedTexts(["What do I bring?"], "RETRIEVAL_QUERY", deps(fetchImpl));

    const request = lastRequest(fetchImpl);
    expect(request.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent",
    );
    expect(request.body).toEqual({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text: "What do I bring?" }] },
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: 4,
    });
  });

  it("embeds several texts with batchEmbedContents in order", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ embeddings: [{ values: vector(4, 1) }, { values: vector(4, 2) }] }),
    );

    const vectors = await embedTexts(["first", "second"], "RETRIEVAL_DOCUMENT", deps(fetchImpl));

    const request = lastRequest(fetchImpl);
    expect(request.url).toMatch(/:batchEmbedContents$/);
    expect(request.body.requests).toHaveLength(2);
    expect(request.body.requests[1]).toMatchObject({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text: "second" }] },
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: 4,
    });
    expect(vectors).toHaveLength(2);
  });

  it("sends the key in a header, never in the URL", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ embedding: { values: vector(4) } }));

    await embedTexts(["hello"], "RETRIEVAL_QUERY", deps(fetchImpl));

    const request = lastRequest(fetchImpl);
    expect(request.headers.get("x-goog-api-key")).toBe(API_KEY);
    expect(request.url).not.toContain(API_KEY);
  });

  it("L2-normalizes truncated vectors", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ embedding: { values: [3, 4, 0, 0] } }));

    const [embedding] = await embedTexts(["hello"], "RETRIEVAL_QUERY", deps(fetchImpl));

    expect(embedding).toEqual([0.6, 0.8, 0, 0]);
  });

  it("fails with a controlled error when a vector has the wrong dimension", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ embedding: { values: vector(3) } }));

    const error = await embedTexts(["hello"], "RETRIEVAL_QUERY", deps(fetchImpl)).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ provider: "gemini", kind: "invalid_response" });
  });

  it("fails when the batch returns a different number of vectors", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ embeddings: [{ values: vector(4) }] }));

    await expect(
      embedTexts(["a", "b"], "RETRIEVAL_DOCUMENT", deps(fetchImpl)),
    ).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("returns no vectors and makes no call for no texts", async () => {
    const fetchImpl = vi.fn();

    await expect(embedTexts([], "RETRIEVAL_DOCUMENT", deps(fetchImpl))).resolves.toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
