import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { KnowledgeDocumentSummary } from "@/lib/knowledge/types";
import { REFERENCE_CACHE_TAG } from "@/server/cache/reference-tag";
import { getSupabaseAdminClient } from "@/server/db/admin-client";
import type { Database } from "@/server/db/database.types";

import type { KnowledgeAdminStore } from "./admin-service";
import type { KnowledgeIngestionStore } from "./ingest";

type DocumentRow = Database["public"]["Tables"]["knowledge_documents"]["Row"];

// Lists leave out content, which can be up to 200,000 characters per document.
const SUMMARY_COLUMNS =
  "id, slug, title, category, status, processing_status, processing_error, version, source_file_name, published_at, archived_at, updated_at";

/** P0001 refusals carry their code as the message; anything else is unexpected. */
function refusalCode(error: { code?: string; message: string }): string | undefined {
  if (error.code === "P0001") {
    return error.message;
  }
  console.error("Admin knowledge document database call failed.");
  return undefined;
}

function toSummary(row: Omit<DocumentRow, "content" | "created_at" | "created_by" | "content_hash" | "published_by">): KnowledgeDocumentSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    status: row.status,
    processingStatus: row.processing_status,
    processingError: row.processing_error,
    version: row.version,
    sourceFileName: row.source_file_name,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Knowledge document list and detail.
 * Cached until a write action calls `updateTag(REFERENCE_CACHE_TAG)`.
 */
async function cachedListDocuments(
  { status, category }: Parameters<KnowledgeAdminStore["listDocuments"]>[0],
): ReturnType<KnowledgeAdminStore["listDocuments"]> {
  "use cache";
  cacheTag(REFERENCE_CACHE_TAG);
  cacheLife("hours");

  let query = getSupabaseAdminClient()
    .from("knowledge_documents")
    .select(SUMMARY_COLUMNS)
    .order("updated_at", { ascending: false });
  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (category !== "all") {
    query = query.eq("category", category);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error("Unable to load knowledge documents.");
  }
  return (data ?? []).map(toSummary);
}

async function cachedGetDocument(
  documentId: Parameters<KnowledgeAdminStore["getDocument"]>[0],
): ReturnType<KnowledgeAdminStore["getDocument"]> {
  "use cache";
  cacheTag(REFERENCE_CACHE_TAG);
  cacheLife("hours");

  const { data, error } = await getSupabaseAdminClient()
    .from("knowledge_documents")
    .select(`${SUMMARY_COLUMNS}, content`)
    .eq("id", documentId)
    .maybeSingle();
  if (error) {
    throw new Error("Unable to load the knowledge document.");
  }
  return data ? { ...toSummary(data), content: data.content } : null;
}

export const supabaseKnowledgeAdminRepository: KnowledgeAdminStore = {
  listDocuments: cachedListDocuments,

  getDocument: cachedGetDocument,

  async save({ actorId, documentId, title, category, content, contentHash, sourceFileName }) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_save_knowledge_document",
      {
        p_actor_profile_id: actorId,
        p_document_id: documentId,
        p_title: title,
        p_category: category,
        p_content: content,
        p_content_hash: contentHash,
        p_source_file_name: sourceFileName,
      },
    );
    if (error || !data) {
      return { ok: false, code: error ? refusalCode(error) : undefined };
    }
    return { ok: true, documentId: data };
  },

  async setStatus({ actorId, documentId, status }) {
    const { error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_set_knowledge_document_status",
      { p_actor_profile_id: actorId, p_document_id: documentId, p_status: status },
    );
    return error ? { ok: false, code: refusalCode(error) } : { ok: true };
  },

  async reprocess({ actorId, documentId }) {
    const { error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_reprocess_knowledge_document",
      { p_actor_profile_id: actorId, p_document_id: documentId },
    );
    return error ? { ok: false, code: refusalCode(error) } : { ok: true };
  },
};

/** Ingestion writes, each guarded by status and version (0026). */
export const supabaseKnowledgeIngestionRepository: KnowledgeIngestionStore = {
  async getIngestionSource(documentId) {
    const { data, error } = await getSupabaseAdminClient()
      .from("knowledge_documents")
      .select("id, title, category, content, status, processing_status, version")
      .eq("id", documentId)
      .maybeSingle();
    if (error) {
      throw new Error("Unable to load the knowledge document.");
    }
    return data
      ? {
          id: data.id,
          title: data.title,
          category: data.category,
          content: data.content,
          status: data.status,
          processingStatus: data.processing_status,
          version: data.version,
        }
      : null;
  },

  async markProcessing(documentId, version) {
    const { data, error } = await getSupabaseAdminClient()
      .from("knowledge_documents")
      .update({ processing_status: "processing", processing_error: null })
      .eq("id", documentId)
      .eq("version", version)
      .eq("status", "published")
      .select("id");
    if (error) {
      throw new Error("Unable to start processing the knowledge document.");
    }
    return (data ?? []).length > 0;
  },

  async markFailed(documentId, version, processingError) {
    const { error } = await getSupabaseAdminClient()
      .from("knowledge_documents")
      .update({ processing_status: "failed", processing_error: processingError })
      .eq("id", documentId)
      .eq("version", version)
      .eq("status", "published");
    if (error) {
      console.error("Unable to mark a knowledge document as failed.");
    }
  },

  async storeChunks(documentId, version, chunks) {
    const { error } = await getSupabaseAdminClient().rpc("cammi_connect_store_knowledge_chunks", {
      p_document_id: documentId,
      p_version: version,
      p_chunks: chunks,
    });
    if (!error) return "stored";
    if (error.code === "P0001" && error.message === "stale") return "stale";
    console.error("Unable to store knowledge chunks.");
    return "error";
  },
};
