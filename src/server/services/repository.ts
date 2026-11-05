import "server-only";

import type { HospitalService } from "@/lib/services/types";
import { getSupabaseAdminClient } from "@/server/db/admin-client";
import type { Database } from "@/server/db/database.types";
import { loadDepartmentNames } from "@/server/directory/repository";

import type { ServiceAdminStore } from "./service";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

const SERVICE_COLUMNS =
  "id, name, description, department_id, requires_appointment, booking_mode, is_active";

/** P0001 refusals carry their code as the message; anything else is unexpected. */
function refusalCode(error: { code?: string; message: string }): string | undefined {
  if (error.code === "P0001") {
    return error.message;
  }
  console.error("Admin service database call failed.");
  return undefined;
}

async function toServices(
  rows: Omit<ServiceRow, "created_at" | "updated_at">[],
): Promise<HospitalService[]> {
  const departmentIds = [
    ...new Set(rows.flatMap((row) => (row.department_id ? [row.department_id] : []))),
  ];
  const departmentNames = await loadDepartmentNames(departmentIds);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    departmentId: row.department_id,
    departmentName: row.department_id ? (departmentNames.get(row.department_id) ?? null) : null,
    requiresAppointment: row.requires_appointment,
    bookingMode: row.booking_mode,
    isActive: row.is_active,
  }));
}

export const supabaseServiceAdminRepository: ServiceAdminStore = {
  async listServices({ departmentId, status }) {
    let query = getSupabaseAdminClient()
      .from("services")
      .select(SERVICE_COLUMNS)
      .order("name", { ascending: true });
    if (departmentId) {
      query = query.eq("department_id", departmentId);
    }
    if (status !== "all") {
      query = query.eq("is_active", status === "active");
    }
    const { data, error } = await query;
    if (error) {
      throw new Error("Unable to load services.");
    }
    return toServices(data ?? []);
  },

  async getService(serviceId) {
    const { data, error } = await getSupabaseAdminClient()
      .from("services")
      .select(SERVICE_COLUMNS)
      .eq("id", serviceId)
      .maybeSingle();
    if (error) {
      throw new Error("Unable to load the service.");
    }
    if (!data) {
      return null;
    }
    const [service] = await toServices([data]);
    return service;
  },

  async save({ actorId, serviceId, ...input }) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_save_service",
      {
        p_actor_profile_id: actorId,
        p_service_id: serviceId,
        p_name: input.name,
        p_description: input.description,
        p_department_id: input.departmentId,
        p_requires_appointment: input.requiresAppointment,
        p_booking_mode: input.bookingMode,
      },
    );
    if (error || !data) {
      return { ok: false, code: error ? refusalCode(error) : undefined };
    }
    return { ok: true, serviceId: data };
  },

  async setActive({ actorId, serviceId, isActive }) {
    const { error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_set_service_active",
      {
        p_actor_profile_id: actorId,
        p_service_id: serviceId,
        p_is_active: isActive,
      },
    );
    return error ? { ok: false, code: refusalCode(error) } : { ok: true };
  },
};
