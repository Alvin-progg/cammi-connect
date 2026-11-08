// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminSession } from "@/server/auth/dal";
import {
  archiveKnowledgeDocumentAction,
  publishKnowledgeDocumentAction,
  reprocessKnowledgeDocumentAction,
  restoreKnowledgeDocumentAction,
  saveKnowledgeDocumentAction,
} from "@/server/knowledge/actions";
import {
  changeKnowledgeDocumentStatus,
  reprocessKnowledgeDocument,
  saveKnowledgeDocument,
} from "@/server/knowledge/admin-service";
import { extractKnowledgeText } from "@/server/knowledge/extract-text";
import { ingestKnowledgeDocument } from "@/server/knowledge/ingest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/dal", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/server/knowledge/admin-repository", () => ({
  supabaseKnowledgeAdminRepository: {},
  supabaseKnowledgeIngestionRepository: {},
}));
vi.mock("@/server/knowledge/admin-service", () => ({
  saveKnowledgeDocument: vi.fn(),
  changeKnowledgeDocumentStatus: vi.fn(),
  reprocessKnowledgeDocument: vi.fn(),
}));
vi.mock("@/server/knowledge/extract-text", () => ({ extractKnowledgeText: vi.fn() }));
vi.mock("@/server/knowledge/ingest", () => ({ ingestKnowledgeDocument: vi.fn() }));
vi.mock("@/server/ai/gemini-embeddings", () => ({ embedTexts: vi.fn() }));

const IDLE = { status: "idle" } as const;
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const DOCUMENT_ID = "00000000-0000-4000-8000-000000000a01";
const DENIED = { status: "error", message: "You are not authorized to manage knowledge documents." };

const ADMIN_SESSION = {
  user: { id: "auth-admin", email: "admin@example.test" },
  admin: { id: ADMIN_ID, fullName: "Synthetic Admin" },
};

const FORM_FIELDS = { title: " Visiting hours ", category: "hospital_info", content: "Open daily." };

function formData(fields: Record<string, string | File>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.append(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminSession).mockResolvedValue(ADMIN_SESSION);
  vi.mocked(saveKnowledgeDocument).mockResolvedValue({
    ok: true,
    documentId: DOCUMENT_ID,
    message: "Document saved.",
  });
  vi.mocked(changeKnowledgeDocumentStatus).mockResolvedValue({ ok: true, message: "Done." });
  vi.mocked(reprocessKnowledgeDocument).mockResolvedValue({ ok: true, message: "Reprocessed." });
  vi.mocked(ingestKnowledgeDocument).mockResolvedValue({ outcome: "skipped" });
});

