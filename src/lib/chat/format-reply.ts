/**
 * Turns a model reply into plain data for React to render. Supports only what
 * Cami needs: paragraphs, `-`/`*` bullet lists, and **bold**. Everything else
 * (stray asterisks, `#` headings) is removed, so no markdown syntax reaches the
 * patient. Output is data, never HTML, so reply text cannot inject markup.
 */

export type InlineSegment = { text: string; strong: boolean };

export type ReplyBlock =
  | { kind: "paragraph"; segments: InlineSegment[] }
  | { kind: "list"; items: InlineSegment[][] };

const BULLET_LINE = /^[*\-•]\s+(.*)$/;
const HEADING_MARK = /^#{1,6}\s+/;

/** Drops the last `**` when it has no partner yet (a reply still being typed out). */
function dropUnclosedBold(text: string): string {
  const markers = text.split("**").length - 1;
  if (markers % 2 === 0) return text;
  const lastMarker = text.lastIndexOf("**");
  return text.slice(0, lastMarker) + text.slice(lastMarker + 2);
}

function parseInline(text: string): InlineSegment[] {
  return dropUnclosedBold(text)
    .split("**")
    .map((part, index) => ({
      text: part.replaceAll("*", ""),
      strong: index % 2 === 1,
    }))
    .filter((segment) => segment.text !== "");
}

/** Joins the text of a paragraph's lines into one run of segments. */
function paragraphSegments(lines: string[]): InlineSegment[] {
  return parseInline(lines.join(" "));
}

export function formatReply(content: string): ReplyBlock[] {
  const blocks: ReplyBlock[] = [];
  let paragraphLines: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    const segments = paragraphSegments(paragraphLines);
    paragraphLines = [];
    if (segments.length > 0) blocks.push({ kind: "paragraph", segments });
  }

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim().replace(HEADING_MARK, "");
    const bullet = BULLET_LINE.exec(line);

    if (bullet) {
      flushParagraph();
      const item = parseInline(bullet[1]);
      const lastBlock = blocks.at(-1);
      if (lastBlock?.kind === "list") {
        lastBlock.items.push(item);
      } else {
        blocks.push({ kind: "list", items: [item] });
      }
    } else if (line === "") {
      flushParagraph();
    } else {
      paragraphLines.push(line);
    }
  }
  flushParagraph();

  return blocks;
}
