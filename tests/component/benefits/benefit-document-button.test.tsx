import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BenefitDocumentButton } from "@/components/benefits/benefit-document-button";

const viewBenefitDocumentAction = vi.fn();

vi.mock("@/server/benefits/actions", () => ({
  viewBenefitDocumentAction: (...args: unknown[]) => viewBenefitDocumentAction(...args),
}));

const SIGNED_URL = "https://project.supabase.co/storage/v1/object/sign/doc.jpg?token=t";
const BLOB_URL = "blob:http://localhost/receipt-1";

describe("BenefitDocumentButton", () => {
  beforeEach(() => {
    viewBenefitDocumentAction.mockReset();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["x"], { type: "image/jpeg" }), { status: 200 })));
    vi.stubGlobal("open", vi.fn());
    URL.createObjectURL = vi.fn(() => BLOB_URL);
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the document in a dialog without opening a new tab", async () => {
    viewBenefitDocumentAction.mockResolvedValue({ status: "success", url: SIGNED_URL });
    render(<BenefitDocumentButton kind="pwd" recordId="rec-1" disabled={false} />);

    fireEvent.click(screen.getByRole("button", { name: "View document" }));

    const image = await screen.findByRole("img", { name: "Benefit document sent by the patient" });
    expect(image).toHaveAttribute("src", BLOB_URL);
    expect(screen.getByRole("dialog", { name: "Benefit document" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(SIGNED_URL);
    expect(window.open).not.toHaveBeenCalled();
  });

  it("shows the action's error message and opens nothing", async () => {
    viewBenefitDocumentAction.mockResolvedValue({ status: "error", message: "Too many views." });
    render(<BenefitDocumentButton kind="hmo" recordId="rec-2" disabled={false} />);

    fireEvent.click(screen.getByRole("button", { name: "View document" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many views.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows a retry message when the signed link cannot be fetched", async () => {
    viewBenefitDocumentAction.mockResolvedValue({ status: "success", url: SIGNED_URL });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 403 })));
    render(<BenefitDocumentButton kind="pwd" recordId="rec-3" disabled={false} />);

    fireEvent.click(screen.getByRole("button", { name: "View document" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("The document could not be opened. Try again in a moment."),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is disabled when the record has no document", () => {
    render(<BenefitDocumentButton kind="pwd" recordId="rec-4" disabled />);

    expect(screen.getByRole("button", { name: "No document" })).toBeDisabled();
    expect(viewBenefitDocumentAction).not.toHaveBeenCalled();
  });
});
