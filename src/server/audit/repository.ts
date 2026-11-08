import "server-only";

import { auditLogDateBounds, type AuditLogEntry } from "@/lib/audit/log";
import type { JsonValue } from "@/lib/audit/redact";
import { getSupabaseAdminClient } from "@/server/db/admin-client";
import type { Database } from "@/server/db/database.types";

import type { AuditLogReader, AuditLogWriter } from "./service";

export const supabaseAuditLogRepository: AuditLogWriter = {
  async insert(row) {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("audit_logs").insert({
      actor_profile_id: row.actorProfileId,
      action: row.action,
      target_type: row.targetType,
      target_id: row.targetId,
      previous_values: row.previousValues,
      new_values: row.newValues,
      reason: row.reason,
    });

    if (error) {
      throw new Error("Unable to record the audit event.");
    }
  },
};

type AuditLogRow = Database["public"]["Tables"]["audit_logs"]["Row"];

const AUDIT_LOG_COLUMNS =
  "id, created_at, actor_profile_id, action, target_type, target_id, reason, previous_values, new_values";

async function loadActorNames(actorIds: string[]): Promise<Map<string, string>> {
  if (actorIds.length === 0) return new Map();
  const { data, error } = await getSupabaseAdminClient()
    .from("profiles")
    .select("id, full_name")
    .in("id", actorIds);
  if (error) {
    throw new Error("Unable to load audit log actors.");
  }
  return new Map((data ?? []).map((profile) => [profile.id, profile.full_name]));
}

async function toEntries(rows: AuditLogRow[]): Promise<AuditLogEntry[]> {
  const names = await loadActorNames([...new Set(rows.map((row) => row.actor_profile_id))]);
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    actorProfileId: row.actor_profile_id,
    actorName: names.get(row.actor_profile_id) ?? null,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    // Parsed from jsonb, so the values never hold `undefined` (which Json allows).
    previousValues: row.previous_values as JsonValue,
    newValues: row.new_values as JsonValue,
  }));
}

/** Read-only access for the audit log viewer (ADM-16). */
export const supabaseAuditLogReader: AuditLogReader = {
  async list({ filters, offset, limit }) {
    let query = getSupabaseAdminClient()
      .from("audit_logs")
      .select(AUDIT_LOG_COLUMNS, { count: "exact" });
    if (filters.actorId) query = query.eq("actor_profile_id", filters.actorId);
    // Prefixes come from an allow-list of plain words, so no LIKE wildcard reaches the query.
    if (filters.actionPrefix) query = query.like("action", `${filters.actionPrefix}.%`);
    if (filters.targetType) query = query.eq("target_type", filters.targetType);
    const { start, end } = auditLogDateBounds(filters);
    if (start) query = query.gte("created_at", start);
    if (end) query = query.lt("created_at", end);

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      throw new Error("Unable to load the audit log.");
    }
    return { items: await toEntries(data ?? []), total: count ?? 0 };
  },

  async get(id) {
    const { data, error } = await getSupabaseAdminClient()
      .from("audit_logs")
      .select(AUDIT_LOG_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new Error("Unable to load the audit entry.");
    }
    return data ? ((await toEntries([data]))[0] ?? null) : null;
  },
};
