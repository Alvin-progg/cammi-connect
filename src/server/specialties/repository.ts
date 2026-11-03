import "server-only";

import { getSupabaseAdminClient } from "@/server/db/admin-client";
import { supabaseDirectoryRepository } from "@/server/directory/repository";

import type { SpecialtyAdminStore } from "./service";

/** P0001 refusals carry their code as the message; anything else is unexpected. */
function refusalCode(error: { code?: string; message: string }): string | undefined {
  if (error.code === "P0001") {
    return error.message;
  }
  console.error("Admin specialty database call failed.");
  return undefined;
}

export const supabaseSpecialtyAdminRepository: SpecialtyAdminStore = {
  listSpecialties: () => supabaseDirectoryRepository.listSpecialties(),

  listDoctors: (specialtyId) =>
    supabaseDirectoryRepository.listDoctors({ specialtyId, activeOnly: false }),

  async countDoctorsBySpecialty() {
    const { data, error } = await getSupabaseAdminClient()
      .from("doctor_specialties")
      .select("specialty_id");
    if (error) {
      throw new Error("Unable to count doctors per specialty.");
    }
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      counts.set(row.specialty_id, (counts.get(row.specialty_id) ?? 0) + 1);
    }
    return counts;
  },

  async getSpecialty(specialtyId) {
    const { data, error } = await getSupabaseAdminClient()
      .from("specialties")
      .select("id, name, description, is_active")
      .eq("id", specialtyId)
      .maybeSingle();
    if (error) {
      throw new Error("Unable to load the specialty.");
    }
    return data
      ? { id: data.id, name: data.name, description: data.description, isActive: data.is_active }
      : null;
  },

  async save({ actorId, specialtyId, name, description }) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_save_specialty",
      {
        p_actor_profile_id: actorId,
        p_specialty_id: specialtyId,
        p_name: name,
        p_description: description,
      },
    );
    if (error || !data) {
      return { ok: false, code: error ? refusalCode(error) : undefined };
    }
    return { ok: true, specialtyId: data };
  },

  async setActive({ actorId, specialtyId, isActive }) {
    const { error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_set_specialty_active",
      {
        p_actor_profile_id: actorId,
        p_specialty_id: specialtyId,
        p_is_active: isActive,
      },
    );
    return error ? { ok: false, code: refusalCode(error) } : { ok: true };
  },
};
