import { z } from "zod";

import { normalizeKnowledgeContent } from "./content";
import { KNOWLEDGE_CATEGORIES } from "./types";

export const KNOWLEDGE_CONTENT_MAX_CHARS = 200_000;
export const KNOWLEDGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

/** The admin knowledge document form. Status changes are separate audited actions. */
export const knowledgeFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a document title.")
    .max(200, "Keep the title under 200 characters."),
  category: z.enum(KNOWLEDGE_CATEGORIES, "Choose a category."),
  content: z
    .string()
    .transform(normalizeKnowledgeContent)
    .pipe(
      z
        .string()
        .min(1, "Enter the document content or upload a file.")
        .max(KNOWLEDGE_CONTENT_MAX_CHARS, "The document is too long. Split it into smaller ones."),
    ),
});

export type KnowledgeFormInput = z.infer<typeof knowledgeFormSchema>;

export type KnowledgeUploadKind = "text" | "pdf";

/** Extension → MIME types browsers send for it. Markdown often arrives as "" or text/plain. */
const ALLOWED_UPLOADS: Record<string, { kind: KnowledgeUploadKind; types: readonly string[] }> = {
  txt: { kind: "text", types: ["text/plain"] },
  md: { kind: "text", types: ["text/markdown", "text/x-markdown", "text/plain", ""] },
  pdf: { kind: "pdf", types: ["application/pdf"] },
};

const WRONG_TYPE = "Upload a .txt, .md, or .pdf file.";

/** Checks an uploaded file's extension, MIME type, and size before it is read. */
export function checkKnowledgeUpload(file: {
  name: string;
  type: string;
  size: number;
}): { ok: true; kind: KnowledgeUploadKind } | { ok: false; message: string } {
  const extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
  const allowed = extension ? ALLOWED_UPLOADS[extension] : undefined;
  if (!allowed || !allowed.types.includes(file.type)) {
    return { ok: false, message: WRONG_TYPE };
  }
  if (file.size > KNOWLEDGE_UPLOAD_MAX_BYTES) {
    return { ok: false, message: "The file must be 5 MB or smaller." };
  }
  return { ok: true, kind: allowed.kind };
}
