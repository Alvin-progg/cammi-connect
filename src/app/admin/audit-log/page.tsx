import type { Metadata } from "next";

import { AdminPlaceholderPage } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Audit Log" };

export default function AdminAuditLogPage() {
  return <AdminPlaceholderPage section="audit-log" label="Audit Log" path="/admin/audit-log" />;
}
