// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const REQUIRED_ENV = {
  GEMINI_API_KEY: "gemini-secret-value",
  GROQ_API_KEY: "groq-secret-value",
  GROQ_MODEL: "test-model",
};

const OPTIONAL_KEYS = [
  "GEMINI_EMBEDDING_MODEL",
  "EMBEDDING_DIMENSIONS",
  "GROQ_BASE_URL",
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
      groqApiKey: "groq-secret-value",
      groqBaseUrl: "https://api.groq.com/openai/v1",
      groqModel: "test-model",
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
    vi.stubEnv("GROQ_API_KEY", undefined);
    const { getAiProviderEnv } = await loadConfig();

    let message = "";
    try {
      getAiProviderEnv();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("GROQ_API_KEY");
    expect(message).not.toContain("gemini-secret-value");
    expect(message).not.toContain(REQUIRED_ENV.GROQ_MODEL);
  });

  it("rejects an invalid base URL", async () => {
    vi.stubEnv("GROQ_BASE_URL", "not a url");
    const { getAiProviderEnv } = await loadConfig();

    expect(() => getAiProviderEnv()).toThrow(/GROQ_BASE_URL/);
  });

  it("does not require the AI variables for the Supabase server env", async () => {
    vi.stubEnv("GEMINI_API_KEY", undefined);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    const { getServerEnv } = await loadConfig();

    expect(getServerEnv().supabaseServiceRoleKey).toBe("service-role");
  });
});
