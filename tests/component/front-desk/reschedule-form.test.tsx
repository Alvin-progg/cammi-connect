import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { RescheduleForm } from "@/components/front-desk/reschedule-form";
import { rescheduleAppointmentAction } from "@/server/front-desk/actions";

const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/server/front-desk/actions", () => ({ rescheduleAppointmentAction: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000202";
const DETAILS_HREF = `/front-desk/requests/${APPOINTMENT_ID}`;

// 9:00 and 9:30 AM in Manila on 2026-11-05.
const SLOTS = [
  { start: "2026-11-05T01:00:00.000Z", end: "2026-11-05T01:30:00.000Z" },
  { start: "2026-11-05T01:30:00.000Z", end: "2026-11-05T02:00:00.000Z" },
];

function renderForm(slots = SLOTS) {
  return render(
    <RescheduleForm
      appointmentId={APPOINTMENT_ID}
      currentLabel="Nov 4, 2026, 10:30 AM"
      doctorName="Dr. Synthetic Reyes"
      dateLabel="Nov 6, 2026"
      slots={slots}
      detailsHref={DETAILS_HREF}
    />,
  );
}

beforeEach(() => {
  vi.mocked(rescheduleAppointmentAction).mockReset();
  push.mockReset();
  vi.mocked(toast.success).mockReset();
});

describe("RescheduleForm", () => {
  it("offers the free slots as Manila times next to the current time", () => {
    renderForm();

    expect(screen.getByText("Nov 4, 2026, 10:30 AM")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "9:00 AM" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "9:30 AM" })).toBeInTheDocument();
  });

  it("says when the doctor has no free slots on the date", () => {
    renderForm([]);

    expect(
      screen.getByText("No free slots on this date. Choose another date."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reschedule appointment" })).toBeNull();
  });

  it("submits the chosen slot and reason, then returns to the details", async () => {
    vi.mocked(rescheduleAppointmentAction).mockResolvedValue({
      status: "success",
      message: "Appointment rescheduled.",
    });
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("radio", { name: "9:30 AM" }));
    await user.click(screen.getByRole("radio", { name: "Patient request" }));
    await user.type(screen.getByRole("textbox", { name: "Details (optional)" }), "Prefers mornings.");
    await user.click(screen.getByRole("button", { name: "Reschedule appointment" }));

    await waitFor(() => expect(rescheduleAppointmentAction).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(rescheduleAppointmentAction).mock.calls[0][1];
    expect(submitted.get("appointmentId")).toBe(APPOINTMENT_ID);
    expect(submitted.get("scheduledAt")).toBe("2026-11-05T01:30:00.000Z");
    expect(submitted.get("reason")).toBe("patient_request");
    expect(submitted.get("details")).toBe("Prefers mornings.");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Appointment rescheduled."));
    expect(push).toHaveBeenCalledWith(DETAILS_HREF);
  });

  it("makes details required for an other reason", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("radio", { name: "Other hospital-approved reason" }));

    expect(screen.getByRole("textbox", { name: "Details (required)" })).toBeRequired();
  });

  it("shows why the reschedule failed and stays on the form", async () => {
    vi.mocked(rescheduleAppointmentAction).mockResolvedValue({
      status: "error",
      message: "That slot was just taken. Choose another time.",
    });
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("radio", { name: "9:00 AM" }));
    await user.click(screen.getByRole("radio", { name: "Doctor unavailable" }));
    await user.click(screen.getByRole("button", { name: "Reschedule appointment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That slot was just taken. Choose another time.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the picked time in the change summary", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByText("Pick a time")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "9:30 AM" }));
    expect(screen.getByText("Nov 6, 2026, 9:30 AM")).toBeInTheDocument();
    expect(screen.getByText("Dr. Synthetic Reyes (same)")).toBeInTheDocument();
  });
});
