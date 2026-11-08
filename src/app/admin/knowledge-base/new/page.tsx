import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { TaskCard } from "@/components/admin/form-parts";
import { AccessDenied } from "@/components/auth/access-denied";
import { KnowledgeForm } from "@/components/knowledge/knowledge-form";
import { getAdminSession } from "@/server/auth/dal";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "New document" };

export default async function AdminNewKnowledgeDocumentPage() {
  const session = await getAdminSession("/admin/knowledge-base/new");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="knowledge-base"
      crumbs={[{ label: "Knowledge Base", href: "/admin/knowledge-base" }, { label: "New document" }]}
    >
      <TaskCard
        title="New document"
        description="New documents start as drafts. Cami only uses published documents."
      >
        <KnowledgeForm />
      </TaskCard>
    </AdminShell>
  );
}
