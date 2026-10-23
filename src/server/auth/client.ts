import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/config.public";

/**
 * Creates a fresh Supabase client bound to the request cookie store. Create a
 * new client per request; never share one across requests.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Response cache headers cannot be set from here; session-mutating
        // responses set Cache-Control explicitly (callback route, /account via
        // the proxy).
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}
