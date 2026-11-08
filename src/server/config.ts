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
  GROQ_API_KEY: z.string().min(1),
  GROQ_BASE_URL: z.url().default("https://api.groq.com/openai/v1"),
  GROQ_MODEL: z.string().min(1),
  LLM_TIMEOUT_SECONDS: z.coerce.number().positive().default(20),
  LLM_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
});

export type AiProviderEnv = {
  geminiApiKey: string;
  geminiEmbeddingModel: string;
  embeddingDimensions: number;
  groqApiKey: string;
  groqBaseUrl: string;
  groqModel: string;
  llmTimeoutSeconds: number;
  llmMaxRetries: number;
};

let cachedAiProviderEnv: AiProviderEnv | null = null;

/**
 * Lazily validates the Gemini and Groq settings (ADR-0006). Kept apart
 * from getServerEnv so Supabase-only code keeps working without AI keys. The
 * error names the invalid variables but never prints their values.
 */
export function getAiProviderEnv(): AiProviderEnv {
  if (cachedAiProviderEnv) return cachedAiProviderEnv;

  const parsed = aiProviderEnvSchema.safeParse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL,
    EMBEDDING_DIMENSIONS: process.env.EMBEDDING_DIMENSIONS,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_BASE_URL: process.env.GROQ_BASE_URL,
    GROQ_MODEL: process.env.GROQ_MODEL,
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
    groqApiKey: parsed.data.GROQ_API_KEY,
    groqBaseUrl: parsed.data.GROQ_BASE_URL,
    groqModel: parsed.data.GROQ_MODEL,
    llmTimeoutSeconds: parsed.data.LLM_TIMEOUT_SECONDS,
    llmMaxRetries: parsed.data.LLM_MAX_RETRIES,
  };
  return cachedAiProviderEnv;
}
