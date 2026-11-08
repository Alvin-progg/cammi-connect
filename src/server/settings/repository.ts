import "server-only";

import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type { SettingsStore } from "./service";

export const supabaseSettingsRepository: SettingsStore = {
  async listSettings() {
    const { data, error } = await getSupabaseAdminClient()
      .from("system_settings")
      .select("key, value");
    if (error) {
      throw new Error("Unable to load settings.");
    }
    return data ?? [];
  },

  async save({ actorId, values }) {
    const { error } = await getSupabaseAdminClient().rpc("cammi_connect_admin_save_settings", {
      p_actor_profile_id: actorId,
      p_values: values,
    });
    if (!error) {
      return { ok: true };
    }
    // P0001 refusals carry their code as the message; anything else is unexpected.
    if (error.code === "P0001") {
      return { ok: false, code: error.message };
    }
    console.error("Settings save failed.");
    return { ok: false, code: undefined };
  },
};
