import { hashContent } from "@/lib/chat/rag/chunking";

/**
 * Normalizes document text so whitespace-only edits don't count as changes:
 * LF line endings, no trailing spaces, at most one blank line in a row, and
 * no leading or trailing blank lines.
 */
export function normalizeKnowledgeContent(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** SHA-256 hex digest of the normalized content, stored as content_hash and audited. */
export function hashKnowledgeContent(text: string): Promise<string> {
  return hashContent(normalizeKnowledgeContent(text));
}
