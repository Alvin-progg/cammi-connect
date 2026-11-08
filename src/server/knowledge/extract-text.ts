import "server-only";

import { extractText } from "unpdf";

import { checkKnowledgeUpload } from "@/lib/knowledge/schemas";

type ExtractResult = { ok: true; text: string } | { ok: false; message: string };

const UNREADABLE_PDF = "That file isn't a readable PDF.";
const PDF_SIGNATURE = "%PDF-";

function startsWithPdfSignature(bytes: Uint8Array): boolean {
  return new TextDecoder().decode(bytes.subarray(0, PDF_SIGNATURE.length)) === PDF_SIGNATURE;
}

/**
 * Reads the text of an uploaded .txt, .md, or .pdf file for a knowledge
 * document. The browser-sent MIME type is checked first, then a PDF must
 * start with the PDF signature before the parser sees it. Scanned PDFs have
 * no text layer and are refused (no OCR).
 */
export async function extractKnowledgeText(file: File): Promise<ExtractResult> {
  const upload = checkKnowledgeUpload(file);
  if (!upload.ok) {
    return upload;
  }

  let text: string;
  if (upload.kind === "text") {
    text = await file.text();
  } else {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!startsWithPdfSignature(bytes)) {
      return { ok: false, message: UNREADABLE_PDF };
    }
    try {
      text = (await extractText(bytes, { mergePages: true })).text;
    } catch {
      return { ok: false, message: UNREADABLE_PDF };
    }
  }

  if (text.trim() === "") {
    return { ok: false, message: "No text found in that file." };
  }
  return { ok: true, text };
}
