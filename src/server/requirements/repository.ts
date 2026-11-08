import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { AppointmentRequirement, RequirementTarget } from "@/lib/requirements/types";
import { REFERENCE_CACHE_TAG } from "@/server/cache/reference-tag";
import { getSupabaseAdminClient } from "@/server/db/admin-client";
import type { Database } from "@/server/db/database.types";

import type { RequirementAdminStore } from "./service";

type RequirementRow = Omit<
  Database["public"]["Tables"]["service_requirements"]["Row"],
  "created_at" | "updated_at"
>;

const REQUIREMENT_COLUMNS =
  "id, title, description, service_id, specialty_id, is_mandatory, effective_from, effective_to, status, superseded_by";

/** P0001 refusals carry their code as the message; anything else is unexpected. */
function refusalCode(error: { code?: string; message: string }): string | undefined {
  if (error.code === "P0001") {
    return error.message;
  }
  console.error("Admin requirement database call failed.");
  return undefined;
}

async function loadNames(
  table: "services" | "specialties",
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) {
    return new Map();
  }
  const { data, error } = await getSupabaseAdminClient()
    .from(table)
    .select("id, name")
    .in("id", ids);
  if (error) {
    throw new Error("Unable to load requirement targets.");
  }
  return new Map((data ?? []).map((row) => [row.id, row.name]));
}

function uniqueIds(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => value !== null))];
}

function toTarget(
  row: RequirementRow,
  serviceNames: Map<string, string>,
  specialtyNames: Map<string, string>,
): RequirementTarget {
  if (row.service_id) {
    return { kind: "service", id: row.service_id, name: serviceNames.get(row.service_id) ?? null };
  }
  if (row.specialty_id) {
    return {
      kind: "specialty",
      id: row.specialty_id,
      name: specialtyNames.get(row.specialty_id) ?? null,
    };
  }
  // The service_requirements_one_target check makes this unreachable.
  throw new Error("Requirement has no service or specialty.");
}

async function toRequirements(rows: RequirementRow[]): Promise<AppointmentRequirement[]> {
  const [serviceNames, specialtyNames] = await Promise.all([
    loadNames("services", uniqueIds(rows.map((row) => row.service_id))),
    loadNames("specialties", uniqueIds(rows.map((row) => row.specialty_id))),
  ]);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    target: toTarget(row, serviceNames, specialtyNames),
    isMandatory: row.is_mandatory,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    status: row.status,
    supersededBy: row.superseded_by,
  }));
}

/**
 * Appointment requirement list and detail.
 * Cached until a write action calls `updateTag(REFERENCE_CACHE_TAG)`.
 */
async function cachedListRequirements(
  { status, kind, serviceId }: Parameters<RequirementAdminStore["listRequirements"]>[0],
): ReturnType<RequirementAdminStore["listRequirements"]> {
  "use cache";
  cacheTag(REFERENCE_CACHE_TAG);
  cacheLife("hours");

  let query = getSupabaseAdminClient()
    .from("service_requirements")
    .select(REQUIREMENT_COLUMNS)
    .order("effective_from", { ascending: false })
    .order("title", { ascending: true });
  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (kind === "service") {
    query = query.not("service_id", "is", null);
  } else if (kind === "specialty") {
    query = query.not("specialty_id", "is", null);
  }
  if (serviceId) {
    query = query.eq("service_id", serviceId);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error("Unable to load requirements.");
  }
  return toRequirements(data ?? []);
}

async function cachedGetRequirement(
  requirementId: Parameters<RequirementAdminStore["getRequirement"]>[0],
): ReturnType<RequirementAdminStore["getRequirement"]> {
  "use cache";
  cacheTag(REFERENCE_CACHE_TAG);
  cacheLife("hours");

  const { data, error } = await getSupabaseAdminClient()
    .from("service_requirements")
    .select(REQUIREMENT_COLUMNS)
    .eq("id", requirementId)
    .maybeSingle();
  if (error) {
    throw new Error("Unable to load the requirement.");
  }
  if (!data) {
    return null;
  }
  const [requirement] = await toRequirements([data]);
  return requirement;
}

export const supabaseRequirementAdminRepository: RequirementAdminStore = {
  listRequirements: cachedListRequirements,

  getRequirement: cachedGetRequirement,

  async save({ actorId, requirementId, target, ...input }) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_save_requirement",
      {
        p_actor_profile_id: actorId,
        p_requirement_id: requirementId,
        p_title: input.title,
        p_description: input.description,
        p_service_id: target.kind === "service" ? target.id : null,
        p_specialty_id: target.kind === "specialty" ? target.id : null,
        p_is_mandatory: input.isMandatory,
        p_effective_from: input.effectiveFrom,
        p_effective_to: input.effectiveTo,
      },
    );
    if (error || !data) {
      return { ok: false, code: error ? refusalCode(error) : undefined };
    }
    return { ok: true, requirementId: data };
  },

  async publish({ actorId, requirementId }) {
    const { error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_publish_requirement",
      { p_actor_profile_id: actorId, p_requirement_id: requirementId },
    );
    return error ? { ok: false, code: refusalCode(error) } : { ok: true };
  },

  async archive({ actorId, requirementId }) {
    const { error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_archive_requirement",
      { p_actor_profile_id: actorId, p_requirement_id: requirementId },
    );
    return error ? { ok: false, code: refusalCode(error) } : { ok: true };
  },

  async supersede({ actorId, requirementId, startsOn }) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_supersede_requirement",
      { p_actor_profile_id: actorId, p_requirement_id: requirementId, p_starts_on: startsOn },
    );
    if (error || !data) {
      return { ok: false, code: error ? refusalCode(error) : undefined };
    }
    return { ok: true, requirementId: data };
  },
};
