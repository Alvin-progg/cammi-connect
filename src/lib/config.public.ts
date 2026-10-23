import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type PublicEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

let cachedEnv: PublicEnv | null = null;

/**
 * Lazily reads and validates the public Supabase environment variables so that
 * missing configuration fails at request time with a clear error instead of a
 * confusing provider error.
 */
export function getPublicEnv(): PublicEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      "Missing or invalid public Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
    );
  }

  cachedEnv = {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
  return cachedEnv;
}
