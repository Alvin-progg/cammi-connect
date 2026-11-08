import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { TaskCard } from "@/components/admin/form-parts";
import { AuditLogDiff } from "@/components/audit-log/audit-log-diff";
import { AccessDenied } from "@/components/auth/access-denied";
import { parseRecordIdParam } from "@/lib/admin/dashboard";
import { formatManilaDateTime } from "@/lib/appointments/format";
import { AUDIT_LOG_PATH, auditTargetHref, auditTargetLabel } from "@/lib/audit/log";
import { supabaseAuditLogReader } from "@/server/audit/repository";
import { getAuditLog } from "@/server/audit/service";
import { getAdminSession } from "@/server/auth/dal";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Audit entry" };

const TERM_CLASS = "text-xs font-medium text-ink-muted";
const DETAIL_CLASS = "mt-0.5 break-words text-sm text-ink";

/** One audit entry with its previous and new values side by side (ADM-16). Read-only. */
export default async function AdminAuditEntryPage({ params }: PageProps<"/admin/audit-log/[id]">) {
  const { id } = await params;
  const session = await getAdminSession(`${AUDIT_LOG_PATH}/${encodeURIComponent(id)}`);
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const entryId = parseRecordIdParam(id);
  const entry = entryId ? await getAuditLog(entryId, supabaseAuditLogReader) : null;
  if (!entry) {
    notFound();
  }
  const targetHref = auditTargetHref(entry.targetType, entry.targetId);

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="audit-log"
      crumbs={[{ label: "Audit Log", href: AUDIT_LOG_PATH }, { label: entry.action }]}
    >
      <div className="flex flex-col gap-6">
        <TaskCard title="Entry">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className={TERM_CLASS}>Time (Asia/Manila)</dt>
              <dd className={DETAIL_CLASS}>{formatManilaDateTime(entry.createdAt)}</dd>
            </div>
            <div>
              <dt className={TERM_CLASS}>Actor</dt>
              <dd className={DETAIL_CLASS}>{entry.actorName ?? "Unknown"}</dd>
            </div>
            <div>
              <dt className={TERM_CLASS}>Action</dt>
              <dd className={`${DETAIL_CLASS} font-mono`}>{entry.action}</dd>
            </div>
            <div>
              <dt className={TERM_CLASS}>Target</dt>
              <dd className={DETAIL_CLASS}>
                {targetHref ? (
                  <Link
                    href={targetHref}
                    className="rounded font-medium text-primary underline-offset-4 focus-ring hover:underline"
                  >
                    {auditTargetLabel(entry.targetType)}
                  </Link>
                ) : (
                  auditTargetLabel(entry.targetType)
                )}
                <span className="ml-2 font-mono text-xs text-ink-muted">{entry.targetId}</span>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className={TERM_CLASS}>Reason</dt>
              <dd className={DETAIL_CLASS}>{entry.reason ?? "—"}</dd>
            </div>
          </dl>
        </TaskCard>
        <TaskCard title="Values" description="Credential-like fields are removed before an entry is saved.">
          <AuditLogDiff previousValues={entry.previousValues} newValues={entry.newValues} />
        </TaskCard>
      </div>
    </AdminShell>
  );
}
