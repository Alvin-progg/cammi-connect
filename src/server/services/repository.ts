import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { HospitalService } from "@/lib/services/types";
import { REFERENCE_CACHE_TAG } from "@/server/cache/reference-tag";
import { getSupabaseAdminClient } from "@/server/db/admin-client";
import type { Database } from "@/server/db/database.types";
import { loadDepartmentNames } from "@/server/directory/repository";

import type { ServiceAdminStore } from "./service";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

// One literal, so supabase-js can type the selected row.
const SERVICE_COLUMNS =
  "id, name, description, department_id, requires_appointment, booking_mode, is_active, category, price_centavos, vatable, philhealth_benefit_centavos, hmo_coverable, requires_doctor_request, daily_capacity";

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
    category: row.category,
    priceCentavos: row.price_centavos,
    vatable: row.vatable,
    philhealthBenefitCentavos: row.philhealth_benefit_centavos,
    hmoCoverable: row.hmo_coverable,
    requiresDoctorRequest: row.requires_doctor_request,
    dailyCapacity: row.daily_capacity,
  }));
}

/**
 * Hospital service list and detail.
 * Cached until a write action calls `updateTag(REFERENCE_CACHE_TAG)`.
 */
async function cachedListServices(
  { departmentId, status }: Parameters<ServiceAdminStore["listServices"]>[0],
): ReturnType<ServiceAdminStore["listServices"]> {
  "use cache";
  cacheTag(REFERENCE_CACHE_TAG);
  cacheLife("hours");

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
}

async function cachedGetService(
  serviceId: Parameters<ServiceAdminStore["getService"]>[0],
): ReturnType<ServiceAdminStore["getService"]> {
  "use cache";
  cacheTag(REFERENCE_CACHE_TAG);
  cacheLife("hours");

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
}

export const supabaseServiceAdminRepository: ServiceAdminStore = {
  listServices: cachedListServices,

  getService: cachedGetService,

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
        p_category: input.category,
        p_price_centavos: input.priceCentavos,
        p_vatable: input.vatable,
        p_philhealth_benefit_centavos: input.philhealthBenefitCentavos,
        p_hmo_coverable: input.hmoCoverable,
        p_requires_doctor_request: input.requiresDoctorRequest,
        p_daily_capacity: input.dailyCapacity,
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
