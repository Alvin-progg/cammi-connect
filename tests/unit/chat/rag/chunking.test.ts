// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  CHUNK_MAX_CHARS,
  CHUNK_OVERLAP_CHARS,
  chunkMarkdown,
  hashContent,
} from "@/lib/chat/rag/chunking";

describe("chunkMarkdown", () => {
  it("takes the title from the first top-level heading", () => {
    const { title } = chunkMarkdown("# Visit Guidelines\n\nIntro text.");

    expect(title).toBe("Visit Guidelines");
  });

  it("splits on second- and third-level headings and keeps each section title", () => {
    const markdown = [
      "# Appointment Requirements",
      "",
      "Synthetic sample content.",
      "",
      "## Before your visit",
      "",
      "Arrive 15 minutes early.",
      "",
      "### Children",
      "",
      "Bring the child's health record.",
    ].join("\n");

    const { chunks } = chunkMarkdown(markdown);

    expect(chunks.map((chunk) => chunk.sectionTitle)).toEqual([
      null,
      "Before your visit",
      "Children",
    ]);
    expect(chunks.map((chunk) => chunk.index)).toEqual([0, 1, 2]);
    expect(chunks[1].content).toBe("Arrive 15 minutes early.");
  });

  it("skips sections with no body text", () => {
    const { chunks } = chunkMarkdown("# Title\n\n## Empty\n\n## Filled\n\nSome text.");

    expect(chunks).toHaveLength(1);
    expect(chunks[0].sectionTitle).toBe("Filled");
  });

  it("splits an oversized section on paragraph boundaries with overlap", () => {
    const paragraphs = Array.from(
      { length: 12 },
      (_, index) => `Paragraph ${index} ${"word ".repeat(70).trim()}.`,
    );
    const markdown = `# Services\n\n## Long section\n\n${paragraphs.join("\n\n")}`;

    const { chunks } = chunkMarkdown(markdown);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS);
      expect(chunk.sectionTitle).toBe("Long section");
    }
    // Each chunk after the first opens with a short tail of the previous one.
    for (let index = 1; index < chunks.length; index += 1) {
      const overlap = chunks[index].content.split("\n\n")[0];
      expect(overlap.length).toBeGreaterThan(0);
      expect(overlap.length).toBeLessThanOrEqual(CHUNK_OVERLAP_CHARS);
      expect(chunks[index - 1].content.endsWith(overlap)).toBe(true);
    }
    // No paragraph is lost.
    const joined = chunks.map((chunk) => chunk.content).join("\n\n");
    for (const paragraph of paragraphs) {
      expect(joined).toContain(paragraph);
    }
  });
});

describe("hashContent", () => {
  it("returns a stable SHA-256 hex digest", async () => {
    const first = await hashContent("hello");
    const second = await hashContent("hello");

    expect(first).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    expect(second).toBe(first);
    expect(await hashContent("hello!")).not.toBe(first);
  });
});
