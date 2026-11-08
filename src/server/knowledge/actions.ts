"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { knowledgeFormSchema } from "@/lib/knowledge/schemas";
import type { KnowledgeStatus } from "@/lib/knowledge/types";
import { embedTexts } from "@/server/ai/gemini-embeddings";
import { getAdminSession } from "@/server/auth/dal";

import {
  supabaseKnowledgeAdminRepository,
  supabaseKnowledgeIngestionRepository,
} from "./admin-repository";
import {
  changeKnowledgeDocumentStatus,
  reprocessKnowledgeDocument,
  saveKnowledgeDocument,
} from "./admin-service";
import { extractKnowledgeText } from "./extract-text";
import { ingestKnowledgeDocument } from "./ingest";

export type KnowledgeActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const KNOWLEDGE_PATH = "/admin/knowledge-base";

const NOT_AUTHORIZED: KnowledgeActionState = {
  status: "error",
  message: "You are not authorized to manage knowledge documents.",
};

const INVALID_DOCUMENT: KnowledgeActionState = {
  status: "error",
  message: "That document is not valid.",
};

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

/** The acting admin's profile ID, always from the session and never from the form. */
async function requireAdminActor(): Promise<string | null> {
  const session = await getAdminSession(KNOWLEDGE_PATH);
  return session?.admin.id ?? null;
}

/**
 * Ingests the document inline (ADR-0004 interim decision) and adds the
 * outcome to the action's message. Ingestion itself skips documents that
 * aren't published and pending, so callers don't have to check.
 */
async function ingestAfter(documentId: string, message: string): Promise<KnowledgeActionState> {
  const ingestion = await ingestKnowledgeDocument(documentId, {
    store: supabaseKnowledgeIngestionRepository,
    embedDocuments: (texts) => embedTexts(texts, "RETRIEVAL_DOCUMENT"),
  });
  if (ingestion.outcome === "failed") {
    return { status: "error", message: `${message} Processing failed: ${ingestion.error}` };
  }
  if (ingestion.outcome === "ready") {
    return { status: "success", message: `${message} Cami can use it now.` };
  }
  return { status: "success", message };
}

/** An attached file, or null when the file input was left empty. */
function uploadedFile(formData: FormData): File | null {
  const value = formData.get("file");
  return value instanceof File && value.size > 0 ? value : null;
}

export async function saveKnowledgeDocumentAction(
  _previous: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }

  const rawId = text(formData, "documentId")?.trim() || null;
  const documentId = rawId === null ? null : z.uuid().safeParse(rawId).data;
  if (documentId === undefined) {
    return INVALID_DOCUMENT;
  }

  // An uploaded file's text replaces whatever is in the content field.
  let content = text(formData, "content") ?? "";
  const file = uploadedFile(formData);
  if (file) {
    const extracted = await extractKnowledgeText(file);
    if (!extracted.ok) {
      return { status: "error", message: extracted.message };
    }
    content = extracted.text;
  }

  const parsed = knowledgeFormSchema.safeParse({
    title: text(formData, "title") ?? "",
    category: text(formData, "category") ?? "",
    content,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the form values." };
  }

  const result = await saveKnowledgeDocument(
    { actorId, documentId, input: parsed.data, sourceFileName: file?.name ?? null },
    supabaseKnowledgeAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  if (documentId === null) {
    // A new document is always a draft, so there is nothing to ingest.
    revalidatePath("/admin", "layout");
    return redirect(`${KNOWLEDGE_PATH}/${result.documentId}`);
  }
  // Editing a published document's content marks it pending (0025).
  const state = await ingestAfter(documentId, result.message);
  revalidatePath("/admin", "layout");
  return state;
}

async function changeStatus(
  formData: FormData,
  status: KnowledgeStatus,
): Promise<KnowledgeActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }
  const documentId = z.uuid().safeParse(text(formData, "documentId")).data;
  if (!documentId) {
    return INVALID_DOCUMENT;
  }

  const result = await changeKnowledgeDocumentStatus(
    { actorId, documentId, status },
    supabaseKnowledgeAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  const state =
    status === "published"
      ? await ingestAfter(documentId, result.message)
      : ({ status: "success", message: result.message } as const);
  revalidatePath("/admin", "layout");
  return state;
}

export async function publishKnowledgeDocumentAction(
  _previous: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  return changeStatus(formData, "published");
}

export async function archiveKnowledgeDocumentAction(
  _previous: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  return changeStatus(formData, "archived");
}

export async function restoreKnowledgeDocumentAction(
  _previous: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  return changeStatus(formData, "draft");
}

export async function reprocessKnowledgeDocumentAction(
  _previous: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }
  const documentId = z.uuid().safeParse(text(formData, "documentId")).data;
  if (!documentId) {
    return INVALID_DOCUMENT;
  }

  const result = await reprocessKnowledgeDocument(
    { actorId, documentId },
    supabaseKnowledgeAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  const state = await ingestAfter(documentId, result.message);
  revalidatePath("/admin", "layout");
  return state;
}
