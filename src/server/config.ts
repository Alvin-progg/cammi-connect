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
