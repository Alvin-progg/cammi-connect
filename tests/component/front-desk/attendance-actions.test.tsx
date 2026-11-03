import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttendanceActions } from "@/components/front-desk/attendance-actions";
import { recordAttendanceAction } from "@/server/front-desk/actions";

vi.mock("@/server/front-desk/actions", () => ({ recordAttendanceAction: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000202";

function submittedFields(): Record<string, FormDataEntryValue> {
  const [, formData] = vi.mocked(recordAttendanceAction).mock.calls[0];
  return Object.fromEntries(formData.entries());
}

beforeEach(() => {
  vi.mocked(recordAttendanceAction).mockReset();
  vi.mocked(toast.success).mockReset();
});

describe("AttendanceActions", () => {
  it("renders nothing when no attendance update is allowed", () => {
    const { container } = render(
      <AttendanceActions
        appointmentId={APPOINTMENT_ID}
        patientName="Synthetic Patient B"
        actions={[]}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows only the allowed actions", () => {
    render(
      <AttendanceActions
        appointmentId={APPOINTMENT_ID}
        patientName="Synthetic Patient B"
        actions={["completed"]}
      />,
    );

    expect(
      screen.getByRole("group", { name: "Attendance for Synthetic Patient B" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark completed" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark no-show" })).not.toBeInTheDocument();
  });

  it("checks the patient in and announces success only after the save", async () => {
    vi.mocked(recordAttendanceAction).mockResolvedValue({
      status: "success",
      message: "Patient checked in.",
    });
    const user = userEvent.setup();
    render(
      <AttendanceActions
        appointmentId={APPOINTMENT_ID}
        patientName="Synthetic Patient B"
        actions={["checked_in", "completed", "no_show"]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Check in" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Patient checked in."));
    expect(submittedFields()).toEqual({ appointmentId: APPOINTMENT_ID, status: "checked_in" });
  });

  it("asks before marking a no-show", async () => {
    vi.mocked(recordAttendanceAction).mockResolvedValue({
      status: "success",
      message: "Appointment marked as no-show.",
    });
    const user = userEvent.setup();
    render(
      <AttendanceActions
        appointmentId={APPOINTMENT_ID}
        patientName="Synthetic Patient B"
        actions={["checked_in", "completed", "no_show"]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mark no-show" }));
    expect(recordAttendanceAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Go back" }));
    expect(screen.queryByRole("button", { name: "Confirm no-show" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark no-show" }));
    await user.click(screen.getByRole("button", { name: "Confirm no-show" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Appointment marked as no-show."),
    );
    expect(submittedFields()).toEqual({ appointmentId: APPOINTMENT_ID, status: "no_show" });
  });

  it("shows the server's refusal", async () => {
    vi.mocked(recordAttendanceAction).mockResolvedValue({
      status: "error",
      message: "Attendance can only be recorded on or after the appointment day.",
    });
    const user = userEvent.setup();
    render(
      <AttendanceActions
        appointmentId={APPOINTMENT_ID}
        patientName="Synthetic Patient B"
        actions={["completed"]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mark completed" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Attendance can only be recorded on or after the appointment day.",
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});
