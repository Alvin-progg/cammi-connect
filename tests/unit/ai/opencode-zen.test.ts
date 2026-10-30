// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { ProviderError } from "@/server/ai/http";
import { generate, type OpenCodeZenDeps } from "@/server/ai/opencode-zen";

vi.mock("server-only", () => ({}));

const API_KEY = "zen-test-key";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function completion(content: unknown) {
  return { choices: [{ message: { role: "assistant", content } }] };
}

function deps(fetchImpl: typeof fetch): OpenCodeZenDeps {
  return {
    apiKey: API_KEY,
    baseUrl: "https://zen.example.test/v1/",
    model: "test-model",
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

const INPUT = {
  systemPrompt: "You are the CamiConnect assistant.",
  sessionId: "conversation-1",
  messages: [
    { role: "user" as const, content: "Hello" },
    { role: "assistant" as const, content: "Hi! How can I help?" },
    { role: "user" as const, content: "Book a doctor" },
  ],
};

describe("generate", () => {
  it("posts an OpenAI-compatible chat completion with the configured model and key", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(completion("Sure.")));

    await expect(generate(INPUT, deps(fetchImpl))).resolves.toBe("Sure.");

    const request = lastRequest(fetchImpl);
    expect(request.url).toBe("https://zen.example.test/v1/chat/completions");
    expect(request.headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
    expect(request.body).toEqual({
      model: "test-model",
      messages: [{ role: "system", content: INPUT.systemPrompt }, ...INPUT.messages],
    });
  });

  it("identifies the app and the conversation, as OpenCode Go requires", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(completion("Sure.")));

    await generate(INPUT, deps(fetchImpl));

    const { headers } = lastRequest(fetchImpl);
    expect(headers.get("x-opencode-session")).toBe("conversation-1");
    expect(headers.get("user-agent")).toBe("cammi-connect/0.1");
  });

  it("requests JSON mode only when asked", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(completion('{"intent":"book"}')));

    await generate({ ...INPUT, json: true }, deps(fetchImpl));

    expect(lastRequest(fetchImpl).body.response_format).toEqual({ type: "json_object" });
  });

  it("fails with a controlled error when the response has no message content", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(completion(null)));

    const error = await generate(INPUT, deps(fetchImpl)).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ provider: "opencode-zen", kind: "invalid_response" });
  });

  it("fails with a controlled error when choices are missing", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "nope" }));

    await expect(generate(INPUT, deps(fetchImpl))).rejects.toMatchObject({
      kind: "invalid_response",
    });
  });
});
