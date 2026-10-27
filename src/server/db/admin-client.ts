import "server-only";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/config.public";
import { getServerEnv } from "@/server/config";

import type { Database } from "./database.types";

let cachedClient: SupabaseClient<Database> | null = null;

/**
 * Server-only client for authoritative reads and writes. The service-role key
 * bypasses RLS, so every caller must enforce application authorization first.
 * Never import this module from a client component.
 */
export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (cachedClient) return cachedClient;

  const { supabaseUrl } = getPublicEnv();
  const { supabaseServiceRoleKey } = getServerEnv();

  cachedClient = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return cachedClient;
}
