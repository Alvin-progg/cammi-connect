// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { hashKnowledgeContent } from "@/lib/knowledge/content";
import {
  changeKnowledgeDocumentStatus,
  saveKnowledgeDocument,
  type KnowledgeAdminStore,
} from "@/server/knowledge/admin-service";

vi.mock("server-only", () => ({}));

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const DOCUMENT_ID = "00000000-0000-4000-8000-000000000a01";
const INPUT = { title: "Visiting hours", category: "hospital_info", content: "Open daily." } as const;

function fakeStore(overrides: Partial<KnowledgeAdminStore> = {}): KnowledgeAdminStore {
  return {
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    save: vi.fn().mockResolvedValue({ ok: true, documentId: DOCUMENT_ID }),
    setStatus: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

describe("saveKnowledgeDocument", () => {
  it("stores the content with its hash and the uploaded file name", async () => {
    const store = fakeStore();
    const result = await saveKnowledgeDocument(
      { actorId: ADMIN_ID, documentId: null, input: INPUT, sourceFileName: "hours.pdf" },
      store,
    );
    expect(result).toEqual({ ok: true, documentId: DOCUMENT_ID, message: "Document saved." });
    expect(store.save).toHaveBeenCalledWith({
      actorId: ADMIN_ID,
      documentId: null,
      ...INPUT,
      contentHash: await hashKnowledgeContent(INPUT.content),
      sourceFileName: "hours.pdf",
    });
  });

  it.each([
    ["not_admin", "Only an active administrator can manage knowledge documents."],
    ["not_found", "That document no longer exists."],
    ["not_editable", "An archived document can't be edited. Restore it as a draft first."],
    [undefined, "Something went wrong. Try again."],
    ["something_else", "Something went wrong. Try again."],
  ])("maps refusal %s to a message", async (code, message) => {
    const store = fakeStore({ save: vi.fn().mockResolvedValue({ ok: false, code }) });
    await expect(
      saveKnowledgeDocument(
        { actorId: ADMIN_ID, documentId: DOCUMENT_ID, input: INPUT, sourceFileName: null },
        store,
      ),
    ).resolves.toEqual({ ok: false, message });
  });
});

describe("changeKnowledgeDocumentStatus", () => {
  it.each([
    ["published", "Document published. Cami will use it once processing finishes."],
    ["archived", "Document archived. Cami no longer uses it."],
    ["draft", "Document restored as a draft."],
  ] as const)("moves the document to %s", async (status, message) => {
    const store = fakeStore();
    await expect(
      changeKnowledgeDocumentStatus({ actorId: ADMIN_ID, documentId: DOCUMENT_ID, status }, store),
    ).resolves.toEqual({ ok: true, message });
    expect(store.setStatus).toHaveBeenCalledWith({
      actorId: ADMIN_ID,
      documentId: DOCUMENT_ID,
      status,
    });
  });

  it("explains a transition the lifecycle doesn't allow", async () => {
    const store = fakeStore({
      setStatus: vi.fn().mockResolvedValue({ ok: false, code: "invalid_transition" }),
    });
    await expect(
      changeKnowledgeDocumentStatus(
        { actorId: ADMIN_ID, documentId: DOCUMENT_ID, status: "published" },
        store,
      ),
    ).resolves.toEqual({
      ok: false,
      message: "The document's status changed. Reload the page and try again.",
    });
  });
});
