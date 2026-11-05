import type { NextRequest } from "next/server";

import { analyticsDatasetCsv, isAnalyticsDataset } from "@/lib/analytics/csv";
import { ANALYTICS_PATH, parseAnalyticsFilters, toAnalyticsQuery } from "@/lib/analytics/filters";
import { supabaseAnalyticsRepository } from "@/server/analytics/repository";
import { loadAnalytics } from "@/server/analytics/service";
import { supabaseAuditLogRepository } from "@/server/audit/repository";
import { recordAdminAudit } from "@/server/audit/service";
import { getAdminSession } from "@/server/auth/dal";

/**
 * CSV download of one analytics dataset (ADM-11), served from the same metric
 * layer as the page. Admin only; every export is audited with its filters.
 */
export async function GET(request: NextRequest): Promise<Response> {
  // Anonymous visitors are redirected to sign in by the guard itself.
  const session = await getAdminSession(ANALYTICS_PATH);
  if (!session) {
    return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }

  const params = request.nextUrl.searchParams;
  const dataset = params.get("dataset") ?? "";
  if (!isAnalyticsDataset(dataset)) {
    return new Response("Unknown dataset", { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }

  const filters = parseAnalyticsFilters({
    range: params.get("range") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    doctor: params.get("doctor") ?? undefined,
    department: params.get("department") ?? undefined,
  });
  const analytics = await loadAnalytics(toAnalyticsQuery(filters), supabaseAnalyticsRepository);
  const csv = analyticsDatasetCsv(dataset, analytics);

  await recordAdminAudit(
    {
      actorProfileId: session.admin.id,
      action: "analytics.export",
      targetType: "analytics",
      targetId: dataset,
      newValues: { ...filters },
    },
    supabaseAuditLogRepository,
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="analytics-${dataset}-${filters.from}-to-${filters.to}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
