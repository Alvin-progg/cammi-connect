import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RequestDecision } from "@/components/front-desk/request-decision";
import {
  confirmRequestAction,
  rejectRequestAction,
} from "@/server/front-desk/actions";

vi.mock("@/server/front-desk/actions", () => ({
  confirmRequestAction: vi.fn(),
  rejectRequestAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

// jsdom does not implement modal dialogs; mimic the open/close contract.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000202";

function renderDecision() {
  return render(
    <RequestDecision
      appointmentId={APPOINTMENT_ID}
      patientName="Synthetic Patient B"
      doctorName="Dr. Synthetic Reyes"
      whenLabel="Nov 4, 2026, 10:30 AM"
    />,
  );
}

beforeEach(() => {
  vi.mocked(confirmRequestAction).mockReset();
  vi.mocked(rejectRequestAction).mockReset();
});

describe("RequestDecision", () => {
  it("asks for confirmation with a summary before confirming", async () => {
    vi.mocked(confirmRequestAction).mockResolvedValue({
      status: "success",
      message: "Appointment confirmed.",
    });
    const user = userEvent.setup();
    renderDecision();

    await user.click(screen.getByRole("button", { name: "Confirm request" }));

    const dialog = screen.getByRole("dialog", { name: "Confirm this appointment?" });
    expect(within(dialog).getByText("Synthetic Patient B")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Dr. Synthetic Reyes · Nov 4, 2026, 10:30 AM"),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Confirm appointment" }));

    await waitFor(() => expect(confirmRequestAction).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(confirmRequestAction).mock.calls[0][1];
    expect(submitted.get("appointmentId")).toBe(APPOINTMENT_ID);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Confirm this appointment?" })).toBeNull(),
    );
  });

  it("shows why a confirmation failed and keeps the dialog open", async () => {
    vi.mocked(confirmRequestAction).mockResolvedValue({
      status: "error",
      message: "This request is no longer pending. Refresh to see its current status.",
    });
    const user = userEvent.setup();
    renderDecision();

    await user.click(screen.getByRole("button", { name: "Confirm request" }));
    const dialog = screen.getByRole("dialog", { name: "Confirm this appointment?" });
    await user.click(within(dialog).getByRole("button", { name: "Confirm appointment" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "This request is no longer pending.",
    );
  });

  it("requires a rejection reason, and details for other reasons", async () => {
    const user = userEvent.setup();
    renderDecision();

    await user.click(screen.getByRole("button", { name: "Reject request" }));

    const dialog = screen.getByRole("dialog", { name: "Reject this request?" });
    const reasons = within(dialog).getByRole("radiogroup", { name: "Reason" });
    expect(within(reasons).getAllByRole("radio")).toHaveLength(5);
    expect(within(reasons).getByRole("radio", { name: "Doctor unavailable" })).toBeRequired();

    const details = within(dialog).getByRole("textbox", { name: /Details/ });
    expect(details).not.toBeRequired();

    await user.click(
      within(reasons).getByRole("radio", { name: "Other hospital-approved reason" }),
    );
    expect(details).toBeRequired();
  });

  it("submits the chosen reason and details", async () => {
    vi.mocked(rejectRequestAction).mockResolvedValue({
      status: "success",
      message: "Request rejected.",
    });
    const user = userEvent.setup();
    renderDecision();

    await user.click(screen.getByRole("button", { name: "Reject request" }));
    const dialog = screen.getByRole("dialog", { name: "Reject this request?" });
    await user.click(within(dialog).getByRole("radio", { name: "Doctor unavailable" }));
    await user.type(
      within(dialog).getByRole("textbox", { name: /Details/ }),
      "On leave that week.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Reject request" }));

    await waitFor(() => expect(rejectRequestAction).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(rejectRequestAction).mock.calls[0][1];
    expect(submitted.get("appointmentId")).toBe(APPOINTMENT_ID);
    expect(submitted.get("reason")).toBe("doctor_unavailable");
    expect(submitted.get("details")).toBe("On leave that week.");
  });
});
