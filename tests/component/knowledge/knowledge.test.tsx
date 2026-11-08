import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FailedDocumentsPanel, KnowledgeList } from "@/components/knowledge/knowledge-list";
import { KnowledgeForm } from "@/components/knowledge/knowledge-form";
import { KnowledgeLifecycle } from "@/components/knowledge/knowledge-lifecycle";
import type { KnowledgeDocument } from "@/lib/knowledge/types";

vi.mock("@/server/knowledge/actions", () => ({
  saveKnowledgeDocumentAction: vi.fn(),
  publishKnowledgeDocumentAction: vi.fn(),
  archiveKnowledgeDocumentAction: vi.fn(),
  restoreKnowledgeDocumentAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const DRAFT: KnowledgeDocument = {
  id: "00000000-0000-4000-8000-000000000a01",
  slug: "visiting-hours",
  title: "Visiting hours",
  category: "hospital_info",
  status: "draft",
  processingStatus: "pending",
  processingError: null,
  version: 1,
  sourceFileName: null,
  publishedAt: null,
  archivedAt: null,
  updatedAt: "2026-11-08T02:00:00.000Z",
  content: "# Visiting hours\n\nOpen daily.",
};
const PUBLISHED: KnowledgeDocument = {
  ...DRAFT,
  id: "00000000-0000-4000-8000-000000000a02",
  title: "Parking",
  status: "published",
  processingStatus: "ready",
  version: 3,
};
const FAILED: KnowledgeDocument = {
  ...PUBLISHED,
  id: "00000000-0000-4000-8000-000000000a03",
  title: "Billing FAQ",
  processingStatus: "failed",
  processingError: "Embedding provider timed out.",
};

describe("KnowledgeList", () => {
  it("shows each document's category, status, processing, and version", () => {
    render(<KnowledgeList documents={[DRAFT, PUBLISHED]} />);
    const table = screen.getByRole("table", { name: "Knowledge documents" });
    const parking = within(table).getByRole("link", { name: "Parking" }).closest("tr");
    expect(parking).not.toBeNull();
    const row = within(parking as HTMLElement);
    expect(row.getByText("Hospital information")).toBeInTheDocument();
    expect(row.getByText("Published")).toBeInTheDocument();
    expect(row.getByText("Ready")).toBeInTheDocument();
    expect(row.getByText("v3")).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: "Visiting hours" })).toHaveAttribute(
      "href",
      `/admin/knowledge-base/${DRAFT.id}`,
    );
  });

  it("shows an empty state", () => {
    render(<KnowledgeList documents={[]} />);
    expect(screen.getByText("No documents match.")).toBeInTheDocument();
  });
});

describe("FailedDocumentsPanel", () => {
  it("lists failed documents with their processing error", () => {
    render(<FailedDocumentsPanel documents={[FAILED]} />);
    const panel = screen.getByRole("region", { name: "Processing failed" });
    expect(within(panel).getByRole("link", { name: "Billing FAQ" })).toBeInTheDocument();
    expect(within(panel).getByText("Embedding provider timed out.")).toBeInTheDocument();
  });

  it("renders nothing when no document failed", () => {
    const { container } = render(<FailedDocumentsPanel documents={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("KnowledgeForm", () => {
  it("prefills an existing document and accepts txt, md, and pdf uploads", () => {
    render(<KnowledgeForm document={DRAFT} />);
    expect(screen.getByLabelText("Title")).toHaveValue("Visiting hours");
    expect(screen.getByLabelText("Category")).toHaveValue("hospital_info");
    expect(screen.getByLabelText("Content")).toHaveValue(DRAFT.content);
    expect(screen.getByLabelText(/Upload a file/)).toHaveAttribute("accept", ".txt,.md,.pdf");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("warns that saving a published document's content starts a new version", () => {
    render(<KnowledgeForm document={PUBLISHED} />);
    expect(screen.getByText(/saves version 4/)).toBeInTheDocument();
  });

  it("creates a draft when there is no document", () => {
    render(<KnowledgeForm />);
    expect(screen.getByRole("button", { name: "Create draft" })).toBeInTheDocument();
  });
});

describe("KnowledgeLifecycle", () => {
  it("offers publish and archive for a draft", () => {
    render(<KnowledgeLifecycle document={DRAFT} />);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore as draft" })).not.toBeInTheDocument();
  });

  it("offers only archive for a published document, and Reprocess stays disabled", () => {
    render(<KnowledgeLifecycle document={PUBLISHED} />);
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reprocess" })).toBeDisabled();
  });

  it("offers only restore for an archived document", () => {
    render(<KnowledgeLifecycle document={{ ...PUBLISHED, status: "archived" }} />);
    expect(screen.getByRole("button", { name: "Restore as draft" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });
});
