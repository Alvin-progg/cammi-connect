"use client";

import { FormFooter } from "@/components/admin/form-parts";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { canTransitionKnowledge } from "@/lib/knowledge/transitions";
import type { KnowledgeDocumentSummary } from "@/lib/knowledge/types";
import {
  archiveKnowledgeDocumentAction,
  publishKnowledgeDocumentAction,
  reprocessKnowledgeDocumentAction,
  restoreKnowledgeDocumentAction,
  type KnowledgeActionState,
} from "@/server/knowledge/actions";

const IDLE_STATE: KnowledgeActionState = { status: "idle" };

type StatusAction = (state: KnowledgeActionState, formData: FormData) => Promise<KnowledgeActionState>;

function StatusForm({
  documentId,
  action,
  description,
  label,
  pendingLabel,
  variant,
}: {
  documentId: string;
  action: StatusAction;
  description: string;
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "outlineDanger";
}) {
  const { state, formAction, pending } = useAdminForm(action, IDLE_STATE);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="documentId" value={documentId} />
      <p className="text-sm text-ink-secondary">{description}</p>
      <FormFooter
        state={state}
        pending={pending}
        label={label}
        pendingLabel={pendingLabel}
        variant={variant}
      />
    </form>
  );
}

/** The status actions a knowledge document allows (draft → published → archived → draft). */
export function KnowledgeLifecycle({ document }: { document: KnowledgeDocumentSummary }) {
  const can = (to: "published" | "archived" | "draft") => canTransitionKnowledge(document.status, to);

  return (
    <div className="flex flex-col gap-6">
      {can("published") ? (
        <StatusForm
          documentId={document.id}
          action={publishKnowledgeDocumentAction}
          description="Publishing processes the document right away. Cami starts using it once processing is ready."
          label="Publish"
          pendingLabel="Publishing…"
        />
      ) : null}
      {can("archived") ? (
        <StatusForm
          documentId={document.id}
          action={archiveKnowledgeDocumentAction}
          description="Archiving removes the document from Cami's answers right away. It stays on record."
          label="Archive"
          pendingLabel="Archiving…"
          variant="outlineDanger"
        />
      ) : null}
      {can("draft") ? (
        <StatusForm
          documentId={document.id}
          action={restoreKnowledgeDocumentAction}
          description="This document is archived and Cami doesn't use it. Restore it as a draft to edit and publish it again."
          label="Restore as draft"
          pendingLabel="Restoring…"
          variant="secondary"
        />
      ) : null}
      {document.status === "published" ? (
        <StatusForm
          documentId={document.id}
          action={reprocessKnowledgeDocumentAction}
          description="Reprocessing rebuilds the document's search index. Cami keeps using the current index until the new one is ready."
          label="Reprocess"
          pendingLabel="Reprocessing…"
          variant="secondary"
        />
      ) : null}
    </div>
  );
}
