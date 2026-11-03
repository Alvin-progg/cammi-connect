import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CancelAppointment,
  RequestDecision,
} from "@/components/front-desk/request-decision";
import {
  cancelAppointmentAction,
  confirmRequestAction,
  rejectRequestAction,
} from "@/server/front-desk/actions";

vi.mock("@/server/front-desk/actions", () => ({
  cancelAppointmentAction: vi.fn(),
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
  vi.mocked(cancelAppointmentAction).mockReset();
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

describe("CancelAppointment", () => {
  function renderCancel() {
    return render(
      <CancelAppointment
        appointmentId={APPOINTMENT_ID}
        patientName="Synthetic Patient B"
        doctorName="Dr. Synthetic Reyes"
        whenLabel="Nov 4, 2026, 10:30 AM"
      />,
    );
  }

  it("cancels with a chosen reason and details after a summary", async () => {
    vi.mocked(cancelAppointmentAction).mockResolvedValue({
      status: "success",
      message: "Appointment cancelled.",
    });
    const user = userEvent.setup();
    renderCancel();

    await user.click(screen.getByRole("button", { name: "Cancel appointment" }));

    const dialog = screen.getByRole("dialog", { name: "Cancel this appointment?" });
    expect(within(dialog).getByText("Synthetic Patient B")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("radio", { name: "Patient request" }));
    await user.type(
      within(dialog).getByRole("textbox", { name: "Details (optional)" }),
      "Called to cancel.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancel appointment" }));

    await waitFor(() => expect(cancelAppointmentAction).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(cancelAppointmentAction).mock.calls[0][1];
    expect(submitted.get("appointmentId")).toBe(APPOINTMENT_ID);
    expect(submitted.get("reason")).toBe("patient_request");
    expect(submitted.get("details")).toBe("Called to cancel.");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Cancel this appointment?" })).toBeNull(),
    );
  });

  it("makes details required for an other reason", async () => {
    const user = userEvent.setup();
    renderCancel();

    await user.click(screen.getByRole("button", { name: "Cancel appointment" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel this appointment?" });
    await user.click(
      within(dialog).getByRole("radio", { name: "Other hospital-approved reason" }),
    );

    expect(within(dialog).getByRole("textbox", { name: "Details (required)" })).toBeRequired();
  });

  it("shows why a cancellation failed and keeps the dialog open", async () => {
    vi.mocked(cancelAppointmentAction).mockResolvedValue({
      status: "error",
      message:
        "Only pending or confirmed appointments can be cancelled. Refresh to see its current status.",
    });
    const user = userEvent.setup();
    renderCancel();

    await user.click(screen.getByRole("button", { name: "Cancel appointment" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel this appointment?" });
    await user.click(within(dialog).getByRole("radio", { name: "Doctor unavailable" }));
    await user.click(within(dialog).getByRole("button", { name: "Cancel appointment" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Only pending or confirmed appointments can be cancelled.",
    );
    expect(screen.getByRole("dialog", { name: "Cancel this appointment?" })).toBeInTheDocument();
  });
});
