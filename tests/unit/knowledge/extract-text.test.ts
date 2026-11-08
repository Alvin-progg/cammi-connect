// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractText } from "unpdf";

import { extractKnowledgeText } from "@/server/knowledge/extract-text";

vi.mock("server-only", () => ({}));
vi.mock("unpdf", () => ({ extractText: vi.fn() }));

const PDF_BYTES = new TextEncoder().encode("%PDF-1.7 synthetic");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("extractKnowledgeText", () => {
  it("reads text and markdown files as they are", async () => {
    const file = new File(["# Visiting hours\n\nOpen daily."], "hours.md", { type: "text/markdown" });
    await expect(extractKnowledgeText(file)).resolves.toEqual({
      ok: true,
      text: "# Visiting hours\n\nOpen daily.",
    });
    expect(extractText).not.toHaveBeenCalled();
  });

  it("extracts the text of a PDF with all pages merged", async () => {
    vi.mocked(extractText).mockResolvedValue({ totalPages: 2, text: "Page one\nPage two" });
    const file = new File([PDF_BYTES], "hours.pdf", { type: "application/pdf" });
    await expect(extractKnowledgeText(file)).resolves.toEqual({
      ok: true,
      text: "Page one\nPage two",
    });
    expect(extractText).toHaveBeenCalledWith(expect.any(Uint8Array), { mergePages: true });
  });

  it("rejects a .pdf that is not a PDF without parsing it", async () => {
    const file = new File(["plain words"], "fake.pdf", { type: "application/pdf" });
    await expect(extractKnowledgeText(file)).resolves.toEqual({
      ok: false,
      message: "That file isn't a readable PDF.",
    });
    expect(extractText).not.toHaveBeenCalled();
  });

  it("reports a PDF the parser can't read", async () => {
    vi.mocked(extractText).mockRejectedValue(new Error("bad xref"));
    const file = new File([PDF_BYTES], "broken.pdf", { type: "application/pdf" });
    await expect(extractKnowledgeText(file)).resolves.toEqual({
      ok: false,
      message: "That file isn't a readable PDF.",
    });
  });

  it("refuses a file with no text, such as a scanned PDF", async () => {
    vi.mocked(extractText).mockResolvedValue({ totalPages: 1, text: "  \n " });
    const file = new File([PDF_BYTES], "scan.pdf", { type: "application/pdf" });
    await expect(extractKnowledgeText(file)).resolves.toEqual({
      ok: false,
      message: "No text found in that file.",
    });
  });

  it("refuses the wrong file type before reading it", async () => {
    const file = new File(["x"], "notes.docx", { type: "application/msword" });
    await expect(extractKnowledgeText(file)).resolves.toEqual({
      ok: false,
      message: "Upload a .txt, .md, or .pdf file.",
    });
  });
});
