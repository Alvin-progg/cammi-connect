// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const REQUIRED_ENV = {
  GEMINI_API_KEY: "gemini-secret-value",
  OPENCODE_ZEN_API_KEY: "zen-secret-value",
  OPENCODE_ZEN_BASE_URL: "https://opencode.ai/inference/openai/v1",
  OPENCODE_ZEN_MODEL: "test-model",
};

const OPTIONAL_KEYS = [
  "GEMINI_EMBEDDING_MODEL",
  "EMBEDDING_DIMENSIONS",
  "LLM_TIMEOUT_SECONDS",
  "LLM_MAX_RETRIES",
];

async function loadConfig() {
  vi.resetModules();
  return import("@/server/config");
}

describe("getAiProviderEnv", () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries(REQUIRED_ENV)) vi.stubEnv(key, value);
    for (const key of OPTIONAL_KEYS) vi.stubEnv(key, undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("applies the documented defaults", async () => {
    const { getAiProviderEnv } = await loadConfig();

    expect(getAiProviderEnv()).toEqual({
      geminiApiKey: "gemini-secret-value",
      geminiEmbeddingModel: "gemini-embedding-001",
      embeddingDimensions: 768,
      openCodeZenApiKey: "zen-secret-value",
      openCodeZenBaseUrl: "https://opencode.ai/inference/openai/v1",
      openCodeZenModel: "test-model",
      llmTimeoutSeconds: 20,
      llmMaxRetries: 2,
    });
  });

  it("reads numeric overrides", async () => {
    vi.stubEnv("EMBEDDING_DIMENSIONS", "1536");
    vi.stubEnv("LLM_TIMEOUT_SECONDS", "10");
    vi.stubEnv("LLM_MAX_RETRIES", "0");
    const { getAiProviderEnv } = await loadConfig();

    expect(getAiProviderEnv()).toMatchObject({
      embeddingDimensions: 1536,
      llmTimeoutSeconds: 10,
      llmMaxRetries: 0,
    });
  });

  it("names a missing variable without printing any secret value", async () => {
    vi.stubEnv("OPENCODE_ZEN_API_KEY", undefined);
    const { getAiProviderEnv } = await loadConfig();

    let message = "";
    try {
      getAiProviderEnv();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("OPENCODE_ZEN_API_KEY");
    expect(message).not.toContain("gemini-secret-value");
    expect(message).not.toContain(REQUIRED_ENV.OPENCODE_ZEN_BASE_URL);
  });

  it("rejects an invalid base URL", async () => {
    vi.stubEnv("OPENCODE_ZEN_BASE_URL", "not a url");
    const { getAiProviderEnv } = await loadConfig();

    expect(() => getAiProviderEnv()).toThrow(/OPENCODE_ZEN_BASE_URL/);
  });

  it("does not require the AI variables for the Supabase server env", async () => {
    vi.stubEnv("GEMINI_API_KEY", undefined);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    const { getServerEnv } = await loadConfig();

    expect(getServerEnv().supabaseServiceRoleKey).toBe("service-role");
  });
});
