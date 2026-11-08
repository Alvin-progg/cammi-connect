import "server-only";

import { hashKnowledgeContent } from "@/lib/knowledge/content";
import { knowledgeRefusalFromCode, type KnowledgeRefusal } from "@/lib/knowledge/refusals";
import type { KnowledgeFormInput } from "@/lib/knowledge/schemas";
import type {
  KnowledgeCategoryFilter,
  KnowledgeDocument,
  KnowledgeDocumentSummary,
  KnowledgeProcessingStatus,
  KnowledgeStatus,
  KnowledgeStatusFilter,
} from "@/lib/knowledge/types";

type DatabaseOutcome = { ok: true } | { ok: false; code: string | undefined };
type CreatedOutcome = { ok: true; documentId: string } | { ok: false; code: string | undefined };

export type KnowledgeListFilters = {
  status: KnowledgeStatusFilter;
  category: KnowledgeCategoryFilter;
  processingStatus?: KnowledgeProcessingStatus;
};

type StatusChange = { actorId: string; documentId: string; status: KnowledgeStatus };

/**
 * Data access for admin knowledge document management (separate from the chat
 * retrieval store in ./service). Callers authorize first, and `actorId` must
 * come from the admin session.
 */
export type KnowledgeAdminStore = {
  listDocuments(filters: KnowledgeListFilters): Promise<KnowledgeDocumentSummary[]>;
  getDocument(documentId: string): Promise<KnowledgeDocument | null>;
  save(
    input: {
      actorId: string;
      documentId: string | null;
      contentHash: string;
      sourceFileName: string | null;
    } & KnowledgeFormInput,
  ): Promise<CreatedOutcome>;
  setStatus(input: StatusChange): Promise<DatabaseOutcome>;
};

const REFUSAL_MESSAGES: Record<KnowledgeRefusal, string> = {
  not_admin: "Only an active administrator can manage knowledge documents.",
  not_found: "That document no longer exists.",
  not_editable: "An archived document can't be edited. Restore it as a draft first.",
  invalid_transition: "The document's status changed. Reload the page and try again.",
};

const STATUS_MESSAGES: Record<KnowledgeStatus, string> = {
  published: "Document published. Cami will use it once processing finishes.",
  archived: "Document archived. Cami no longer uses it.",
  draft: "Document restored as a draft.",
};

const GENERIC_FAILURE = "Something went wrong. Try again.";

function refusalMessage(code: string | undefined): string {
  const refusal = knowledgeRefusalFromCode(code);
  return refusal ? REFUSAL_MESSAGES[refusal] : GENERIC_FAILURE;
}

type Result = { ok: true; message: string } | { ok: false; message: string };
type CreatedResult = { ok: true; documentId: string; message: string } | { ok: false; message: string };

export function listKnowledgeDocuments(
  filters: KnowledgeListFilters,
  store: KnowledgeAdminStore,
): Promise<KnowledgeDocumentSummary[]> {
  return store.listDocuments(filters);
}

export function getKnowledgeDocument(
  documentId: string,
  store: KnowledgeAdminStore,
): Promise<KnowledgeDocument | null> {
  return store.getDocument(documentId);
}

/**
 * Creates a draft, or edits a draft or published document. Editing a
 * published document's content bumps its version for re-ingestion (0025).
 */
export async function saveKnowledgeDocument(
  {
    actorId,
    documentId,
    input,
    sourceFileName,
  }: {
    actorId: string;
    documentId: string | null;
    input: KnowledgeFormInput;
    sourceFileName: string | null;
  },
  store: KnowledgeAdminStore,
): Promise<CreatedResult> {
  const saved = await store.save({
    actorId,
    documentId,
    ...input,
    contentHash: await hashKnowledgeContent(input.content),
    sourceFileName,
  });
  if (!saved.ok) {
    return { ok: false, message: refusalMessage(saved.code) };
  }
  return { ok: true, documentId: saved.documentId, message: "Document saved." };
}

/** Publish (draft), archive (draft or published), or restore (archived → draft). */
export async function changeKnowledgeDocumentStatus(
  input: StatusChange,
  store: KnowledgeAdminStore,
): Promise<Result> {
  const outcome = await store.setStatus(input);
  if (!outcome.ok) {
    return { ok: false, message: refusalMessage(outcome.code) };
  }
  return { ok: true, message: STATUS_MESSAGES[input.status] };
}
