import type { NextRequest } from "next/server";

import { AUDIT_LOG_PATH, auditLogCsv, parseAuditLogFilters } from "@/lib/audit/log";
import { supabaseAuditLogReader, supabaseAuditLogRepository } from "@/server/audit/repository";
import { AUDIT_EXPORT_MAX_ROWS, loadAuditLogExport, recordAdminAudit } from "@/server/audit/service";
import { getAdminSession } from "@/server/auth/dal";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * CSV download of the audit log entries matching the viewer's filters
 * (ADM-16). Admin only; the export is itself audited as `audit.export`.
 */
export async function GET(request: NextRequest): Promise<Response> {
  // Anonymous visitors are redirected to sign in by the guard itself.
  const session = await getAdminSession(AUDIT_LOG_PATH);
  if (!session) {
    return new Response("Forbidden", { status: 403, headers: NO_STORE });
  }

  const params = request.nextUrl.searchParams;
  const filters = parseAuditLogFilters({
    actor: params.get("actor") ?? undefined,
    action: params.get("action") ?? undefined,
    target: params.get("target") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });

  const exported = await loadAuditLogExport(filters, supabaseAuditLogReader);
  if (!exported.ok) {
    return new Response(
      `That selection has ${exported.total} entries; exports are limited to ${AUDIT_EXPORT_MAX_ROWS}. Narrow the filters and try again.`,
      { status: 413, headers: NO_STORE },
    );
  }

  await recordAdminAudit(
    {
      actorProfileId: session.admin.id,
      action: "audit.export",
      targetType: "audit_logs",
      targetId: "export",
      newValues: {
        actorId: filters.actorId,
        actionPrefix: filters.actionPrefix,
        targetType: filters.targetType,
        from: filters.from,
        to: filters.to,
        rows: exported.entries.length,
      },
    },
    supabaseAuditLogRepository,
  );

  return new Response(auditLogCsv(exported.entries), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="audit-log.csv"',
      ...NO_STORE,
    },
  });
}
