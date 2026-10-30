import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type ServerEnv = {
  supabaseServiceRoleKey: string;
};

let cachedEnv: ServerEnv | null = null;

/**
 * Lazily validates secrets used by server-only data access. The error message
 * names the missing variable but never prints the value.
 */
export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      "Missing or invalid server configuration. Set SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }

  cachedEnv = {
    supabaseServiceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
  };
  return cachedEnv;
}

const aiProviderEnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_EMBEDDING_MODEL: z.string().min(1).default("gemini-embedding-001"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),
  OPENCODE_ZEN_API_KEY: z.string().min(1),
  OPENCODE_ZEN_BASE_URL: z.url(),
  OPENCODE_ZEN_MODEL: z.string().min(1),
  LLM_TIMEOUT_SECONDS: z.coerce.number().positive().default(20),
  LLM_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
});

export type AiProviderEnv = {
  geminiApiKey: string;
  geminiEmbeddingModel: string;
  embeddingDimensions: number;
  openCodeZenApiKey: string;
  openCodeZenBaseUrl: string;
  openCodeZenModel: string;
  llmTimeoutSeconds: number;
  llmMaxRetries: number;
};

let cachedAiProviderEnv: AiProviderEnv | null = null;

/**
 * Lazily validates the Gemini and OpenCode Zen settings (ADR-0006). Kept apart
 * from getServerEnv so Supabase-only code keeps working without AI keys. The
 * error names the invalid variables but never prints their values.
 */
export function getAiProviderEnv(): AiProviderEnv {
  if (cachedAiProviderEnv) return cachedAiProviderEnv;

  const parsed = aiProviderEnvSchema.safeParse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL,
    EMBEDDING_DIMENSIONS: process.env.EMBEDDING_DIMENSIONS,
    OPENCODE_ZEN_API_KEY: process.env.OPENCODE_ZEN_API_KEY,
    OPENCODE_ZEN_BASE_URL: process.env.OPENCODE_ZEN_BASE_URL,
    OPENCODE_ZEN_MODEL: process.env.OPENCODE_ZEN_MODEL,
    LLM_TIMEOUT_SECONDS: process.env.LLM_TIMEOUT_SECONDS,
    LLM_MAX_RETRIES: process.env.LLM_MAX_RETRIES,
  });

  if (!parsed.success) {
    const invalidNames = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(
      `Missing or invalid AI provider configuration. Check ${invalidNames.join(", ")} in .env.local.`,
    );
  }

  cachedAiProviderEnv = {
    geminiApiKey: parsed.data.GEMINI_API_KEY,
    geminiEmbeddingModel: parsed.data.GEMINI_EMBEDDING_MODEL,
    embeddingDimensions: parsed.data.EMBEDDING_DIMENSIONS,
    openCodeZenApiKey: parsed.data.OPENCODE_ZEN_API_KEY,
    openCodeZenBaseUrl: parsed.data.OPENCODE_ZEN_BASE_URL,
    openCodeZenModel: parsed.data.OPENCODE_ZEN_MODEL,
    llmTimeoutSeconds: parsed.data.LLM_TIMEOUT_SECONDS,
    llmMaxRetries: parsed.data.LLM_MAX_RETRIES,
  };
  return cachedAiProviderEnv;
}
