import "server-only";

import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type { KnowledgeStore } from "./service";

/** Knowledge search through the service-role match function (0005_knowledge.sql). */
export const supabaseKnowledgeRepository: KnowledgeStore = {
  async matchChunks(embedding, matchCount, minSimilarity) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_match_knowledge_chunks",
      {
        // pgvector parses the JSON array text form.
        query_embedding: JSON.stringify(embedding),
        match_count: matchCount,
        min_similarity: minSimilarity,
      },
    );
    if (error) {
      throw new Error("Unable to search hospital information.");
    }
    return (data ?? []).map((row) => ({
      chunkId: row.chunk_id,
      slug: row.slug,
      title: row.title,
      sectionTitle: row.section_title,
      content: row.content,
      similarity: row.similarity,
    }));
  },
};
