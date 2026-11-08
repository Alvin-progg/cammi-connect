import type { Metadata } from "next";
import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { FailedDocumentsPanel, KnowledgeList } from "@/components/knowledge/knowledge-list";
import { Button, buttonVariants } from "@/components/ui/button";
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

export const instant = false;

export const metadata: Metadata = { title: "Knowledge Base" };

const SELECT_CLASS =
  "min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring";
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
  const [documents, failed] = await Promise.all([
    listKnowledgeDocuments({ status, category }, supabaseKnowledgeAdminRepository),
    listKnowledgeDocuments(
      { status: "all", category: "all", processingStatus: "failed" },
      supabaseKnowledgeAdminRepository,
    ),
  ]);

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="knowledge-base"
      crumbs={[{ label: "Knowledge Base" }]}
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
                className={SELECT_CLASS}
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
              <select id="filter-status" name="status" defaultValue={status} className={SELECT_CLASS}>
                <option value="all">All statuses</option>
                {KNOWLEDGE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {KNOWLEDGE_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary">
              Filter
            </Button>
          </form>
          <Link href="/admin/knowledge-base/new" className={buttonVariants()}>
            New document
          </Link>
        </div>
        <KnowledgeList documents={documents} />
      </div>
    </AdminShell>
  );
}
