import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { AuditLogFilters, AuditLogTable } from "@/components/audit-log/audit-log-table";
import { AccessDenied } from "@/components/auth/access-denied";
import { AUDIT_LOG_PAGE_SIZE, AUDIT_LOG_PATH, parseAuditLogFilters } from "@/lib/audit/log";
import { supabaseAuditLogReader } from "@/server/audit/repository";
import { listAuditLogs } from "@/server/audit/service";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseUserAdminRepository } from "@/server/users/repository";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Audit Log" };

/** Admin actors offered in the filter; a former admin's entries still show under "All admins". */
const ACTOR_OPTION_LIMIT = 200;

/** Read-only view of admin changes in `audit_logs` (spec-admin ADM-16). */
export default async function AdminAuditLogPage({ searchParams }: PageProps<"/admin/audit-log">) {
  const params = await searchParams;
  const session = await getAdminSession(AUDIT_LOG_PATH);
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const filters = parseAuditLogFilters(params);
  const [admins, { items, total }] = await Promise.all([
    supabaseUserAdminRepository.listUsers({
      search: "",
      role: "admin",
      isActive: null,
      limit: ACTOR_OPTION_LIMIT,
      offset: 0,
    }),
    listAuditLogs(filters, supabaseAuditLogReader),
  ]);

  return (
    <AdminShell adminName={session.admin.fullName} active="audit-log" crumbs={[{ label: "Audit Log" }]}>
      <div className="flex flex-col gap-6">
        <p className="text-sm text-ink-secondary">
          Every admin change and export, newest first. Entries can&apos;t be edited or deleted.
          Appointment status history is on each appointment&apos;s page.
        </p>
        <AuditLogFilters
          filters={filters}
          actors={admins.users.map((admin) => ({ id: admin.id, name: admin.fullName }))}
        />
        <AuditLogTable
          entries={items}
          total={total}
          filters={filters}
          pageCount={Math.max(1, Math.ceil(total / AUDIT_LOG_PAGE_SIZE))}
        />
      </div>
    </AdminShell>
  );
}
