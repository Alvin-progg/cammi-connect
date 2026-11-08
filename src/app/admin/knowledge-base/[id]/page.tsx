import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AdminShell } from "@/components/admin/admin-shell";
import { TaskCard } from "@/components/admin/form-parts";
import { AccessDenied } from "@/components/auth/access-denied";
import {
  KnowledgeProcessingBadge,
  KnowledgeStatusBadge,
} from "@/components/knowledge/knowledge-badges";
import { KnowledgeForm } from "@/components/knowledge/knowledge-form";
import { KnowledgeLifecycle } from "@/components/knowledge/knowledge-lifecycle";
import { formatManilaDateTime } from "@/lib/appointments/format";
import { KNOWLEDGE_CATEGORY_LABELS } from "@/lib/knowledge/types";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseKnowledgeAdminRepository } from "@/server/knowledge/admin-repository";
import { getKnowledgeDocument } from "@/server/knowledge/admin-service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Knowledge document" };

export default async function AdminKnowledgeDocumentPage({
  params,
}: PageProps<"/admin/knowledge-base/[id]">) {
  const { id } = await params;
  const session = await getAdminSession(`/admin/knowledge-base/${encodeURIComponent(id)}`);
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const documentId = z.uuid().safeParse(id);
  const document = documentId.success
    ? await getKnowledgeDocument(documentId.data, supabaseKnowledgeAdminRepository)
    : null;
  if (!document) {
    notFound();
  }

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="knowledge-base"
      crumbs={[
        { label: "Knowledge Base", href: "/admin/knowledge-base" },
        { label: document.title },
      ]}
    >
      <div className="flex flex-col gap-6">
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <dt className="text-ink-muted">Status</dt>
            <dd>
              <KnowledgeStatusBadge status={document.status} />
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-ink-muted">Processing</dt>
            <dd>
              <KnowledgeProcessingBadge status={document.processingStatus} />
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-ink-muted">Version</dt>
            <dd className="tabular-nums text-ink">{`v${document.version}`}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-ink-muted">Updated</dt>
            <dd className="tabular-nums text-ink">{formatManilaDateTime(document.updatedAt)}</dd>
          </div>
          {document.sourceFileName ? (
            <div className="flex items-center gap-2">
              <dt className="text-ink-muted">Uploaded file</dt>
              <dd className="text-ink">{document.sourceFileName}</dd>
            </div>
          ) : null}
        </dl>
        {document.processingStatus === "failed" ? (
          <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-ink">
            {`Processing failed: ${document.processingError ?? "no details recorded."}`}
          </p>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <TaskCard title="Document">
            {document.status === "archived" ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-ink-secondary">
                  {`${KNOWLEDGE_CATEGORY_LABELS[document.category]} · Restore this document as a draft to edit it.`}
                </p>
                <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg bg-surface-muted p-4 text-sm text-ink">
                  {document.content || "No content stored."}
                </pre>
              </div>
            ) : (
              // Remount after each save so the editor shows the stored content.
              <KnowledgeForm key={document.updatedAt} document={document} />
            )}
          </TaskCard>
          <TaskCard title="Status">
            <KnowledgeLifecycle document={document} />
          </TaskCard>
        </div>
      </div>
    </AdminShell>
  );
}
