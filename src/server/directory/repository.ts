import "server-only";

import type {
  Department,
  DoctorSummary,
  Specialty,
} from "@/lib/directory/types";
import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type { DirectoryStore, SaveOutcome } from "./service";

const UNIQUE_VIOLATION = "23505";

function toOutcome(
  error: { code?: string } | null,
  affectedRows: number,
  failureMessage: string,
): SaveOutcome {
  if (error?.code === UNIQUE_VIOLATION) {
    return "duplicate";
  }
  if (error) {
    throw new Error(failureMessage);
  }
  return affectedRows > 0 ? "saved" : "not_found";
}

/** Specialty names per doctor id, for directory and profile displays. */
export async function loadDoctorSpecialties(
  doctorIds: string[],
): Promise<Map<string, { id: string; name: string }[]>> {
  const byDoctor = new Map<string, { id: string; name: string }[]>();
  if (doctorIds.length === 0) {
    return byDoctor;
  }

  const supabase = getSupabaseAdminClient();
  const { data: links, error: linkError } = await supabase
    .from("doctor_specialties")
    .select("doctor_id, specialty_id")
    .in("doctor_id", doctorIds);
  if (linkError) {
    throw new Error("Unable to load doctor specialties.");
  }

  const specialtyIds = [...new Set((links ?? []).map((link) => link.specialty_id))];
  if (specialtyIds.length === 0) {
    return byDoctor;
  }
  const { data: specialties, error: specialtyError } = await supabase
    .from("specialties")
    .select("id, name")
    .in("id", specialtyIds);
  if (specialtyError) {
    throw new Error("Unable to load doctor specialties.");
  }

  const names = new Map((specialties ?? []).map((row) => [row.id, row.name]));
  for (const link of links ?? []) {
    const name = names.get(link.specialty_id);
    if (!name) continue;
    const list = byDoctor.get(link.doctor_id) ?? [];
    list.push({ id: link.specialty_id, name });
    byDoctor.set(link.doctor_id, list);
  }
  for (const list of byDoctor.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return byDoctor;
}

export const supabaseDirectoryRepository: DirectoryStore = {
  async listDepartments() {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("departments")
      .select("id, name, code, description, is_active")
      .order("name", { ascending: true });

    if (error) {
      throw new Error("Unable to load departments.");
    }
    return (data ?? []).map(
      (row): Department => ({
        id: row.id,
        name: row.name,
        code: row.code,
        description: row.description,
        isActive: row.is_active,
      }),
    );
  },

  async saveDepartment({ id, name, code, description, isActive }) {
    const supabase = getSupabaseAdminClient();
    const values = { name, code, description, is_active: isActive };
    const { data, error } = id
      ? await supabase.from("departments").update(values).eq("id", id).select("id")
      : await supabase.from("departments").insert(values).select("id");

    return toOutcome(error, (data ?? []).length, "Unable to save the department.");
  },

  async listSpecialties() {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("specialties")
      .select("id, name, description, is_active")
      .order("name", { ascending: true });

    if (error) {
      throw new Error("Unable to load specialties.");
    }
    return (data ?? []).map(
      (row): Specialty => ({
        id: row.id,
        name: row.name,
        description: row.description,
        isActive: row.is_active,
      }),
    );
  },

  async saveSpecialty({ id, name, description, isActive }) {
    const supabase = getSupabaseAdminClient();
    const values = { name, description, is_active: isActive };
    const { data, error } = id
      ? await supabase.from("specialties").update(values).eq("id", id).select("id")
      : await supabase.from("specialties").insert(values).select("id");

    return toOutcome(error, (data ?? []).length, "Unable to save the specialty.");
  },

  async listDoctors({ departmentId, specialtyId, activeOnly }) {
    const supabase = getSupabaseAdminClient();

    let doctorIdsForSpecialty: string[] | null = null;
    if (specialtyId) {
      const { data, error } = await supabase
        .from("doctor_specialties")
        .select("doctor_id")
        .eq("specialty_id", specialtyId);
      if (error) {
        throw new Error("Unable to load doctors.");
      }
      doctorIdsForSpecialty = (data ?? []).map((row) => row.doctor_id);
      if (doctorIdsForSpecialty.length === 0) {
        return [];
      }
    }

    let query = supabase
      .from("doctors")
      .select("id, full_name, department_id, is_active");
    if (departmentId) query = query.eq("department_id", departmentId);
    if (activeOnly) query = query.eq("is_active", true);
    if (doctorIdsForSpecialty) query = query.in("id", doctorIdsForSpecialty);

    const { data: doctorRows, error } = await query
      .order("full_name", { ascending: true })
      .limit(200);
    if (error) {
      throw new Error("Unable to load doctors.");
    }
    const rows = doctorRows ?? [];

    const departmentIds = [
      ...new Set(rows.flatMap((row) => (row.department_id ? [row.department_id] : []))),
    ];
    const [specialtiesByDoctor, departmentNames] = await Promise.all([
      loadDoctorSpecialties(rows.map((row) => row.id)),
      loadDepartmentNames(departmentIds),
    ]);

    return rows.map(
      (row): DoctorSummary => ({
        id: row.id,
        fullName: row.full_name,
        departmentId: row.department_id,
        departmentName: row.department_id
          ? (departmentNames.get(row.department_id) ?? null)
          : null,
        isActive: row.is_active,
        specialties: specialtiesByDoctor.get(row.id) ?? [],
      }),
    );
  },

  async getDoctor(doctorId) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("doctors")
      .select("id, full_name, department_id, is_active")
      .eq("id", doctorId)
      .maybeSingle();

    if (error) {
      throw new Error("Unable to load the doctor.");
    }
    if (!data) {
      return null;
    }

    const [specialtiesByDoctor, departmentNames] = await Promise.all([
      loadDoctorSpecialties([data.id]),
      loadDepartmentNames(data.department_id ? [data.department_id] : []),
    ]);
    return {
      id: data.id,
      fullName: data.full_name,
      departmentId: data.department_id,
      departmentName: data.department_id
        ? (departmentNames.get(data.department_id) ?? null)
        : null,
      isActive: data.is_active,
      specialties: specialtiesByDoctor.get(data.id) ?? [],
    };
  },

  async saveDoctor({ doctorId, fullName, departmentId, specialtyIds, isActive }) {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.rpc("cammi_connect_save_doctor", {
      p_doctor_id: doctorId,
      p_full_name: fullName,
      p_department_id: departmentId,
      p_is_active: isActive,
      p_specialty_ids: specialtyIds,
    });

    if (error?.message === "profile_not_found") {
      return "not_found";
    }
    if (error) {
      throw new Error("Unable to save the doctor.");
    }
    return "saved";
  },

  /**
   * Registered patient accounts that an admin may promote to a doctor login.
   * Only names are returned; contact details stay out of the admin picker.
   */
  async listLinkableAccounts() {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "patient")
      .not("auth_user_id", "is", null)
      .order("full_name", { ascending: true })
      .limit(200);

    if (error) {
      throw new Error("Unable to load accounts.");
    }
    return (data ?? []).map((row) => ({
      profileId: row.id,
      fullName: row.full_name,
    }));
  },
};

async function loadDepartmentNames(
  departmentIds: string[],
): Promise<Map<string, string>> {
  if (departmentIds.length === 0) {
    return new Map();
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("departments")
    .select("id, name")
    .in("id", departmentIds);
  if (error) {
    throw new Error("Unable to load departments.");
  }
  return new Map((data ?? []).map((row) => [row.id, row.name]));
}
