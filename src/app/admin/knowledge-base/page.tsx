import { Plus } from "lucide-react";
import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import {
  FailedDocumentsPanel,
  KnowledgeCoveragePanel,
  KnowledgeList,
} from "@/components/knowledge/knowledge-list";
import { Button, LinkButton } from "@/components/ui/button";
import { parseKnowledgeCategoryFilter, parseKnowledgeStatusFilter } from "@/lib/knowledge/params";
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CATEGORY_LABELS,
  KNOWLEDGE_STATUSES,
  KNOWLEDGE_STATUS_LABELS,
} from "@/lib/knowledge/types";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseKnowledgeAdminRepository } from "@/server/knowledge/admin-repository";
import { listKnowledgeDocuments } from "@/server/knowledge/admin-service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../_shared/placeholder-page";
import { CONTROL_CLASS } from "@/components/ui/field";

export const instant = false;

export const metadata: Metadata = { title: "Knowledge Base" };

const FILTER_LABEL_CLASS = "text-xs font-medium text-ink-muted";

export default async function AdminKnowledgeBasePage({
  searchParams,
}: PageProps<"/admin/knowledge-base">) {
  const params = await searchParams;
  const session = await getAdminSession("/admin/knowledge-base");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const status = parseKnowledgeStatusFilter(params.status);
  const category = parseKnowledgeCategoryFilter(params.category);
  // The failed panel and coverage are hospital-wide, so they ignore the filters.
  const [documents, allDocuments] = await Promise.all([
    listKnowledgeDocuments({ status, category }, supabaseKnowledgeAdminRepository),
    listKnowledgeDocuments({ status: "all", category: "all" }, supabaseKnowledgeAdminRepository),
  ]);
  const failed = allDocuments.filter((document) => document.processingStatus === "failed");

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="knowledge-base"
      crumbs={[{ label: "Knowledge Base" }]}
      actions={
        <LinkButton size="sm" href="/admin/knowledge-base/new">
          <Plus aria-hidden="true" />
          New document
        </LinkButton>
      }
    >
      <div className="flex flex-col gap-6">
        <FailedDocumentsPanel documents={failed} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <form
            method="get"
            action="/admin/knowledge-base"
            aria-label="Filter knowledge documents"
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-category" className={FILTER_LABEL_CLASS}>
                Category
              </label>
              <select
                id="filter-category"
                name="category"
                defaultValue={category}
                className={CONTROL_CLASS}
              >
                <option value="all">All categories</option>
                {KNOWLEDGE_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {KNOWLEDGE_CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-status" className={FILTER_LABEL_CLASS}>
                Status
              </label>
              <select id="filter-status" name="status" defaultValue={status} className={CONTROL_CLASS}>
                <option value="all">All statuses</option>
                {KNOWLEDGE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {KNOWLEDGE_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="outline" size="sm">
              Filter
            </Button>
          </form>
        </div>
        <KnowledgeList documents={documents} />
        <section aria-labelledby="knowledge-coverage-heading" className="flex flex-col gap-2">
          <h2 id="knowledge-coverage-heading" className="text-base font-semibold text-ink">
            Coverage
          </h2>
          <KnowledgeCoveragePanel documents={allDocuments} />
        </section>
      </div>
    </AdminShell>
  );
}
