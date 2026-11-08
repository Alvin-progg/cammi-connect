"use client";

import { useState } from "react";

import { FIELD_CLASS, Field, FormFooter } from "@/components/admin/form-parts";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { KNOWLEDGE_CONTENT_MAX_CHARS } from "@/lib/knowledge/schemas";
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CATEGORY_LABELS,
  type KnowledgeDocument,
} from "@/lib/knowledge/types";
import {
  saveKnowledgeDocumentAction,
  type KnowledgeActionState,
} from "@/server/knowledge/actions";

const IDLE_STATE: KnowledgeActionState = { status: "idle" };

/**
 * Creates a draft knowledge document, or edits a draft or published one.
 * Archived documents are restored before editing. An uploaded file's text
 * replaces the content on save.
 */
export function KnowledgeForm({ document }: { document?: KnowledgeDocument }) {
  const { state, formAction, pending } = useAdminForm(saveKnowledgeDocumentAction, IDLE_STATE);
  // Controlled so long content survives React's form reset when a save is refused.
  const [content, setContent] = useState(document?.content ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {document ? <input type="hidden" name="documentId" value={document.id} /> : null}
      <Field id="knowledge-title" label="Title">
        <input
          id="knowledge-title"
          name="title"
          required
          maxLength={200}
          defaultValue={document?.title}
          className={FIELD_CLASS}
        />
      </Field>
      <Field id="knowledge-category" label="Category">
        <select
          id="knowledge-category"
          name="category"
          required
          defaultValue={document?.category ?? ""}
          className={FIELD_CLASS}
        >
          <option value="" disabled>
            Choose a category
          </option>
          {KNOWLEDGE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {KNOWLEDGE_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="knowledge-content" label="Content">
        <textarea
          id="knowledge-content"
          name="content"
          rows={16}
          maxLength={KNOWLEDGE_CONTENT_MAX_CHARS}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className={`${FIELD_CLASS} py-2 font-mono`}
        />
      </Field>
      <Field id="knowledge-file" label="Upload a file (optional, replaces the content)">
        <input
          id="knowledge-file"
          name="file"
          type="file"
          accept=".txt,.md,.pdf"
          className="text-sm text-ink-secondary file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-control-line file:bg-surface file:px-3 file:text-sm file:text-ink"
        />
      </Field>
      <p className="text-sm text-ink-secondary">
        Plain text, Markdown, or PDF, up to 5 MB. Scanned PDFs without a text layer can&apos;t be
        read.
      </p>
      {document?.status === "published" ? (
        <p className="text-sm text-ink-secondary">
          {`This document is published. Saving changed content saves version ${document.version + 1}; Cami keeps using version ${document.version} until the new one is processed.`}
        </p>
      ) : null}
      <FormFooter state={state} pending={pending} label={document ? "Save" : "Create draft"} />
    </form>
  );
}
