import { describe, expect, it } from "vitest";

import {
  checkKnowledgeUpload,
  KNOWLEDGE_UPLOAD_MAX_BYTES,
  knowledgeFormSchema,
} from "@/lib/knowledge/schemas";

const VALID = { title: " Visiting hours ", category: "hospital_info", content: "Open daily.\r\n" };

describe("knowledgeFormSchema", () => {
  it("trims the title and normalizes the content", () => {
    expect(knowledgeFormSchema.parse(VALID)).toEqual({
      title: "Visiting hours",
      category: "hospital_info",
      content: "Open daily.",
    });
  });

  it("requires a title, a known category, and some content", () => {
    expect(knowledgeFormSchema.safeParse({ ...VALID, title: "  " }).success).toBe(false);
    expect(knowledgeFormSchema.safeParse({ ...VALID, category: "billing" }).success).toBe(false);
    expect(knowledgeFormSchema.safeParse({ ...VALID, content: " \n\n " }).success).toBe(false);
  });

  it("caps the title and the content length", () => {
    expect(knowledgeFormSchema.safeParse({ ...VALID, title: "a".repeat(201) }).success).toBe(false);
    expect(
      knowledgeFormSchema.safeParse({ ...VALID, content: "a".repeat(200_001) }).success,
    ).toBe(false);
  });
});

describe("checkKnowledgeUpload", () => {
  it.each([
    ["guide.txt", "text/plain", "text"],
    ["guide.md", "text/markdown", "text"],
    ["guide.md", "", "text"],
    ["guide.MD", "text/x-markdown", "text"],
    ["guide.pdf", "application/pdf", "pdf"],
  ] as const)("accepts %s (%s)", (name, type, kind) => {
    expect(checkKnowledgeUpload({ name, type, size: 10 })).toEqual({ ok: true, kind });
  });

  it.each([
    ["guide.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["guide.pdf", "text/plain"],
    ["guide.txt", "application/pdf"],
    ["guide", "text/plain"],
  ])("rejects %s (%s)", (name, type) => {
    expect(checkKnowledgeUpload({ name, type, size: 10 })).toEqual({
      ok: false,
      message: "Upload a .txt, .md, or .pdf file.",
    });
  });

  it("rejects files over 5 MB", () => {
    expect(
      checkKnowledgeUpload({
        name: "guide.pdf",
        type: "application/pdf",
        size: KNOWLEDGE_UPLOAD_MAX_BYTES + 1,
      }),
    ).toEqual({ ok: false, message: "The file must be 5 MB or smaller." });
  });
});