describe("knowledge document actions", () => {
  it("denies non-admin accounts without calling the service layer", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const statusForm = formData({ documentId: DOCUMENT_ID });

    await expect(saveKnowledgeDocumentAction(IDLE, formData(FORM_FIELDS))).resolves.toEqual(DENIED);
    await expect(publishKnowledgeDocumentAction(IDLE, statusForm)).resolves.toEqual(DENIED);
    await expect(archiveKnowledgeDocumentAction(IDLE, statusForm)).resolves.toEqual(DENIED);
    await expect(restoreKnowledgeDocumentAction(IDLE, statusForm)).resolves.toEqual(DENIED);
    await expect(reprocessKnowledgeDocumentAction(IDLE, statusForm)).resolves.toEqual(DENIED);
    expect(saveKnowledgeDocument).not.toHaveBeenCalled();
    expect(reprocessKnowledgeDocument).not.toHaveBeenCalled();
    expect(ingestKnowledgeDocument).not.toHaveBeenCalled();
    expect(changeKnowledgeDocumentStatus).not.toHaveBeenCalled();
    expect(extractKnowledgeText).not.toHaveBeenCalled();
  });

  it("creates a draft as the session admin and opens it", async () => {
    await saveKnowledgeDocumentAction(
      IDLE,
      formData({ ...FORM_FIELDS, actorId: "00000000-0000-4000-8000-000000000999" }),
    );
    expect(saveKnowledgeDocument).toHaveBeenCalledWith(
      {
        actorId: ADMIN_ID,
        documentId: null,
        input: { title: "Visiting hours", category: "hospital_info", content: "Open daily." },
        sourceFileName: null,
      },
      {},
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
    expect(redirect).toHaveBeenCalledWith(`/admin/knowledge-base/${DOCUMENT_ID}`);
  });

  it("edits an existing document and stays on its page", async () => {
    await expect(
      saveKnowledgeDocumentAction(IDLE, formData({ ...FORM_FIELDS, documentId: DOCUMENT_ID })),
    ).resolves.toEqual({ status: "success", message: "Document saved." });
    expect(saveKnowledgeDocument).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: DOCUMENT_ID }),
      {},
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("replaces the content with the text of an uploaded file", async () => {
    vi.mocked(extractKnowledgeText).mockResolvedValue({ ok: true, text: "From the PDF." });
    const file = new File(["%PDF-1.7"], "hours.pdf", { type: "application/pdf" });
    await saveKnowledgeDocumentAction(IDLE, formData({ ...FORM_FIELDS, content: "", file }));
    expect(extractKnowledgeText).toHaveBeenCalledWith(expect.any(File));
    expect(saveKnowledgeDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ content: "From the PDF." }),
        sourceFileName: "hours.pdf",
      }),
      {},
    );
  });

  it("ignores an empty file input", async () => {
    const empty = new File([], "", { type: "application/octet-stream" });
    await saveKnowledgeDocumentAction(IDLE, formData({ ...FORM_FIELDS, file: empty }));
    expect(extractKnowledgeText).not.toHaveBeenCalled();
    expect(saveKnowledgeDocument).toHaveBeenCalledWith(
      expect.objectContaining({ sourceFileName: null }),
      {},
    );
  });

  it("returns the upload error without saving", async () => {
    vi.mocked(extractKnowledgeText).mockResolvedValue({
      ok: false,
      message: "Upload a .txt, .md, or .pdf file.",
    });
    const file = new File(["x"], "notes.docx", { type: "application/msword" });
    await expect(
      saveKnowledgeDocumentAction(IDLE, formData({ ...FORM_FIELDS, file })),
    ).resolves.toEqual({ status: "error", message: "Upload a .txt, .md, or .pdf file." });
    expect(saveKnowledgeDocument).not.toHaveBeenCalled();
  });

  it("rejects invalid input and malformed IDs", async () => {
    await expect(
      saveKnowledgeDocumentAction(IDLE, formData({ ...FORM_FIELDS, content: "  " })),
    ).resolves.toEqual({ status: "error", message: "Enter the document content or upload a file." });
    await expect(
      saveKnowledgeDocumentAction(IDLE, formData({ ...FORM_FIELDS, documentId: "nope" })),
    ).resolves.toEqual({ status: "error", message: "That document is not valid." });
    await expect(
      publishKnowledgeDocumentAction(IDLE, formData({ documentId: "nope" })),
    ).resolves.toEqual({ status: "error", message: "That document is not valid." });
    expect(saveKnowledgeDocument).not.toHaveBeenCalled();
    expect(changeKnowledgeDocumentStatus).not.toHaveBeenCalled();
  });

  it.each([
    [publishKnowledgeDocumentAction, "published"],
    [archiveKnowledgeDocumentAction, "archived"],
    [restoreKnowledgeDocumentAction, "draft"],
  ] as const)("moves the document to %s", async (action, status) => {
    await expect(action(IDLE, formData({ documentId: DOCUMENT_ID }))).resolves.toEqual({
      status: "success",
      message: "Done.",
    });
    expect(changeKnowledgeDocumentStatus).toHaveBeenCalledWith(
      { actorId: ADMIN_ID, documentId: DOCUMENT_ID, status },
      {},
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
  });

  it("passes service refusals through", async () => {
    vi.mocked(changeKnowledgeDocumentStatus).mockResolvedValue({ ok: false, message: "Nope." });
    await expect(
      archiveKnowledgeDocumentAction(IDLE, formData({ documentId: DOCUMENT_ID })),
    ).resolves.toEqual({ status: "error", message: "Nope." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("ingests a published document right after publishing it", async () => {
    vi.mocked(ingestKnowledgeDocument).mockResolvedValue({ outcome: "ready", chunkCount: 3 });
    await expect(
      publishKnowledgeDocumentAction(IDLE, formData({ documentId: DOCUMENT_ID })),
    ).resolves.toEqual({ status: "success", message: "Done. Cami can use it now." });
    expect(ingestKnowledgeDocument).toHaveBeenCalledWith(
      DOCUMENT_ID,
      expect.objectContaining({ store: {}, embedDocuments: expect.any(Function) }),
    );
  });

  it("reports a processing failure after the status change succeeded", async () => {
    vi.mocked(ingestKnowledgeDocument).mockResolvedValue({
      outcome: "failed",
      error: "The document has no text to process.",
    });
    await expect(
      publishKnowledgeDocumentAction(IDLE, formData({ documentId: DOCUMENT_ID })),
    ).resolves.toEqual({
      status: "error",
      message: "Done. Processing failed: The document has no text to process.",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
  });

  it("ingests an edited document but never a new draft", async () => {
    await saveKnowledgeDocumentAction(IDLE, formData({ ...FORM_FIELDS, documentId: DOCUMENT_ID }));
    expect(ingestKnowledgeDocument).toHaveBeenCalledWith(DOCUMENT_ID, expect.anything());

    vi.mocked(ingestKnowledgeDocument).mockClear();
    await saveKnowledgeDocumentAction(IDLE, formData(FORM_FIELDS));
    expect(ingestKnowledgeDocument).not.toHaveBeenCalled();
  });

  it("does not ingest after archiving or restoring", async () => {
    await archiveKnowledgeDocumentAction(IDLE, formData({ documentId: DOCUMENT_ID }));
    await restoreKnowledgeDocumentAction(IDLE, formData({ documentId: DOCUMENT_ID }));
    expect(ingestKnowledgeDocument).not.toHaveBeenCalled();
  });

  it("reprocesses as the session admin, then ingests", async () => {
    vi.mocked(ingestKnowledgeDocument).mockResolvedValue({ outcome: "ready", chunkCount: 1 });
    await expect(
      reprocessKnowledgeDocumentAction(IDLE, formData({ documentId: DOCUMENT_ID })),
    ).resolves.toEqual({ status: "success", message: "Reprocessed. Cami can use it now." });
    expect(reprocessKnowledgeDocument).toHaveBeenCalledWith(
      { actorId: ADMIN_ID, documentId: DOCUMENT_ID },
      {},
    );
    expect(ingestKnowledgeDocument).toHaveBeenCalledWith(DOCUMENT_ID, expect.anything());
  });

  it("does not ingest when reprocessing is refused", async () => {
    vi.mocked(reprocessKnowledgeDocument).mockResolvedValue({ ok: false, message: "Nope." });
    await expect(
      reprocessKnowledgeDocumentAction(IDLE, formData({ documentId: DOCUMENT_ID })),
    ).resolves.toEqual({ status: "error", message: "Nope." });
    expect(ingestKnowledgeDocument).not.toHaveBeenCalled();
  });
});
