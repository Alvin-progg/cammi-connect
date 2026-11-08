"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { knowledgeFormSchema } from "@/lib/knowledge/schemas";
import type { KnowledgeStatus } from "@/lib/knowledge/types";
import { getAdminSession } from "@/server/auth/dal";

import { supabaseKnowledgeAdminRepository } from "./admin-repository";
import { changeKnowledgeDocumentStatus, saveKnowledgeDocument } from "./admin-service";
import { extractKnowledgeText } from "./extract-text";

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
  revalidatePath("/admin", "layout");
  if (documentId === null) {
    redirect(`${KNOWLEDGE_PATH}/${result.documentId}`);
  }
  return { status: "success", message: result.message };
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
  revalidatePath("/admin", "layout");
  return { status: "success", message: result.message };
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
