import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { HmoProvider } from "@/lib/hmo-providers/types";
import { REFERENCE_CACHE_TAG } from "@/server/cache/reference-tag";
import { getSupabaseAdminClient } from "@/server/db/admin-client";
import type { Database } from "@/server/db/database.types";

import type { HmoProviderAdminStore } from "./service";

type HmoProviderRow = Database["public"]["Tables"]["hmo_providers"]["Row"];

const HMO_PROVIDER_COLUMNS = "id, name, copay_centavos, notes, is_active";

/** P0001 refusals carry their code as the message; anything else is unexpected. */
function refusalCode(error: { code?: string; message: string }): string | undefined {
  if (error.code === "P0001") {
    return error.message;
  }
  console.error("Admin HMO provider database call failed.");
  return undefined;
}

function toHmoProvider(row: Omit<HmoProviderRow, "created_at" | "updated_at">): HmoProvider {
  return {
    id: row.id,
    name: row.name,
    copayCentavos: row.copay_centavos,
    notes: row.notes,
    isActive: row.is_active,
  };
}

/** Cached until a write action calls `updateTag(REFERENCE_CACHE_TAG)`. */
async function cachedListHmoProviders(): Promise<HmoProvider[]> {
  "use cache";
  cacheTag(REFERENCE_CACHE_TAG);
  cacheLife("hours");

  const { data, error } = await getSupabaseAdminClient()
    .from("hmo_providers")
    .select(HMO_PROVIDER_COLUMNS)
    .order("name", { ascending: true });
  if (error) {
    throw new Error("Unable to load HMO providers.");
  }
  return (data ?? []).map(toHmoProvider);
}

async function cachedGetHmoProvider(hmoProviderId: string): Promise<HmoProvider | null> {
  "use cache";
  cacheTag(REFERENCE_CACHE_TAG);
  cacheLife("hours");

  const { data, error } = await getSupabaseAdminClient()
    .from("hmo_providers")
    .select(HMO_PROVIDER_COLUMNS)
    .eq("id", hmoProviderId)
    .maybeSingle();
  if (error) {
    throw new Error("Unable to load the HMO provider.");
  }
  return data ? toHmoProvider(data) : null;
}

export const supabaseHmoProviderAdminRepository: HmoProviderAdminStore = {
  listHmoProviders: cachedListHmoProviders,

  getHmoProvider: cachedGetHmoProvider,

  async save({ actorId, hmoProviderId, name, copayCentavos, notes }) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_save_hmo_provider",
      {
        p_actor_profile_id: actorId,
        p_hmo_provider_id: hmoProviderId,
        p_name: name,
        p_copay_centavos: copayCentavos,
        p_notes: notes,
      },
    );
    if (error || !data) {
      return { ok: false, code: error ? refusalCode(error) : undefined };
    }
    return { ok: true, hmoProviderId: data };
  },

  async setActive({ actorId, hmoProviderId, isActive }) {
    const { error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_set_hmo_provider_active",
      {
        p_actor_profile_id: actorId,
        p_hmo_provider_id: hmoProviderId,
        p_is_active: isActive,
      },
    );
    return error ? { ok: false, code: refusalCode(error) } : { ok: true };
  },
};
