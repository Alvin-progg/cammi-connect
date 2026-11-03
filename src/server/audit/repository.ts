import "server-only";

import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type { AuditLogWriter } from "./service";

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
