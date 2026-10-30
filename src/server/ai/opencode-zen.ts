import "server-only";

import { z } from "zod";

import { getAiProviderEnv } from "@/server/config";

import { fetchJson, ProviderError } from "./http";

export type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * SPEC §4.7 TextGenerationProvider input, with `messages` in place of a single
 * `userPrompt` so multi-turn chat history can be sent (ADR-0006 deviation).
 */
export type GenerateInput = {
  systemPrompt: string;
  messages: ChatTurn[];
  /**
   * Stable ID for one chat conversation, sent as `x-opencode-session`. OpenCode Go
   * rejects requests without it (ADR-0006). Use a random conversation ID, never a
   * patient or user identifier.
   */
  sessionId: string;
  /** Asks for `response_format: json_object`; callers still validate with Zod. */
  json?: boolean;
  signal?: AbortSignal;
};

export type OpenCodeZenDeps = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

// OpenCode Go asks clients to identify themselves rather than send a generic
// HTTP-library user agent (ADR-0006).
const USER_AGENT = "cammi-connect/0.1";

const chatCompletionResponseSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().min(1) }) }))
    .min(1),
});

function depsFromEnv(): OpenCodeZenDeps {
  const env = getAiProviderEnv();
  return {
    apiKey: env.openCodeZenApiKey,
    baseUrl: env.openCodeZenBaseUrl,
    model: env.openCodeZenModel,
    timeoutMs: env.llmTimeoutSeconds * 1000,
    maxRetries: env.llmMaxRetries,
  };
}

/** Generates one assistant reply through the OpenAI-compatible OpenCode endpoint. */
export async function generate(
  input: GenerateInput,
  deps: OpenCodeZenDeps = depsFromEnv(),
): Promise<string> {
  const body = {
    model: deps.model,
    messages: [{ role: "system", content: input.systemPrompt }, ...input.messages],
    ...(input.json ? { response_format: { type: "json_object" } } : {}),
  };

  const json = await fetchJson({
    provider: "opencode-zen",
    url: `${deps.baseUrl.replace(/\/+$/, "")}/chat/completions`,
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${deps.apiKey}`,
        "user-agent": USER_AGENT,
        "x-opencode-session": input.sessionId,
      },
      body: JSON.stringify(body),
    },
    timeoutMs: deps.timeoutMs,
    maxRetries: deps.maxRetries,
    signal: input.signal,
    fetchImpl: deps.fetchImpl,
    sleep: deps.sleep,
  });

  const parsed = chatCompletionResponseSchema.safeParse(json);
  if (!parsed.success) throw new ProviderError("opencode-zen", "invalid_response");

  return parsed.data.choices[0].message.content;
}
