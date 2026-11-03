import "server-only";

import type { DepartmentConflict, DepartmentStatRow } from "@/lib/departments/types";
import { getSupabaseAdminClient } from "@/server/db/admin-client";
import { supabaseDirectoryRepository } from "@/server/directory/repository";

import type { DepartmentAdminStore } from "./service";

/** P0001 refusals carry their code as the message; anything else is unexpected. */
function refusalCode(error: { code?: string; message: string }): string | undefined {
  if (error.code === "P0001") {
    return error.message;
  }
  console.error("Admin department database call failed.");
  return undefined;
}

export const supabaseDepartmentAdminRepository: DepartmentAdminStore = {
  listDepartments: () => supabaseDirectoryRepository.listDepartments(),

  listDoctors: (departmentId) =>
    supabaseDirectoryRepository.listDoctors({ departmentId, activeOnly: false }),

  async countDoctorsByDepartment() {
    const { data, error } = await getSupabaseAdminClient()
      .from("doctors")
      .select("department_id")
      .not("department_id", "is", null);
    if (error) {
      throw new Error("Unable to count doctors per department.");
    }
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      if (row.department_id) {
        counts.set(row.department_id, (counts.get(row.department_id) ?? 0) + 1);
      }
    }
    return counts;
  },

  async listAppointmentStats({ from, to }) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_department_appointment_stats",
      { p_from: from.toISOString(), p_to: to.toISOString() },
    );
    if (error) {
      throw new Error("Unable to load department appointment stats.");
    }
    return (data ?? []).map(
      (row): DepartmentStatRow => ({
        departmentId: row.department_id,
        status: row.status,
        count: Number(row.appointment_count),
      }),
    );
  },

  async getDepartment(departmentId) {
    const { data, error } = await getSupabaseAdminClient()
      .from("departments")
      .select("id, name, code, description, is_active")
      .eq("id", departmentId)
      .maybeSingle();
    if (error) {
      throw new Error("Unable to load the department.");
    }
    return data
      ? {
          id: data.id,
          name: data.name,
          code: data.code,
          description: data.description,
          isActive: data.is_active,
        }
      : null;
  },

  async listFutureConflicts(departmentId) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_department_future_conflicts",
      { p_department_id: departmentId },
    );
    if (error) {
      throw new Error("Unable to check the department's upcoming appointments.");
    }
    return (data ?? []).map(
      (row): DepartmentConflict => ({
        appointmentId: row.appointment_id,
        scheduledAt: row.scheduled_at,
        status: row.status,
        doctorName: row.doctor_name,
      }),
    );
  },

  async save({ actorId, departmentId, name, code, description }) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_save_department",
      {
        p_actor_profile_id: actorId,
        p_department_id: departmentId,
        p_name: name,
        p_code: code,
        p_description: description,
      },
    );
    if (error || !data) {
      return { ok: false, code: error ? refusalCode(error) : undefined };
    }
    return { ok: true, departmentId: data };
  },

  async setActive({ actorId, departmentId, isActive }) {
    const { error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_set_department_active",
      {
        p_actor_profile_id: actorId,
        p_department_id: departmentId,
        p_is_active: isActive,
      },
    );
    return error ? { ok: false, code: refusalCode(error) } : { ok: true };
  },
};
