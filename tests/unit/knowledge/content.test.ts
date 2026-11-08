import { describe, expect, it } from "vitest";

import { hashKnowledgeContent, normalizeKnowledgeContent } from "@/lib/knowledge/content";

describe("normalizeKnowledgeContent", () => {
  it("unifies line endings, trims line ends, and collapses blank runs", () => {
    expect(normalizeKnowledgeContent("  \r\n# Title  \r\n\r\n\r\n\r\nBody\t\n\n")).toBe(
      "# Title\n\nBody",
    );
  });

  it("keeps leading indentation inside the text", () => {
    expect(normalizeKnowledgeContent("- item\n  - nested")).toBe("- item\n  - nested");
  });
});

describe("hashKnowledgeContent", () => {
  it("is a stable SHA-256 hex digest across whitespace-only changes", async () => {
    const original = await hashKnowledgeContent("# Visiting hours\n\nOpen 8am to 5pm.");
    const reformatted = await hashKnowledgeContent(
      "# Visiting hours   \r\n\r\n\r\nOpen 8am to 5pm.\r\n\r\n",
    );
    expect(original).toMatch(/^[0-9a-f]{64}$/);
    expect(reformatted).toBe(original);
  });

  it("changes when the words change", async () => {
    expect(await hashKnowledgeContent("Open 8am to 5pm.")).not.toBe(
      await hashKnowledgeContent("Open 9am to 5pm."),
    );
  });
});
