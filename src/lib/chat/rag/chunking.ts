// Relative imports only: scripts/ingest-knowledge.mts runs this file directly in Node.

/** About 500 tokens at roughly 4 characters per token (PLN-002 S2). */
export const CHUNK_MAX_CHARS = 2000;
/** About 75 tokens repeated at the start of the next chunk of the same section. */
export const CHUNK_OVERLAP_CHARS = 300;

const PARAGRAPH_BREAK = "\n\n";
// A piece must leave room for the overlap and the paragraph break before it.
const PIECE_MAX_CHARS = CHUNK_MAX_CHARS - CHUNK_OVERLAP_CHARS - PARAGRAPH_BREAK.length;
const HEADING_PATTERN = /^(#{1,3})\s+(.+?)\s*#*\s*$/;

export type MarkdownChunk = {
  index: number;
  /** Nearest `##`/`###` heading; null for text before the first one. */
  sectionTitle: string | null;
  content: string;
};

export type ChunkedDocument = {
  /** The first `#` heading, or null when the document has none. */
  title: string | null;
  chunks: MarkdownChunk[];
};

type Section = { title: string | null; lines: string[] };

function splitIntoSections(markdown: string): { title: string | null; sections: Section[] } {
  let title: string | null = null;
  const sections: Section[] = [{ title: null, lines: [] }];

  for (const line of markdown.split(/\r?\n/)) {
    const heading = HEADING_PATTERN.exec(line);
    if (heading && heading[1] === "#" && title === null) {
      title = heading[2];
    } else if (heading) {
      sections.push({ title: heading[2], lines: [] });
    } else {
      sections[sections.length - 1].lines.push(line);
    }
  }
  return { title, sections };
}

/** Greedily packs words into pieces of at most `maxChars`; overlong words are cut. */
function splitOnWords(text: string, maxChars: number): string[] {
  const pieces: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    for (let start = 0; start < word.length; start += maxChars) {
      const part = word.slice(start, start + maxChars);
      const candidate = current ? `${current} ${part}` : part;
      if (candidate.length <= maxChars) {
        current = candidate;
      } else {
        pieces.push(current);
        current = part;
      }
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/** The end of the chunk's last paragraph, cut at a word boundary. */
function overlapTail(chunk: string): string {
  const breakAt = chunk.lastIndexOf(PARAGRAPH_BREAK);
  const lastParagraph = breakAt === -1 ? chunk : chunk.slice(breakAt + PARAGRAPH_BREAK.length);
  if (lastParagraph.length <= CHUNK_OVERLAP_CHARS) return lastParagraph;
  const tail = lastParagraph.slice(-CHUNK_OVERLAP_CHARS);
  const firstSpace = tail.indexOf(" ");
  return firstSpace === -1 ? "" : tail.slice(firstSpace + 1);
}

function splitSectionBody(body: string): string[] {
  if (body.length <= CHUNK_MAX_CHARS) return [body];

  const pieces = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap((paragraph) =>
      paragraph.length > PIECE_MAX_CHARS ? splitOnWords(paragraph, PIECE_MAX_CHARS) : [paragraph],
    );

  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    const candidate = current ? `${current}${PARAGRAPH_BREAK}${piece}` : piece;
    if (candidate.length <= CHUNK_MAX_CHARS) {
      current = candidate;
      continue;
    }
    chunks.push(current);
    const overlap = overlapTail(current);
    current = overlap ? `${overlap}${PARAGRAPH_BREAK}${piece}` : piece;
  }
  chunks.push(current);
  return chunks;
}

/**
 * Heading-aware chunking for the knowledge corpus. Each `##`/`###` section
 * becomes one chunk, or several overlapping chunks when it is too long, so a
 * chunk never mixes two sections.
 */
export function chunkMarkdown(markdown: string): ChunkedDocument {
  const { title, sections } = splitIntoSections(markdown);

  const chunks: MarkdownChunk[] = [];
  for (const section of sections) {
    const body = section.lines.join("\n").trim();
    if (!body) continue;
    for (const content of splitSectionBody(body)) {
      chunks.push({ index: chunks.length, sectionTitle: section.title, content });
    }
  }
  return { title, chunks };
}

/** SHA-256 hex digest via Web Crypto, available in Node and the browser. */
export async function hashContent(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
