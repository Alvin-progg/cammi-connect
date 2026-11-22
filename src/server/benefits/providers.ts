import "server-only";

import { getSupabaseAdminClient } from "@/server/db/admin-client";

/** Active HMO providers for the patient-facing forms (names only). */
export async function listActiveHmoProviderOptions(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("hmo_providers")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error("Unable to load HMO providers.");
  return data.map((row) => ({ id: row.id, name: row.name }));
}
